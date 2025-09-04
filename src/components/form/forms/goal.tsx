'use client';

// Import dependencies and sub components
import type getRoadmaps from "@/fetchers/getRoadmaps.ts"; // Type for roadmap fetching
import formSubmitter from "@/functions/formSubmitter"; // Handles form submission to API
import parameterOptions from "@/lib/LEAPList.json" with { type: "json" }; // Options for indicator parameter
import mathjs from "@/math"; // Math library for unit parsing
import { GoalCreateInput, GoalUpdateInput, Years } from "@/types"; // Types and helpers
import { DataSeries, Goal } from "@prisma/client"; // Prisma types
import { useMemo, useState } from "react"; // React hooks
import { useTranslation } from "react-i18next"; // i18n hook
import DataSeriesInput from "../elements/dataSeriesInput/dataSeriesInput"; // For entering data series
import { getDataSeries } from "../elements/dataSeriesInput/utils"; // Helper for extracting data series from form
import styles from '../forms.module.css'; // CSS module for styling
import { InheritingBaseline, ManualGoalForm } from "../sections/goalFormSections"; // Sub components for form sections
import { DEBUG_Recipe, RecipeContextProvider, RecipeEquationEditor, RecipeErrorAndWarnings, RecipeSuggestions, RecipeVariableEditor, ResultingDataSeries, ResultingRecipe } from "@/components/recipe/recipeEditor";
import { Recipe, RecipeDataTypes } from "@/functions/recipe-parser/types";
import { VectorIndexPickerOptions } from "@/components/recipe/variables";
import { recipeFromUnknown } from "@/functions/parseRecipe";
import SelectSingleTreeSearch from "../elements/combobox/selectSingleTreeSearch";
import TestTreeSelect from "../elements/combobox/testTreeSelect";
import { testTreeItem } from "@/components/types";

// Enum for selecting the type of data series for the goal
enum DataSeriesType {
  Static = "STATIC",      // Manually entered data
  Inherited = "INHERIT", // Inherited from another goal
  Combined = "COMBINE",  // Combination of multiple goals
}

// Enum for selecting the type of baseline for the goal
enum BaselineType {
  Initial = "INITIAL",    // Use initial value as baseline
  Custom = "CUSTOM",      // User provides custom baseline
  Inherited = "INHERIT",  // Inherit baseline from another goal
}

// Main GoalForm component
export default function GoalForm({
  roadmapId,
  roadmapAlternatives,
  currentGoal,
}: {
  roadmapId?: string, // ID of the parent roadmap (if already selected)
  roadmapAlternatives: Awaited<ReturnType<typeof getRoadmaps>>, // List of possible roadmaps
  currentGoal?: Goal & { // Current goal (if editing)
    dataSeries: DataSeries | null,
    baselineDataSeries: DataSeries | null,
    author: { id: string, username: string },
    links?: { url: string, description: string | null }[],
    roadmap: { id: string },
  },
}) {
  const { t } = useTranslation(["forms", "common"]); // i18n translation hook

  // State for the type of data series (static, inherited, combined)
  const defaultDataSeriesType = DataSeriesType.Inherited;
  const [dataSeriesType, setDataSeriesType] = useState<DataSeriesType>(defaultDataSeriesType);
  // State for the type of baseline (initial, custom, inherited)
  const [baselineType, setBaselineType] = useState<BaselineType>(currentGoal?.baselineDataSeries ? BaselineType.Custom : BaselineType.Initial);

  // Memoized timestamp for the form submission (used for optimistic updates)
  const timestamp = useMemo(() => Date.now(), []);

  // Form submission handler
  function handleSubmit(event: React.ChangeEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.target.elements;
    const formData = new FormData(event.target);
    // List of inputs expecting a file
    const fileInputKeys: string[] = [];

    // Basic validation to ensure no unexpected File objects are present
    // Allows us to safely cast all formData values to (string | null) later
    if (formData.entries().some(([key, value]) => value instanceof File && !fileInputKeys.includes(key))) {
      console.error("Form data contains an unexpected File object.");
      event.target.reportValidity();
      return;
    }

    // Get data series as an array of numbers in string format, the actual parsing is done by the API
    const dataSeries = getDataSeries(form);

    // Extract baseline data series (if any)
    const baselineDataSeriesArray = getDataSeries(form, "baselineDataSeries");
    const baselineDataSeries = baselineDataSeriesArray.length > 0 ? baselineDataSeriesArray : undefined; // Omit if empty

    // Get scaling recipe for combined/inherited goals
    const recipeString = formData.get("resultingRecipe") as string | null;
    let parsedRecipe: Recipe | null = null;
    if (recipeString) {
      try {
        parsedRecipe = recipeFromUnknown(recipeString);
      }
      catch (error) {
        console.error("Failed to parse recipe from form data:", error);
        event.target.reportValidity();
        return;
      }
    }

    // TODO: deprecated - use recipes instead
    // Build inheritFrom array (for inherited/combined goals)
    const inheritFrom: { id: string, isInverted?: boolean }[] = [];
    formData.getAll("inheritFrom")?.forEach((id) => {
      if (id instanceof File) {
        return;
      } else if (formData.getAll("invert-inherit")?.includes(id)) {
        inheritFrom.push({ id: id, isInverted: true });
        return;
      } else {
        inheritFrom.push({ id: id });
      }
    })

    // Parse the unit (if provided)
    let parsedUnit: string | null = null;
    try {
      parsedUnit = mathjs.unit((form.namedItem("dataUnit") as HTMLInputElement)?.value).toString();
    } catch {
      console.log("Failed to parse unit. Using raw string instead, which may disable some features.");
    }

    // Build the JSON payload for the API
    let formContent: GoalCreateInput | GoalUpdateInput;
    if (currentGoal) {
      formContent = {
        goalId: currentGoal.id,
        timestamp: timestamp, // Only needed for edits

        name: formData.get("goalName") as string | null || undefined,
        description: formData.get("description") as string | null ?? undefined,
        indicatorParameter: formData.get("indicatorParameter") as string | null ?? undefined,
        isFeatured: (form.namedItem('isFeatured') as HTMLInputElement)?.checked ?? undefined,

        externalDataset: undefined,
        externalTableId: undefined,
        externalSelection: undefined,

        // TODO: Add a way to clear recipe
        recipeUsed: parsedRecipe || undefined,

        rawDataSeries: dataSeries || undefined,
        // TODO: Add a toggle isUnitless to the form, which sets dataUnit to null if checked
        rawDataSeriesUnit: parsedUnit || formData.get("dataUnit") as string | null || undefined,
        // TODO: Add a way to clear baseline
        rawBaselineDataSeries: baselineDataSeries,
        rawBaselineDataSeriesUnit: baselineDataSeries ? parsedUnit || formData.get("dataUnit") as string | null || undefined : undefined,

        roadmapId: undefined, // Can't reassign the roadmap of an existing goal
        rawTags: undefined, // TODO: add tags input

        // DEPRECATED - moved to description
        links: undefined,
      }
    } else {
      formContent = {
        goalId: undefined, // Ignored when creating
        timestamp: undefined, // Ignored when creating

        name: formData.get("goalName") as string | null || null,
        description: formData.get("description") as string | null || null,
        indicatorParameter: formData.get("indicatorParameter") as string | null ?? (event.target.reportValidity(), ""),
        isFeatured: (form.namedItem('isFeatured') as HTMLInputElement)?.checked || false,

        // Goals are currently created without historical data (external data), but the API can handle it if we change this later
        externalDataset: null,
        externalTableId: null,
        externalSelection: null,

        recipeUsed: parsedRecipe,

        rawDataSeries: dataSeries,
        // TODO: Add a toggle isUnitless to the form, which sets dataUnit to null if checked
        rawDataSeriesUnit: parsedUnit || formData.get("dataUnit") as string | null || undefined,
        rawBaselineDataSeries: baselineDataSeries,
        rawBaselineDataSeriesUnit: baselineDataSeries ? parsedUnit || formData.get("dataUnit") as string | null || undefined : undefined,

        roadmapId: roadmapId || (typeof formData.get("roadmapId") == "string" ? formData.get("roadmapId") as string : (event.target.reportValidity(), "")),
        rawTags: undefined, // TODO: add tags input

        // DEPRECATED - moved to description
        links: undefined,
      }
    }

    const formJSON = JSON.stringify(formContent);

    // Submit the form to the API (POST for new, PUT for edit)
    formSubmitter('/api/goal', formJSON, currentGoal ? 'PUT' : 'POST', t);
  }

  // Prepare data series string for default value (if editing)
  const dataArray: (number | null)[] = []
  if (currentGoal?.dataSeries) {
    for (const i of Years) {
      dataArray.push(currentGoal.dataSeries[i])
    }
  }
  const dataSeriesString = dataArray.join(';')

  // Prepare baseline data series string for default value (if editing)
  const baselineArray: (number | null)[] = []
  if (currentGoal?.baselineDataSeries) {
    for (const i of Years) {
      baselineArray.push(currentGoal.baselineDataSeries[i])
    }
  }
  const baselineString = baselineArray.join(';')

  // Index for data-position attribute in legend elements (for accessibility)
  let positionIndex = 1;

  const testFetchChildrenNested = async (): Promise<Array<testTreeItem>> => {
    // You could fetch from an API here instead of hardcoding
    return [
      { name: "Item 5.1.1", value: "5-1-2", expanded: null },
      { name: "Item 5.1.2", value: "5-1-2", expanded: null },
    ];
  };

  const testFetchChildren = async (): Promise<Array<testTreeItem>> => {
    // You could fetch from an API here instead of hardcoding
    return [
      { name: "Item 5.1", value: "5-1", expanded: false, onExpand: testFetchChildrenNested },
      { name: "Item 5.2", value: "5-2", expanded: null },
    ];
  };

  return (
    <>
      <form onSubmit={handleSubmit} name="goalForm">
        {/* This hidden submit button prevents submitting by pressing enter, to avoid accidental submission */}
        <button type="submit" disabled={true} className="display-none" aria-hidden={true} />

        {/* Allow user to select parent roadmap if not already selected */}
        {!(roadmapId || currentGoal?.roadmapId) ?
          <fieldset className={`${styles.timeLineFieldset} width-100`}>
            <legend data-position={positionIndex++} className={`${styles.timeLineLegend} font-weight-bold`}>{t("forms:goal.choose_relationship")}</legend>
            <label className="margin-block-100">
              {t("forms:goal.relationship_label")}
              <select name="roadmapId" id="roadmapId" required className="margin-block-25" defaultValue={""}>
                <option value="" disabled>{t("forms:goal.relationship_no_chosen")}</option>
                {roadmapAlternatives.map(roadmap => (
                  <option key={roadmap.id} value={roadmap.id}>
                    {`${roadmap.metaRoadmap.name} (v${roadmap.version}): ${t("forms:goal.goal_count", { count: roadmap._count.goals })}`}
                  </option>
                ))}
              </select>
            </label>
          </fieldset>
          : null
        }

        {/* Goal name and description */}
        <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
          <legend data-position={positionIndex++} className={`${styles.timeLineLegend} padding-block-100 font-weight-bold`}>{t("forms:goal.goal_description_legend")}</legend>
          <label className="margin-bottom-100">
            {t("forms:goal.goal_name")}
            <input className="margin-block-25" type="text" name="goalName" id="goalName" defaultValue={currentGoal?.name ?? undefined} />
          </label>

          <label className="margin-block-100">
            {t("forms:goal.goal_description")}
            <textarea className="margin-block-25" name="description" id="description" defaultValue={currentGoal?.description ?? undefined}></textarea>
          </label>
        </fieldset>

        {/* Data series type selection (static, inherited, combined) */}
        <fieldset className={`${styles.timeLineFieldset} width-100 ${positionIndex > 1 ? "margin-top-200" : ""}`}>
          <legend data-position={positionIndex++} className={`${styles.timeLineLegend}  font-weight-bold`}>{t("forms:goal.data_series_type_legend")}</legend>
          <label className="margin-block-100">
            {t("forms:goal.data_series_type_label")}
            <select name="dataSeriesType" id="dataSeriesType" className="margin-block-25" required
              defaultValue={defaultDataSeriesType}
              onChange={(e) => setDataSeriesType(e.target.value as DataSeriesType)}
            >
              <option value={DataSeriesType.Static}>{t("forms:goal.data_series_types.static")}</option>
              <option value={DataSeriesType.Inherited}>{t("forms:goal.data_series_types.inherited")}</option>
              <option value={DataSeriesType.Combined}>{t("forms:goal.data_series_types.combined")}</option>
            </select>
          </label>
        </fieldset>

        {/* Data series input section (varies by type) */}
        <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
          <legend data-position={positionIndex++} className={`${styles.timeLineLegend} padding-block-100 font-weight-bold`}>{t("forms:goal.choose_goal_data_series")}</legend>

          <div className="margin-bottom-500 padding-bottom-500">
            <TestTreeSelect
              treeItems={[
                { name: "Item 1", value: '1', expanded: false, childNodes: [{ name: 'Item 1.1', value: 'Item 1.1', expanded: null }] },
                { name: "Item 2", value: '2', expanded: null },
                { name: "Item 3", value: '3', expanded: null },
                { name: "Item 4", value: '4', expanded: null },
                { name: "Item 5", value: '5', expanded: false, onExpand: testFetchChildren }
              ]}
            />
          </div>

          <label htmlFor="test-tree">test</label>
          <SelectSingleTreeSearch
            props={{
              className: "margin-bottom-500",
              id: "test-tree",
              name: "test-tree",
            }}
            treeItems={[
              { name: 'treeitem 1', value: 'treeitem 1', expanded: false, childNodes: [] },
              {
                name: 'treeitem 2', value: 'treeitem 2', expanded: false, childNodes: [
                  { name: 'treeitem 2.1', value: 'treeitem 2.1', expanded: false, childNodes: [] },
                  {
                    name: 'treeitem 2.2', value: 'treeitem 2.2', expanded: false, childNodes: [
                      { name: 'treeitem 2.2.1', value: 'treeitem 2.2.1', expanded: false, childNodes: [] },
                      { name: 'treeitem 2.2.2', value: 'treeitem 2.2.2', expanded: false, childNodes: [] },
                      { name: 'treeitem 2.2.3', value: 'treeitem 2.2.3', expanded: false, childNodes: [] },
                    ]
                  },
                  { name: 'treeitem 2.3', value: 'treeitem 2.3', expanded: false, childNodes: [] },
                  { name: 'treeitem 2.4', value: 'treeitem 2.4', expanded: false, childNodes: [] }
                ]
              },
              { name: 'treeitem 3', value: 'treeitem 3', expanded: false, childNodes: [] },
              {
                name: 'treeitem 4', value: 'treeitem 4', expanded: false, childNodes: [
                  { name: 'treeitem 4.1', value: 'treeitem 4.1', expanded: false, childNodes: [] },
                  { name: 'treeitem 4.2', value: 'treeitem 4.2', expanded: false, childNodes: [] },
                  { name: 'treeitem 4.3', value: 'treeitem 4.3', expanded: false, childNodes: [] }
                ]
              },
              { name: 'treeitem 5', value: 'treeitem 5', expanded: false, childNodes: [] }
            ]}
          />

          {(dataSeriesType === DataSeriesType.Static || !dataSeriesType) &&
            <ManualGoalForm currentGoal={currentGoal} dataSeriesString={dataSeriesString} />
          }

          {/* Scaling section for inherited/combined goals */}
          {/* TODO: Show different suggested recipes depending on which DataSeriesType is selected or just change the type to "Manual" and "Recipe" */}
          {(dataSeriesType === DataSeriesType.Inherited || dataSeriesType === DataSeriesType.Combined) &&
            <RecipeContextProvider>
              <RecipeSuggestions suggestedRecipes={[
                // TODO: actually create proper hashes
                // TODO: Localize the variable names
                // TODO: Create these in seed and get them from the database
                { // Default scaling recipe
                  hash: "atotallycoolhashthefirst",
                  recipe: {
                    name: t("forms:goal.default_scaling_recipe"),
                    eq: "${serie} * ${skalär}",
                    variables: {
                      "serie": {
                        type: RecipeDataTypes.DataSeries,
                        link: null,
                        pick: VectorIndexPickerOptions.Default,
                        unit: undefined, // No unit specified
                      },
                      "skalär": {
                        type: RecipeDataTypes.Scalar,
                        value: 0.5,
                        unit: null, // Unitless
                      }
                    }
                  },
                },
                { // Default combination recipe
                  hash: "recipe_with_combination",
                  recipe:
                  {
                    name: t("forms:goal.default_combination_recipe"),
                    eq: "${serie1} * ${skalär1} + ${serie2} * ${skalär2}",
                    variables: {
                      "serie1": {
                        type: RecipeDataTypes.DataSeries,
                        link: null,
                        pick: VectorIndexPickerOptions.Default,
                        unit: undefined, // No unit specified
                      },
                      "skalär1": {
                        type: RecipeDataTypes.Scalar,
                        value: 0.5,
                        unit: null, // Unitless
                      },
                      "serie2": {
                        type: RecipeDataTypes.DataSeries,
                        link: null,
                        pick: VectorIndexPickerOptions.Default,
                        unit: undefined, // No unit specified
                      },
                      "skalär2": {
                        type: RecipeDataTypes.Scalar,
                        value: 0.5,
                        unit: null, // Unitless
                      },
                    }
                  }
                },
                { // Testing recipe with external data
                  hash: "recipe_with_external",
                  recipe:
                  {
                    name: "Recipe with external data",
                    eq: "${extern}",
                    variables: {
                      "extern": {
                        type: RecipeDataTypes.External,
                        dataset: "SCB",
                        tableId: "TAB6420",
                        selection: [
                          // Selected area
                          { variableCode: "Region", valueCodes: ["00"] },
                          // Specifically land areas, not including water
                          { variableCode: "ArealTyp", valueCodes: ["01"] },
                          // Magic string to get area sizes in square kilometers (as opposed to hectares with "000007E1")
                          { variableCode: "ContentsCode", valueCodes: ["000007DY"] },
                          // // Use the latest time period
                          // { variableCode: "Tid", valueCodes: ["TOP(1)"] }
                        ],
                        pick: VectorIndexPickerOptions.Last,
                        unit: undefined,
                      }
                    }
                  }
                },
                { // Mathjs shenanigans TODO - remove this cause it's stupid
                  hash: "recipe_with_mathjs",
                  recipe: {
                    name: "Mathjs shenanigans",
                    eq: "map([1,2,3], [][(![]+[])[+!+[]]+(!![]+[])[+[]]][([][(![]+[])[+!+[]]+(!![]+[])[+[]]]+[])[!+[]+!+[]+!+[]]+(!![]+[][(![]+[])[+!+[]]+(!![]+[])[+[]]])[+!+[]+[+[]]]+([][[]]+[])[+!+[]]+(![]+[])[!+[]+!+[]+!+[]]+(!![]+[])[+[]]+(!![]+[])[+!+[]]+([][[]]+[])[+[]]+([][(![]+[])[+!+[]]+(!![]+[])[+[]]]+[])[!+[]+!+[]+!+[]]+(!![]+[])[+[]]+(!![]+[][(![]+[])[+!+[]]+(!![]+[])[+[]]])[+!+[]+[+[]]]+(!![]+[])[+!+[]]]((!![]+[])[+!+[]]+(!![]+[])[!+[]+!+[]+!+[]]+(!![]+[])[+[]]+([][[]]+[])[+[]]+(!![]+[])[+!+[]]+([][[]]+[])[+!+[]]+(+[![]]+[][(![]+[])[+!+[]]+(!![]+[])[+[]]])[+!+[]+[+!+[]]]+(!![]+[])[!+[]+!+[]+!+[]]+(+(!+[]+!+[]+!+[]+[+!+[]]))[(!![]+[])[+[]]+(!![]+[][(![]+[])[+!+[]]+(!![]+[])[+[]]])[+!+[]+[+[]]]+([]+[])[([][(![]+[])[+!+[]]+(!![]+[])[+[]]]+[])[!+[]+!+[]+!+[]]+(!![]+[][(![]+[])[+!+[]]+(!![]+[])[+[]]])[+!+[]+[+[]]]+([][[]]+[])[+!+[]]+(![]+[])[!+[]+!+[]+!+[]]+(!![]+[])[+[]]+(!![]+[])[+!+[]]+([][[]]+[])[+[]]+([][(![]+[])[+!+[]]+(!![]+[])[+[]]]+[])[!+[]+!+[]+!+[]]+(!![]+[])[+[]]+(!![]+[][(![]+[])[+!+[]]+(!![]+[])[+[]]])[+!+[]+[+[]]]+(!![]+[])[+!+[]]][([][[]]+[])[+!+[]]+(![]+[])[+!+[]]+((+[])[([][(![]+[])[+!+[]]+(!![]+[])[+[]]]+[])[!+[]+!+[]+!+[]]+(!![]+[][(![]+[])[+!+[]]+(!![]+[])[+[]]])[+!+[]+[+[]]]+([][[]]+[])[+!+[]]+(![]+[])[!+[]+!+[]+!+[]]+(!![]+[])[+[]]+(!![]+[])[+!+[]]+([][[]]+[])[+[]]+([][(![]+[])[+!+[]]+(!![]+[])[+[]]]+[])[!+[]+!+[]+!+[]]+(!![]+[])[+[]]+(!![]+[][(![]+[])[+!+[]]+(!![]+[])[+[]]])[+!+[]+[+[]]]+(!![]+[])[+!+[]]]+[])[+!+[]+[+!+[]]]+(!![]+[])[!+[]+!+[]+!+[]]]](!+[]+!+[]+!+[]+[!+[]+!+[]])+(![]+[])[+!+[]]+(![]+[])[!+[]+!+[]])()((![]+[])[+!+[]]+(![]+[])[!+[]+!+[]]+(!![]+[])[!+[]+!+[]+!+[]]+(!![]+[])[+!+[]]+(!![]+[])[+[]]+([][(![]+[])[+!+[]]+(!![]+[])[+[]]]+[])[+!+[]+[+!+[]]]+[+!+[]]+([]+[]+[][(![]+[])[+!+[]]+(!![]+[])[+[]]])[+!+[]+[!+[]+!+[]]]))",
                    variables: {
                      "[object Object]": {
                        type: RecipeDataTypes.Scalar,
                        value: 0.5,
                        unit: null,
                      }
                    },
                  }
                }
              ]} />

              <RecipeEquationEditor />

              <RecipeErrorAndWarnings />

              <RecipeVariableEditor
                allowAddVariables
                allowDeleteVariables
                allowNameEditing
                allowTypeEditing
                allowValueEditing
              />

              <label className="width-100">
                <ResultingDataSeries FormElement={<input type="hidden" name="resultingDataSeries" />} />
              </label>
              <label className="width-100">
                <ResultingRecipe FormElement={<input type="hidden" name="resultingRecipe" />} />
              </label>

              <DEBUG_Recipe />
            </RecipeContextProvider>
          }
        </fieldset>

        {/* Baseline selection section */}
        <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
          <legend data-position={positionIndex++} className={`${styles.timeLineLegend} font-weight-bold padding-block-100`}>{t("forms:goal.choose_baseline_for_actions")}</legend>
          <label className="margin-bottom-100">
            {t("forms:goal.baseline_label")}
            <select className="margin-block-25" name="baselineSelector" id="baselineSelector" value={baselineType} onChange={(e) => setBaselineType(e.target.value as BaselineType)}>
              <option value={BaselineType.Initial}>{t("forms:goal.baseline_types.initial")}</option>
              <option value={BaselineType.Custom}>{t("forms:goal.baseline_types.custom")}</option>
              <option value={BaselineType.Inherited}>{t("forms:goal.baseline_types.inherited")}</option>
            </select>
          </label>

          {/* Custom baseline input */}
          {baselineType === BaselineType.Custom &&
            <DataSeriesInput
              dataSeriesString={baselineString}
              inputName="baselineDataSeries"
              inputId="baselineDataSeries"
              labelKey="forms:data_series_input.custom_baseline"
            />
          }

          {/* Inherited baseline input */}
          {baselineType === BaselineType.Inherited &&
            <InheritingBaseline />
          }
        </fieldset>

        {/* External links section */}
        <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
          <legend data-position={positionIndex++} className={`${styles.timeLineLegend} padding-block-100 font-weight-bold`}>{t("forms:goal.feature_this_goal")}</legend>
          <label className="flex align-items-center gap-50 margin-block-50">
            <input type="checkbox" name="isFeatured" id="isFeatured" defaultChecked={currentGoal?.isFeatured} />
            {t("forms:goal.feature_goal")}
          </label>
        </fieldset >

        {/* Submit button */}
        < input type="submit" className="margin-block-200 seagreen color-purewhite" value={currentGoal ? t("common:tsx.save") : t("common:tsx.create")} />
      </form >

      {/* Datalist for indicator parameter suggestions */}
      < datalist id="LEAPOptions" >
        {/* Use all unique entries as suggestions for indicator parameter */}
        {
          parameterOptions.filter((option, index, self) => {
            return self.indexOf(option) === index
          }).map((option) => {
            return (
              <option key={`option-${option}`} value={option} />
            )
          })
        }
      </datalist >
    </>
  )
}