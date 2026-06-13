'use client';

import type { getRoadmaps } from "@/fetchers";
import formSubmitter from "@/functions/formSubmitter";
import mathjs, { allOurUnits } from "@/math";
import { isDateValuesWithUnit, isISOIshDate } from "@/types";
import type { DateValuesWithUnit, Goal, GoalCreateInput, GoalUpdateInput, UnitString } from "@/types";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import styles from '../forms.module.css';
import TextSingleAutocomplete from "../elements/combobox/textSingleAutocomplete";
import parameterOptions from "@/lib/LEAPList.json" with { type: "json" };
import { InheritingBaseline, ManualGoalForm } from "../sections/goalFormSections";
import TextEditor from "../elements/textEditor/editor";
import SelectSingleSearch from "../elements/combobox/selectSingleSearch";
import { Recipe } from "@/functions/recipe/recipe";
import { FormIntegration, RecipeContextProvider, RecipeEditor, SuggestedRecipeApplier } from "@/components/recipe";
import DataSeriesInputManual from "../elements/dataSeriesInput/dataSeriesInputManual";
import { useToast } from "@/components/generic/toast/toastContext.use";
import { useRouter } from "next/navigation";
import { dataSeriesToDateValues } from "@/functions/recipe";
import UnitSync from "@/components/recipe/output/unitSyncer";
import ParameterSync from "@/components/recipe/output/parameterSyncer";

const DataSeriesType = {
  Manual: "MANUAL",
  Suggested: "SUGGESTED",
  Custom: "CUSTOM",
} as const;
type DataSeriesType = (typeof DataSeriesType)[keyof typeof DataSeriesType];

const BaselineType = {
  Initial: "INITIAL",
  InitialNonZero: "INITIAL_NON_ZERO",
  Custom: "CUSTOM",
  Inherited: "INHERIT",
} as const;
type BaselineType = (typeof BaselineType)[keyof typeof BaselineType];

function resolveDataSeriesType(goal?: Goal): DataSeriesType {
  // Somehow missing
  if (!goal?.dataSeries) return DataSeriesType.Suggested;

  // Defined recipe
  if (!!goal.dataSeries.recipeUsed) {
    const recipe = Recipe.from(goal.dataSeries.recipeUsed.recipe);

    // Suggested recipe
    if (recipe.isSuggestedRecipe()) {
      return DataSeriesType.Suggested;
    }
    // Custom recipe
    else {
      return DataSeriesType.Custom;
    }
  }

  // IDK, fall back to manual input :woman_shrugging:
  return DataSeriesType.Manual;
}

function resolveBaselineType(goal?: Goal): BaselineType {
  // Default to first value for new goals
  if (!goal?.baseline) return BaselineType.Initial;

  if (!goal.baseline.recipeUsedId) {
    // Manual value input
    return BaselineType.Custom;
  } else {
    // Recipe-based
    return BaselineType.Inherited;
  }
}

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
  const [dataSeriesType, setDataSeriesType] = useState<DataSeriesType>(resolveDataSeriesType(currentGoal));
  const [hasInitializedSuggested, setHasInitializedSuggested] = useState<boolean>(() => resolveDataSeriesType(currentGoal) === DataSeriesType.Suggested);
  const [hasInitializedCustom, setHasInitializedCustom] = useState<boolean>(() => resolveDataSeriesType(currentGoal) === DataSeriesType.Custom);
  const [baselineType, setBaselineType] = useState<BaselineType>(resolveBaselineType(currentGoal));
  const [unit, setUnit] = useState<string>(currentGoal?.dataSeries?.unit ?? "");
  const [indicatorParameter, setIndicatorParameter] = useState<string>(currentGoal?.indicatorParameter ?? "");
  const [parentRoadmapId, setParentRoadmapId] = useState<string>(roadmapId || "");
  const descriptionRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const { addToast } = useToast();

  const parentRoadmaps = useMemo(() => {
    return (roadmapAlternatives ?? []).map(roadmap => ({
      name: t("common:roadmap_version_name", { name: roadmap.metaRoadmap.name, version: roadmap.version }),
      value: roadmap.id,
    }));
  }, [roadmapAlternatives, t]);

  const [timestamp] = useState(() => Date.now());

  const [parsedUnit, setParsedUnit] = useState<UnitString>(() => {
    if (currentGoal?.dataSeries?.unit) {
      try {
        return mathjs.unit(currentGoal.dataSeries.unit).toString();
      } catch {
        return null;
      }
    }
    return null;
  });

  const indicatorParameters = useMemo(() => {
    return [...new Set(parameterOptions)].map(option => ({
      name: option,
      value: option,
    }));
  }, []);

  useEffect(() => {
    if (dataSeriesType === DataSeriesType.Suggested) {
      setHasInitializedSuggested(true);
    }

    if (dataSeriesType === DataSeriesType.Custom) {
      setHasInitializedCustom(true);
    }
  }, [dataSeriesType]);

  // TODO: Error messages were translated directly from English to Swedish when switching to toasts.
  // They can likely be translated better.
  function handleSubmit(event: React.ChangeEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.target.elements;
    const formData = new FormData(event.target);
    // List of inputs expecting a file
    const fileInputKeys: string[] = [];

    // Basic validation to ensure no unexpected File objects are present
    // Allows us to safely cast all formData values to (string | null) later
    if (formData.entries().some(([key, value]) => value instanceof File && !fileInputKeys.includes(key))) {
      addToast(t("forms:goal.errors.unexpected_file_object"), "error", false);
      event.target.reportValidity();
      return;
    }

    // Parse recipe (optional)
    let dataSeriesRecipe: Recipe | undefined = undefined;
    const resultingRecipeString = formData.get("resultingRecipe") as string | null;
    if (resultingRecipeString) {
      try {
        dataSeriesRecipe = Recipe.deserialize(resultingRecipeString);
      }
      catch (e) {
        addToast(`${t("forms:goal.errors.failed_parse_recipe")} ${e instanceof Error ? e.message : String(e)}`, "error", false);
        event.target.reportValidity();
        return;
      }
    }

    // Parse date values (required)
    const resultingDateValuesString = formData.get("resultingDateValues") as string | null || formData.get("data-series") as string | null; // Fallback for manual data series input
    if (!resultingDateValuesString) {
      addToast(t("forms:goal.errors.missing_date_values"), "error", false);
      event.target.reportValidity();
      return;
    }

    let dataSeries: DateValuesWithUnit | undefined;
    try {
      dataSeries = JSON.parse(resultingDateValuesString) as DateValuesWithUnit;
      dataSeries.unit = formData.get("dataUnit") as string | null;
    } catch (e) {
      addToast(`${t("forms:goal.errors.failed_parse_date_values")} ${e instanceof Error ? e.message : String(e)}`, "error", false);
      event.target.reportValidity();
      return;
    }

    // Validate parsed date values
    if (
      !dataSeries
      || !isDateValuesWithUnit(dataSeries)
    ) {
      addToast(`${t("forms:goal.errors.invalid_date_values")} ${String(dataSeries)}`, "error", false); // Im not sure about String(dataSeries)?
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
          addToast(`${t("forms:goal.errors.failed_parse_baseline")} ${e instanceof Error ? e.message : String(e)}`, "error", false);
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
      const dateValues = Object.entries(dataSeries.dateValues).sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime());
      if (!dateValues.every(dateValue => isISOIshDate(dateValue[0]))) throw new Error("Dates in data series are not in a valid ISO-ish format.");
      if (dateValues.length === 0) {
        addToast(t("forms:goal.errors.initial_baseline_error"), "error", false);
        event.target.reportValidity();
        return;
      }

      baseline = {
        unit: dataSeries.unit,
        dateValues: {},
      } satisfies DateValuesWithUnit;

      const firstDateValue = baselineType === BaselineType.InitialNonZero
        ? dataSeries.dateValues[dateValues.find(dateValue => dateValue[1] !== 0)?.[0] as keyof typeof dataSeries.dateValues] ?? dateValues[0][1]
        : dateValues[0][1];

      for (const dateValue of dateValues) {
        baseline.dateValues[dateValue[0] as keyof typeof dataSeries.dateValues] = firstDateValue;
      }
    }
    else if (baselineType === BaselineType.Inherited) {
      const inheritedBaselineId = formData.get("inherited-baseline-id") as string | null;
      if (inheritedBaselineId) {
        baselineId = inheritedBaselineId;
      }
      else {
        addToast(t("forms:goal.errors.missing_baseline_id"), "error", false);
        event.target.reportValidity();
        return;
      }
    }
    // Throw if baseline is missing on create
    if (!currentGoal && !baseline && !baselineId) {
      addToast(t("forms:goal.errors.missing_baseline"), "error", false);
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

        dataSeriesId: null,
        dataSeries: dataSeries,
        dataSeriesRecipeId: null,
        dataSeriesRecipe: dataSeriesRecipe?.serialize() ?? null,

        baselineId: baselineId,
        baseline: baseline,
        baselineRecipeId: null,
        baselineRecipe: null,

        // Goals are currently created without historical data; it's set later via the historical data form
        historicalId: null,
        historical: null,
        historicalRecipeId: null,
        historicalRecipe: null,

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

        dataSeriesId: undefined,
        dataSeries: dataSeries,
        dataSeriesRecipeId: undefined,
        dataSeriesRecipe: dataSeriesRecipe?.serialize() ?? undefined,

        baselineId: baselineId,
        baseline: baseline,
        baselineRecipeId: undefined,
        baselineRecipe: undefined,

        // Historical data is edited via the dedicated historical data form; leave unchanged here
        historicalId: undefined,
        historical: undefined,
        historicalRecipeId: undefined,
        historicalRecipe: undefined,

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
    formSubmitter('/api/goal', formJSON, currentGoal ? 'PUT' : 'POST', t, undefined, undefined, undefined, undefined, addToast, router.push);
  }

  // Index for data-position attribute in legend elements (for accessibility)
  let positionIndex = 1;

  return (
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

        <label id="description-label">{t("forms:goal.goal_description")}</label> {/* TODO: This is not actually labeling anything. I am however unsure how labels work outside of inputs so check that. */}
        <TextEditor
          className="margin-top-25 margin-bottom-100" // TODO: Need label for textEditorMenu
          id="description"
          ariaLabelledBy="description-label"
          placeholder={t("forms:text_editor_menu.default_placeholder")}
          editable={true}
          content={currentGoal ? currentGoal.description : ""}
          updater={(json) => descriptionRef.current ? descriptionRef.current.value = JSON.stringify(json) : null}
        />
        {/* hidden input containing the text editor output */}
        <input ref={descriptionRef} type="hidden" name="description" />

        {/* Indicator parameter / LEAP parameter */}
        <label htmlFor="indicatorParameter">
          {t("forms:goal.leap_parameter")}
        </label>
        <TextSingleAutocomplete
          props={{
            id: "indicatorParameter",
            name: "indicatorParameter",
            placeholder: t("forms:combobox.default_autocomplete_placeholder"),
            className: "margin-top-25 margin-bottom-100",
            defaultValue: currentGoal?.indicatorParameter ?? undefined,
          }}
          options={indicatorParameters}
          fuseOptions={{
            threshold: 0.3,
            ignoreLocation: true,
            minMatchCharLength: 2,
          }}
          value={indicatorParameter}
          setter={setIndicatorParameter}
        />

        {/* Unit, TODO: MOVE BELOW RECIPE STUFF! */}
        <label htmlFor="dataUnit">
          {t("forms:goal.data_unit")}
        </label>
        <TextSingleAutocomplete
          props={{
            id: "dataUnit",
            name: "dataUnit",
            placeholder: t("forms:combobox.default_autocomplete_placeholder"),
            className: "margin-top-25",
            defaultValue: currentGoal?.dataSeries?.unit ?? undefined,
          }}
          options={allOurUnits.map(u => ({ name: u, value: u }))}
          onChange={(unit) => {
            try {
              setParsedUnit(mathjs.unit(unit).toString());
            } catch {
              setParsedUnit(null);
            }
          }}
          value={unit}
          setter={setUnit}
        />
        <small className="block margin-top-25 margin-bottom-100 font-style-italic" style={{ height: '20px' }}>
          {parsedUnit === null && t("forms:goal.unit_not_interpreted")}

          {parsedUnit ? <>
            {t("forms:goal.unit_interpreted_as")} <strong>{parsedUnit}</strong>
          </> : null}
        </small>
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

        {/**
          ## NOTE:

          The following fieldsets are intentionally hidden and not unmounted to preserve state.
        */}
        {/* Suggested */}
        {hasInitializedSuggested ?
          <fieldset className={`margin-top-100 ${dataSeriesType !== DataSeriesType.Suggested ? "display-none" : ""}`} disabled={dataSeriesType !== DataSeriesType.Suggested}>
            <RecipeContextProvider initialRecipe={currentGoal?.dataSeries?.recipeUsed?.recipe ? Recipe.from(currentGoal.dataSeries.recipeUsed.recipe).withEditableExternals().serialize() : undefined}>
              <SuggestedRecipeApplier />
              <FormIntegration
                RecipeFormElement={<input name="resultingRecipe" />}
                DateValuesFormElement={<input name="resultingDateValues" />}
              />
              <UnitSync
                setter={setUnit}
              />
              <ParameterSync
                setter={setIndicatorParameter}
              />
            </RecipeContextProvider>
          </fieldset>
          : null
        }

        {/* Recipe */}
        {hasInitializedCustom ?
          <fieldset className={`margin-top-100 ${dataSeriesType !== DataSeriesType.Custom ? "display-none" : ""}`} disabled={dataSeriesType !== DataSeriesType.Custom}>
            <RecipeContextProvider initialRecipe={currentGoal?.dataSeries?.recipeUsed?.recipe ? Recipe.from(currentGoal.dataSeries.recipeUsed.recipe).withEditableExternals().serialize() : undefined}>
              <RecipeEditor />
              <FormIntegration
                RecipeFormElement={<input name="resultingRecipe" />}
                DateValuesFormElement={<input name="resultingDateValues" />}
              />
              <UnitSync
                setter={setUnit}
              />
              <ParameterSync
                setter={setIndicatorParameter}
              />
            </RecipeContextProvider>
          </fieldset>
          : null
        }

        {/* Manual */}
        <fieldset className={`${dataSeriesType === DataSeriesType.Manual ? "" : "display-none"}`} disabled={dataSeriesType !== DataSeriesType.Manual}>
          <ManualGoalForm
            currentGoal={currentGoal}
            outputFormElement={<input name="data-series" />}
          />
        </fieldset>
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
          <DataSeriesInputManual
            id="baseline-dataseries"
            label={t("forms:data_series_input.data_series")}
            {...currentGoal?.baseline
              ? { initialDateValues: dataSeriesToDateValues(currentGoal.baseline) }
              : {}
            }
            outputFormElement={<input name="baseline-data-series" />}
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
          // eslint-disable-next-line no-useless-assignment
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
  );
}