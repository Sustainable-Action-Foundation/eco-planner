/*
GoalForm Component (React, TypeScript)
======================================

Summary:
--------
This file defines the main form for creating and editing "Goal" objects in the eco-planner app. It supports static, inherited, and combined goal types, as well as custom scaling, baseline data, and external links. The form is highly dynamic, adapting its fields and logic based on the current goal and user selections. It uses i18n for translations, and integrates with several sub components for modularity. The form's structure and submission logic are tightly coupled to the shape of the Goal object in the database, so any changes to the Goal schema require updates here.

Key Features:
- Handles three goal types: Static, Inherited, Combined
- Supports custom scaling recipes and methods
- Allows selection of baseline data (initial, custom, inherited)
- Integrates with roadmap selection and external links
- Uses modular sub components for complex form sections
- Submits data as JSON to the API, with careful handling of optional/complex fields
- Uses i18n for all user-facing text
- Designed for extensibility and maintainability
*/

'use client';

// Import dependencies and sub components
import LinkInput, { getLinks } from "@/components/forms/linkInput/linkInput"; // For handling external links
import type getRoadmaps from "@/fetchers/getRoadmaps.ts"; // Type for roadmap fetching
import formSubmitter from "@/functions/formSubmitter"; // Handles form submission to API
import parameterOptions from "@/lib/LEAPList.json" with { type: "json" }; // Options for indicator parameter
import mathjs from "@/math"; // Math library for unit parsing
import { GoalCreateInput, dataSeriesDataFieldNames } from "@/types"; // Types and helpers
import { DataSeries, Goal } from "@prisma/client"; // Prisma types
import { useMemo, useState, useEffect } from "react"; // React hooks
import { useTranslation } from "react-i18next"; // i18n hook
import DataSeriesInput from "../dataSeriesInput/dataSeriesInput"; // For entering data series
import { getDataSeries } from "../dataSeriesInput/utils"; // Helper for extracting data series from form
import styles from '../forms.module.css'; // CSS module for styling
import { InheritingBaseline, ManualGoalForm } from "./goalFormSections"; // Sub components for form sections
import { DEBUG_RecipeOutput, RecipeContextProvider, RecipeEquationEditor, RecipeErrorAndWarnings, RecipeSuggestions, RecipeVariableEditor, ResultingDataSeries, ResultingRecipe } from "@/components/recipe/recipeEditor";
import { RecipeVariableType } from "@/functions/recipe-parser/types";
import clientSafeGetOneRoadmap from "@/fetchers/clientSafeGetOneRoadmap";

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
  // State for the selected roadmap (if not already fixed)
  const [selectedRoadmap, setSelectedRoadmap] = useState<string>(currentGoal?.roadmapId || roadmapId || "");
  // State for selectable data series (goals from the selected roadmap)
  const [selectableDataSeries, setSelectableDataSeries] = useState<{ id: string; name: string }[]>([]);

  // Memoized timestamp for the form submission (used for optimistic updates)
  const timestamp = useMemo(() => Date.now(), []);

  // Effect to load selectable data series when roadmap changes
  useEffect(() => {
    if (selectedRoadmap) {
      clientSafeGetOneRoadmap(selectedRoadmap)
        .then(roadmap => {
          const goals = roadmap?.goals
            .filter(goal => goal.dataSeries !== null && goal.name !== null)
            .map(goal => ({ id: goal.dataSeries!.id, name: goal.name! })) ?? [];
          setSelectableDataSeries(goals);
        })
        .catch(() => {
          setSelectableDataSeries([]);
        });
    } else {
      setSelectableDataSeries([]);
    }
  }, [selectedRoadmap]);

  // Form submission handler
  function handleSubmit(event: React.ChangeEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.target.elements;
    const formData = new FormData(event.target);

    // Extract links from the form
    const links = getLinks(event.target);

    // Extract data series (array of numbers as strings)
    const dataSeries = getDataSeries(form).map(val => val ? parseFloat(val) : null);

    // Extract baseline data series (if any)
    const baselineDataSeriesArray = getDataSeries(form, "baselineDataSeries").map(val => val ? parseFloat(val) : null);
    const baselineDataSeries = baselineDataSeriesArray.length > 0 ? baselineDataSeriesArray : undefined; // Omit if empty

    // Get scaling recipe for combined/inherited goals
    const combinationScale = formData.get("resultingRecipe");

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
    const formJSON = JSON.stringify({
      name: (form.namedItem("goalName") as HTMLInputElement)?.value || null,
      description: (form.namedItem("description") as HTMLInputElement)?.value || null,
      indicatorParameter: (form.namedItem("indicatorParameter") as HTMLInputElement)?.value || null,
      // TODO: Add a toggle isUnitless to the form, which sets dataUnit to null if checked
      dataUnit: parsedUnit || (form.namedItem("dataUnit") as HTMLInputElement)?.value,
      dataSeriesArray: dataSeries,
      baselineDataSeries: baselineDataSeries ?? null,
      combinationScale: combinationScale as string,
      inheritFrom: inheritFrom,
      roadmapId: currentGoal?.roadmapId || roadmapId || (typeof formData.get("roadmapId") == "string" ? formData.get("roadmapId") : null),
      goalId: currentGoal?.id || null,
      links,
      timestamp,
      isFeatured: (form.namedItem('isFeatured') as HTMLInputElement)?.checked,
    } as GoalCreateInput);

    // Submit the form to the API (POST for new, PUT for edit)
    formSubmitter('/api/goal', formJSON, currentGoal ? 'PUT' : 'POST', t);
  }

  // Prepare data series string for default value (if editing)
  const dataArray: (number | null)[] = []
  if (currentGoal?.dataSeries) {
    for (const i of dataSeriesDataFieldNames) {
      dataArray.push(currentGoal.dataSeries[i])
    }
  }
  const dataSeriesString = dataArray.join(';')

  // Prepare baseline data series string for default value (if editing)
  const baselineArray: (number | null)[] = []
  if (currentGoal?.baselineDataSeries) {
    for (const i of dataSeriesDataFieldNames) {
      baselineArray.push(currentGoal.baselineDataSeries[i])
    }
  }
  const baselineString = baselineArray.join(';')

  // Index for data-position attribute in legend elements (for accessibility)
  let positionIndex = 1;

  // Render the form
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
              <select name="roadmapId" id="roadmapId" required className="margin-block-25" defaultValue={""}
                onChange={(e) => setSelectedRoadmap(e.target.value)}
              >
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

          {(dataSeriesType === DataSeriesType.Static || !dataSeriesType) &&
            <ManualGoalForm currentGoal={currentGoal} dataSeriesString={dataSeriesString} />
          }

          {/* Scaling section for inherited/combined goals */}
          {(dataSeriesType === DataSeriesType.Inherited || dataSeriesType === DataSeriesType.Combined) &&
            <RecipeContextProvider
              initialRecipe={{
                eq: "[[1,2],[3,4]] * [5,NaN]",
                variables: { "Hihi": { type: RecipeVariableType.Scalar, value: 123 }, "data": { type: RecipeVariableType.DataSeries, link: null } }
              }}
            >
              <RecipeSuggestions suggestedRecipes={[
                {
                  hash: "asd", recipe: {
                    name: t("forms:goal.default_scaling_recipe"),
                    eq: "${Hihi}",
                    variables: { "Hihi": { type: RecipeVariableType.Scalar, value: 123 } }
                  },
                },
                {
                  hash: "asd2",
                  recipe:
                  {
                    name: t("forms:goal.default_combination_recipe"),
                    eq: "${Hihi} + ${Hihi}",
                    variables: { "Hihi": { type: RecipeVariableType.Scalar, value: 123 } }
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

              <DEBUG_RecipeOutput />
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
          <legend data-position={positionIndex++} className={`${styles.timeLineLegend} font-weight-bold padding-block-100`}>{t("forms:goal.attach_external_resources")}</legend>
          <LinkInput links={currentGoal?.links} />
        </fieldset>

        {/* Feature this goal section */}
        <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
          <legend data-position={positionIndex++} className={`${styles.timeLineLegend} padding-block-100 font-weight-bold`}>{t("forms:goal.feature_this_goal")}</legend>
          <label className="flex align-items-center gap-50 margin-block-50">
            <input type="checkbox" name="isFeatured" id="isFeatured" defaultChecked={currentGoal?.isFeatured} /> {/* TODO: Make toggle */}
            {t("forms:goal.feature_goal")}
          </label>
        </fieldset>

        {/* Submit button */}
        <input type="submit" className="margin-block-200 seagreen color-purewhite" value={currentGoal ? t("common:tsx.save") : t("common:tsx.create")} />
      </form>

      {/* Datalist for indicator parameter suggestions */}
      <datalist id="LEAPOptions">
        {/* Use all unique entries as suggestions for indicator parameter */}
        {parameterOptions.filter((option, index, self) => {
          return self.indexOf(option) === index
        }).map((option) => {
          return (
            <option key={`option-${option}`} value={option} />
          )
        })}
      </datalist>
    </>
  )
}