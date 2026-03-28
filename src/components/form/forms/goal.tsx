'use client';

import type { getRoadmaps } from "@/fetchers";
import formSubmitter from "@/functions/formSubmitter";
import { isDateValuesWithUnit, isISOIshDate } from "@/types";
import type { DateValuesWithUnit, Goal, GoalCreateInput, GoalUpdateInput } from "@/types";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import DateValuesInput from "../elements/dataSeriesInput/dateValuesInput";
import styles from '../forms.module.css';
import { InheritingBaseline, ManualGoalForm } from "../sections/goalFormSections";
import type { Recipe } from "@/functions/recipe/types";
import TextEditor from "../elements/textEditor/editor";
import { CustomRecipeContext, SuggestedRecipeContext } from "@/components/recipe/suggestions/suggestedRecipeToggle";
import SelectSingleSearch from "../elements/combobox/selectSingleSearch";
import FormIntegration from "@/components/recipe/editor/output/formIntegration";
import { SmartRecipe } from "@/functions/recipe/smartRecipe";

const DataSeriesType = {
  Manual: "Manual",
  Suggested: "Suggested",
  Custom: "Custom",
} as const;
type DataSeriesType = (typeof DataSeriesType)[keyof typeof DataSeriesType];

const BaselineType = {
  Initial: "Initial",
  InitialNonZero: "InitialNonZero",
  Custom: "Custom",
  Inherited: "Inherit",
} as const;
type BaselineType = (typeof BaselineType)[keyof typeof BaselineType];

export default function GoalForm({
  roadmapId,
  roadmapAlternatives,
  currentGoal,
}: {
  roadmapId?: string,
  roadmapAlternatives: Awaited<ReturnType<typeof getRoadmaps>>,
  currentGoal?: Goal;
}) {
  const { t } = useTranslation(["forms", "common"]);
  const [dataSeriesType, setDataSeriesType] = useState<DataSeriesType>(DataSeriesType.Suggested);
  const [baselineType, setBaselineType] = useState<BaselineType>(currentGoal?.baseline ? BaselineType.Custom : BaselineType.Initial);
  const [parentRoadmapId, setParentRoadmapId] = useState<string>(roadmapId || "");
  const descriptionRef = useRef<HTMLInputElement>(null);

  const parentRoadmaps = useMemo(() => {
    return (roadmapAlternatives ?? []).map(roadmap => ({
      name: t("common:roadmap_version_name", { name: roadmap.metaRoadmap.name, version: roadmap.version }),
      value: roadmap.id
    }));
  }, [roadmapAlternatives, t]);

  const [timestamp] = useState(() => Date.now());

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

    // Parse recipe (optional)
    let dataSeriesRecipe: Recipe | undefined = undefined;
    const resultingRecipeString = formData.get("resultingRecipe") as string | null;
    if (resultingRecipeString) {
      try {
        dataSeriesRecipe = SmartRecipe.fromSerialized(resultingRecipeString).toRecipe();
      } catch (e) {
        console.error("Failed to parse resulting recipe from form:", e);
        event.target.reportValidity();
        return;
      }
    }

    // Parse date values (required)
    const resultingDateValuesString = formData.get("resultingDateValues") as string | null || formData.get("data-series") as string | null; // Fallback for manual data series input
    if (!resultingDateValuesString) {
      console.error("No resulting date values provided in form.");
      event.target.reportValidity();
      return;
    }
    let dataSeries: DateValuesWithUnit | undefined = undefined;
    try {
      dataSeries = JSON.parse(resultingDateValuesString) as DateValuesWithUnit;
    } catch (e) {
      console.error("Failed to parse resulting date values from form:", e);
      event.target.reportValidity();
      return;
    }
    // Validate parsed date values
    if (
      !dataSeries
      || !isDateValuesWithUnit(dataSeries)
    ) {
      console.error("Parsed date values from form are invalid:", dataSeries);
      event.target.reportValidity();
      return;
    }

    let baseline: DateValuesWithUnit | undefined = undefined;
    let baselineId: string | undefined = undefined;
    if (baselineType === BaselineType.Custom) {
      const baselineString = formData.get("baseline-data-series") as string | null;
      if (baselineString) {
        try {
          baseline = JSON.parse(baselineString) as DateValuesWithUnit;
        } catch (e) {
          console.error("Failed to parse baseline date values from form:", e);
          event.target.reportValidity();
          return;
        }
      }
    }
    else if (
      baselineType === BaselineType.Initial
      || baselineType === BaselineType.InitialNonZero
    ) {
      // Use the first value of the data series as the baseline
      const dates = Object.keys(dataSeries.dateValues).sort();
      if (!dates.every(isISOIshDate)) throw new Error("Dates in data series are not in a valid ISO-ish format.");
      if (dates.length === 0) {
        console.error("Cannot use initial baseline when data series is empty.");
        event.target.reportValidity();
        return;
      }

      baseline = {
        unit: dataSeries.unit,
        dateValues: {},
      } satisfies DateValuesWithUnit;

      const firstDateValue = baselineType === BaselineType.InitialNonZero
        ? dataSeries.dateValues[dates.find(date => dataSeries.dateValues[date] !== 0) || dates[0]]
        : dataSeries.dateValues[dates[0]]

      for (const date of dates) {
        baseline.dateValues[date] = firstDateValue;
      }
    }
    else if (baselineType === BaselineType.Inherited) {
      const inheritedBaselineId = formData.get("inherited-baseline-id") as string | null;
      if (inheritedBaselineId) {
        baselineId = inheritedBaselineId;
      }
      else {
        console.error("No inherited baseline ID provided in form.");
        event.target.reportValidity();
        return;
      }
    }
    // Throw if baseline is missing on create
    if (!currentGoal && !baseline && !baselineId) {
      console.error("No baseline provided for new goal.");
      event.target.reportValidity();
      return;
    }

    // Build the JSON payload for the API
    let formContent: GoalCreateInput | GoalUpdateInput;
    if (!currentGoal && (baseline || baselineId)) {
      // Create
      formContent = {
        goalId: undefined, // Ignored when creating
        timestamp: undefined, // Ignored when creating

        name: formData.get("goalName") as string | null ?? null,
        description: formData.get("description") as string | null ?? null, // Use the hidden input for the description, which contains the latest editor content
        indicatorParameter: formData.get("indicatorParameter") as string | null ?? (event.target.reportValidity(), ""),
        isFeatured: (form.namedItem('isFeatured') as HTMLInputElement)?.checked || false,
        recipeSuggestions: undefined, // TODO: add recipe suggestions input

        // Goals are currently created without historical data (external data), but the API can handle it if we change this later
        externalDataset: null,
        externalTableId: null,
        externalSelection: null,

        dataSeriesId: null,
        dataSeries: dataSeries,
        dataSeriesRecipeId: null,
        dataSeriesRecipe: dataSeriesRecipe ?? null,

        baselineId: baselineId,
        baseline: baseline,
        baselineRecipeId: null,
        baselineRecipe: null,

        roadmapId: roadmapId || parentRoadmapId,
        rawTags: undefined, // TODO: add tags input

        // DEPRECATED - moved to description
        links: undefined,
      } satisfies GoalCreateInput;
    }
    else if (currentGoal) {
      // Update
      formContent = {
        goalId: currentGoal.id,
        timestamp: timestamp, // Only needed for edits

        name: formData.get("goalName") as string | null ?? undefined,
        description: formData.get("description") as string | null ?? undefined, // Use the hidden input for the description, which contains the latest editor content
        indicatorParameter: formData.get("indicatorParameter") as string | null ?? undefined,
        isFeatured: (form.namedItem('isFeatured') as HTMLInputElement)?.checked ?? undefined,
        recipeSuggestions: undefined, // TODO: add recipe suggestions input

        externalDataset: undefined,
        externalTableId: undefined,
        externalSelection: undefined,

        dataSeriesId: undefined,
        dataSeries: dataSeries,
        dataSeriesRecipeId: undefined,
        dataSeriesRecipe: dataSeriesRecipe,

        baselineId: baselineId,
        baseline: baseline,
        baselineRecipeId: undefined,
        baselineRecipe: undefined,

        roadmapId: undefined, // Can't reassign the roadmap of an existing goal
        rawTags: undefined, // TODO: add tags input

        // DEPRECATED - moved to description
        links: undefined,
      } satisfies GoalUpdateInput;
    }
    else {
      throw new Error("Missing data to create or update goal.");
    }

    const formJSON = JSON.stringify(formContent);

    // Submit the form to the API (POST for new, PUT for edit)
    formSubmitter('/api/goal', formJSON, currentGoal ? 'PUT' : 'POST', t);
  }

  // Index for data-position attribute in legend elements (for accessibility)
  let positionIndex = 1;

  return (
    <>
      <form onSubmit={handleSubmit} name="goalForm">
        {/* This hidden submit button prevents submitting by pressing enter, to avoid accidental submission */}
        <button type="submit" disabled={true} className="display-none" aria-hidden={true} />

        {/* Allow user to select parent roadmap if not already selected */}
        {!(roadmapId || currentGoal?.roadmapId) ?
          <fieldset className={`${styles.timeLineFieldset} width-100`}>
            <legend data-position={positionIndex++} className={`${styles.timeLineLegend} padding-block-125 font-weight-bold`}>{t("forms:goal.choose_relationship")}</legend>
            <label htmlFor="parent-roadmap">{t("forms:goal.relationship_label")}</label>
            <SelectSingleSearch
              props={{
                required: true,
                className: "margin-top-25 margin-bottom-100",
                id: "parent-roadmap",
                name: "parent-roadmap",
                placeholder: `${t("common:tsx.select")}  ${t("common:roadmap_series_one")}`,
              }}
              onChange={(value) => value?.value ? setParentRoadmapId(value.value) : setParentRoadmapId("")}
              options={parentRoadmaps}
            />
          </fieldset>
          : null
        }

        {/* Goal name and description */}
        <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
          <legend data-position={positionIndex++} className={`${styles.timeLineLegend} padding-block-125 font-weight-bold`}>{t("forms:goal.goal_description_legend")}</legend>
          <label>
            {t("forms:goal.goal_name")}
            <input className="margin-top-25 margin-bottom-100" type="text" name="goalName" id="goalName" defaultValue={currentGoal?.name ?? undefined} />
          </label>

          <label id="description-label">{t("forms:goal.goal_description")}</label>
          <TextEditor
            className="margin-top-25 margin-bottom-100" // TODO: Need label for textEditorMenu
            id="description"
            ariaLabelledBy="description-label"
            placeholder={t("forms:text_editor_menu.default_placeholder")}
            editable={true}
            content={currentGoal ? currentGoal.description : ""}
            onChange={(json) => descriptionRef.current ? descriptionRef.current.value = JSON.stringify(json) : null}
          />
          {/* hidden input containing the text editor output */}
          <input ref={descriptionRef} type="hidden" name="description" />
        </fieldset>

        {/* Data series input section */}
        <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
          <legend data-position={positionIndex++} className={`${styles.timeLineLegend} padding-block-125 font-weight-bold`}>{t("forms:goal.choose_goal_data_series")}</legend>

          {/* Radio group */}
          <fieldset className="border-none padding-0 margin-0 margin-bottom-100" role="radiogroup" aria-label={t("forms:goal.choose_goal_data_series")}>
            <label className="flex align-items-center gap-50 margin-bottom-50">
              <input
                type="radio"
                name="dataSeriesType"
                value={DataSeriesType.Suggested}
                checked={dataSeriesType === DataSeriesType.Suggested}
                onChange={(e) => setDataSeriesType(e.target.value as DataSeriesType)}
              />
              {t("forms:goal.suggested_inheritance")}
            </label>
            <label className="flex align-items-center gap-50 margin-bottom-50">
              <input
                type="radio"
                name="dataSeriesType"
                value={DataSeriesType.Custom}
                checked={dataSeriesType === DataSeriesType.Custom}
                onChange={(e) => setDataSeriesType(e.target.value as DataSeriesType)}
              />
              {t("forms:goal.custom_recipe")}
            </label>
            <label className="flex align-items-center gap-50 margin-bottom-50">
              <input
                type="radio"
                name="dataSeriesType"
                value={DataSeriesType.Manual}
                checked={dataSeriesType === DataSeriesType.Manual}
                onChange={(e) => setDataSeriesType(e.target.value as DataSeriesType)}
              />
              {t("forms:goal.static_data_series")}
            </label>
          </fieldset>

          {/* Suggested */}
          <SuggestedRecipeContext hidden={dataSeriesType !== DataSeriesType.Suggested}>
            <FormIntegration
              RecipeFormElement={<input name="resultingRecipe" />}
              DateValuesFormElement={<input name="resultingDateValues" />}
            />
          </SuggestedRecipeContext>

          {/* Recipe */}
          <CustomRecipeContext hidden={dataSeriesType !== DataSeriesType.Custom}>
            <FormIntegration
              RecipeFormElement={<input name="resultingRecipe" />}
              DateValuesFormElement={<input name="resultingDateValues" />}
            />
          </CustomRecipeContext>

          {/* Manual */}
          <div className={`${dataSeriesType === DataSeriesType.Manual ? "" : "display-none"}`}>
            <ManualGoalForm
              currentGoal={currentGoal}
              outputFormElement={<input name="data-series" />}
            />
          </div>
        </fieldset>

        {/* Baseline selection section */}
        <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
          <legend
            data-position={positionIndex++}
            className={`${styles.timeLineLegend} padding-block-125 font-weight-bold`}
          >
            {t("forms:goal.choose_baseline_for_actions")}
          </legend>

          <label>
            {t("forms:goal.baseline_label")}
            <select className="block margin-top-25 margin-bottom-100" name="baselineSelector" id="baselineSelector" value={baselineType} onChange={(e) => setBaselineType(e.target.value as BaselineType)}>
              <option value={BaselineType.Initial}>{t("forms:goal.baseline_types.initial")}</option>
              <option value={BaselineType.InitialNonZero}>{t("forms:goal.baseline_types.initial_non_zero")}</option>
              <option value={BaselineType.Custom}>{t("forms:goal.baseline_types.custom")}</option>
              <option value={BaselineType.Inherited}>{t("forms:goal.baseline_types.inherited")}</option>
            </select>
          </label>

          {/* Custom baseline input */}
          {baselineType === BaselineType.Custom &&
            <DateValuesInput
              outputFormElement={<input name="baseline-data-series" />}
              label={t("forms:data_series_input.custom_baseline")}
            />
          }

          {/* Inherited baseline input */}
          {baselineType === BaselineType.Inherited &&
            <InheritingBaseline
              outputFormElement={<input name="inherited-baseline-id" />}
            />
          }
        </fieldset>

        {/* TODO suggested recipes to inherit with */}

        {/* External links section */}
        <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
          <legend
            // Technically incrementing here is unused but if you add a another entry after this one it will be correct
            // eslint-disable-next-line @/no-useless-assignment
            data-position={positionIndex++}
            className={`${styles.timeLineLegend} padding-block-125 font-weight-bold`}
          >
            {t("forms:goal.feature_this_goal")}
          </legend>
          <label className="flex align-items-center gap-50 margin-bottom-100">
            <input type="checkbox" name="isFeatured" id="isFeatured" defaultChecked={currentGoal?.isFeatured} />
            {t("forms:goal.feature_goal")}
          </label>
        </fieldset >

        {/* Submit button */}
        <div className="margin-top-400 padding-top-100 margin-bottom-100" style={{ borderTop: '1px solid var(--gray-80)' }}>
          <button
            className="text-align-center seagreen color-purewhite width-100"
            style={{ fontSize: '14px', transform: 'none' }}
            type="submit"
            id="submit-button"
          >
            {currentGoal ? t("common:tsx.save") : t("forms:goal.create")}
          </button>
        </div>
      </form >
    </>
  )
}