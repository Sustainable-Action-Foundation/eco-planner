'use client';

import type { getRoadmaps } from "@/fetchers";
import formSubmitter from "@/functions/formSubmitter";
import mathjs, { allOurUnits } from "@/math";
import { GoalDataTarget, isDateValuesWithUnit, isISOIshDate } from "@/types";
import type { DateValuesWithUnit, Goal, GoalCreateInput, GoalUpdateInput, UnitString } from "@/types";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import styles from '../forms.module.css';
import TextSingleAutocomplete from "../elements/combobox/textSingleAutocomplete";
import parameterOptions from "@/lib/LEAPList.json" with { type: "json" };
import { InheritingBaseline } from "../sections/goalFormSections";
import TextEditor from "../elements/textEditor/editor";
import SelectSingleSearch from "../elements/combobox/selectSingleSearch";
import { Recipe } from "@/functions/recipe/recipe";
import type { SerializedRecipe } from "@/functions/recipe";
import { FormSync, ManualDataSeriesInput, RecipeContextProvider, RecipeEditor, SuggestedRecipeApplier } from "@/components/recipe";
import { useToast } from "@/components/generic/toast/toastContext.use";
import { useRouter } from "next/navigation";
import { dataSeriesToDateValues } from "@/functions/recipe";
import ParameterSync from "@/components/recipe/output/parameterSyncer";
import { RecipeSync } from "@/components/recipe/output/recipeSync";
import HistoricalDataSection from "../sections/historical/section";
import { GoalFormName } from "../formNames";
// import { SuggestedRecipesList } from "@/components/recipe/suggestions/suggestedRecipeList";
import GoalGraph from "@/components/graph/graphs/goal/main";

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

    // Manual entry stored as an inline data series recipe
    if (recipe.isManual()) {
      return DataSeriesType.Manual;
    }
    // Suggested recipe
    else if (recipe.isSuggestedRecipe()) {
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
  const [previewDataSerie, setPreviewDataSerie] = useState<DateValuesWithUnit | null>(null);
  // Evaluation error of the currently-selected recipe input (Suggested/Custom),
  // lifted out of the recipe context so submission can be blocked when it fails
  // to evaluate (e.g. an external variable with an incomplete selection).
  const [dataSeriesRecipeError, setDataSeriesRecipeError] = useState<string | null>(null);
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

    // Block submission when the selected recipe input failed to evaluate (e.g. an
    // external dataset variable with an incomplete selection). Without this the
    // recipe is sent and only fails server-side while materializing externals (500).
    if (
      (dataSeriesType === DataSeriesType.Suggested || dataSeriesType === DataSeriesType.Custom)
      && dataSeriesRecipeError
    ) {
      addToast(`${t("forms:goal.errors.recipe_has_error")} ${dataSeriesRecipeError}`, "error", false);
      event.target.reportValidity();
      return;
    }

    // Parse recipe (optional)
    let dataSeriesRecipe: Recipe | undefined = undefined;
    const resultingRecipeString = formData.get(GoalFormName.ResultingRecipe) as string | null;
    if (resultingRecipeString) {
      try {
        dataSeriesRecipe = Recipe.deserialize(resultingRecipeString);
      }
      catch (err) {
        addToast(`${t("forms:goal.errors.failed_parse_recipe")} ${err instanceof Error ? err.message : String(err)}`, "error", false);
        event.target.reportValidity();
        return;
      }
    }

    // Parse date values (required)
    const resultingDateValuesString = formData.get(GoalFormName.ResultingDateValues) as string | null;
    if (!resultingDateValuesString) {
      addToast(t("forms:goal.errors.missing_date_values"), "error", false);
      event.target.reportValidity();
      return;
    }

    let dataSeries: DateValuesWithUnit | undefined;
    try {
      dataSeries = JSON.parse(resultingDateValuesString) as DateValuesWithUnit;
      // Prefer the explicit unit field, but keep the recipe's evaluated unit when it's empty.
      dataSeries.unit = (formData.get(GoalFormName.DataUnit) as string | null) || dataSeries.unit;
    } catch (err) {
      addToast(`${t("forms:goal.errors.failed_parse_date_values")} ${err instanceof Error ? err.message : String(err)}`, "error", false);
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
      const baselineString = formData.get(GoalFormName.BaselineDataSeries) as string | null;
      if (baselineString) {
        try {
          baseline = JSON.parse(baselineString) as DateValuesWithUnit;
        }
        catch (err) {
          addToast(`${t("forms:goal.errors.failed_parse_baseline")} ${err instanceof Error ? err.message : String(err)}`, "error", false);
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
      const inheritedBaselineId = formData.get(GoalFormName.InheritedBaselineId) as string | null;
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

    let historicalDataSeries: DateValuesWithUnit | undefined = undefined;
    const historicalId: string | undefined = undefined;
    const historicalDataSeriesString = formData.get(GoalFormName.HistoricalDataSeries) as string | null;
    if (historicalDataSeriesString) {
      try {
        historicalDataSeries = JSON.parse(historicalDataSeriesString) as DateValuesWithUnit;
      }
      catch (err) {
        addToast(`${t("forms:goal.errors.failed_parse_historical_data")} ${err instanceof Error ? err.message : String(err)}`, "error", false);
        event.target.reportValidity();
        return;
      }
    }

    let recipeSuggestions: SerializedRecipe[] | undefined = undefined;
    const recipeSuggestionsString = formData.get(GoalFormName.RecipeSuggestions) as string | null;
    if (recipeSuggestionsString) {
      try {
        recipeSuggestions = JSON.parse(recipeSuggestionsString) as SerializedRecipe[];
      }
      catch (err) {
        addToast(`${t("forms:goal.errors.failed_parse_recipe_suggestions")} ${err instanceof Error ? err.message : String(err)}`, "error", false);
        event.target.reportValidity();
        return;
      }
    }


    // Build the JSON payload for the API
    let formContent: GoalCreateInput | GoalUpdateInput;
    if (!currentGoal && (baseline || baselineId)) {
      // Create
      formContent = {
        target: GoalDataTarget.Full,
        goalId: undefined, // Ignored when creating
        timestamp: undefined, // Ignored when creating

        name: formData.get(GoalFormName.GoalName) as string | null ?? null,
        description: formData.get(GoalFormName.Description) as string | null ?? null, // Use the hidden input for the description, which contains the latest editor content
        indicatorParameter: formData.get(GoalFormName.IndicatorParameter) as string | null ?? (event.target.reportValidity(), ""),
        isFeatured: (form.namedItem(GoalFormName.IsFeatured) as HTMLInputElement)?.checked || false,
        recipeSuggestions: recipeSuggestions,

        dataSeriesId: null,
        dataSeries: dataSeries,
        dataSeriesRecipeId: null,
        dataSeriesRecipe: dataSeriesRecipe?.serialize() ?? null,

        baselineId: baselineId,
        baseline: baseline,
        baselineRecipeId: null,
        baselineRecipe: null,

        historicalId: historicalId,
        historical: historicalDataSeries,
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
        target: GoalDataTarget.Full,
        goalId: currentGoal.id,
        timestamp: timestamp, // Only needed for edits

        name: formData.get(GoalFormName.GoalName) as string | null ?? undefined,
        description: formData.get(GoalFormName.Description) as string | null ?? undefined, // Use the hidden input for the description, which contains the latest editor content
        indicatorParameter: formData.get(GoalFormName.IndicatorParameter) as string | null ?? undefined,
        isFeatured: (form.namedItem(GoalFormName.IsFeatured) as HTMLInputElement)?.checked ?? undefined,
        recipeSuggestions: recipeSuggestions,

        dataSeriesId: undefined,
        dataSeries: dataSeries,
        dataSeriesRecipeId: undefined,
        dataSeriesRecipe: dataSeriesRecipe?.serialize() ?? undefined,

        baselineId: baselineId,
        baseline: baseline,
        baselineRecipeId: undefined,
        baselineRecipe: undefined,

        historicalId: historicalId,
        historical: historicalDataSeries,
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

  const manualInitialDateValues = currentGoal?.dataSeries
    ? dataSeriesToDateValues(currentGoal.dataSeries)
    : undefined;

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
          <input className="margin-top-25 margin-bottom-100" type="text" name={GoalFormName.GoalName} id="goalName" defaultValue={currentGoal?.name ?? undefined} />
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
        <input ref={descriptionRef} type="hidden" name={GoalFormName.Description} />

        {/* Indicator parameter / LEAP parameter */}
        <label htmlFor="indicatorParameter">
          {t("forms:goal.leap_parameter")}
        </label>
        <TextSingleAutocomplete
          props={{
            id: "indicatorParameter",
            name: GoalFormName.IndicatorParameter,
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
        <fieldset>
          <legend>
            {t("forms:goal.feature_this_goal")}
          </legend>
          <label className="flex align-items-center gap-50 margin-top-50 margin-bottom-100">
            <input type="checkbox" name={GoalFormName.IsFeatured} id="isFeatured" defaultChecked={currentGoal?.isFeatured} />
            {t("forms:goal.feature_goal")}
          </label>
        </fieldset >
      </fieldset>

      {/* Data series input section */}
      <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
        <legend data-position={positionIndex++} className={`${styles.timeLineLegend} padding-block-125 font-weight-bold`}>{t("forms:goal.choose_goal_data_series")}</legend>

        {/* Radio group */}
        <fieldset className="border-none padding-0 margin-0 margin-bottom-100" role="radiogroup" aria-label={t("forms:goal.choose_goal_data_series")}>
          <label className="flex align-items-center gap-50 margin-bottom-50">
            <input
              type="radio"
              name={GoalFormName.DataSeriesType}
              value={DataSeriesType.Suggested}
              checked={dataSeriesType === DataSeriesType.Suggested}
              onChange={(e) => setDataSeriesType(e.target.value as DataSeriesType)}
            />
            {t("forms:goal.suggested_inheritance")}
          </label>
          <label className="flex align-items-center gap-50 margin-bottom-50">
            <input
              type="radio"
              name={GoalFormName.DataSeriesType}
              value={DataSeriesType.Custom}
              checked={dataSeriesType === DataSeriesType.Custom}
              onChange={(e) => setDataSeriesType(e.target.value as DataSeriesType)}
            />
            {t("forms:goal.custom_recipe")}
          </label>
          <label className="flex align-items-center gap-50 margin-bottom-50">
            <input
              type="radio"
              name={GoalFormName.DataSeriesType}
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
          <fieldset className={`margin-bottom-100 ${dataSeriesType !== DataSeriesType.Suggested ? "display-none" : ""}`} disabled={dataSeriesType !== DataSeriesType.Suggested}>
            <RecipeContextProvider
              initialRecipe={currentGoal?.dataSeries?.recipeUsed?.recipe ? Recipe.from(currentGoal.dataSeries.recipeUsed.recipe).withEditableExternals().serialize() : undefined}
              availableDataSeries={currentGoal?.dataSeries?.recipeUsed?.sourceDataSeries}
            >
              <SuggestedRecipeApplier />
              <FormSync
                RecipeFormElement={<input name={GoalFormName.ResultingRecipe} />}
                DateValuesFormElement={<input name={GoalFormName.ResultingDateValues} />}
              />
              <ParameterSync
                setter={setIndicatorParameter}
              />
              <RecipeSync
                onUnit={setUnit}
                onError={setDataSeriesRecipeError}
                active={dataSeriesType === DataSeriesType.Suggested}
              />
            </RecipeContextProvider>
          </fieldset>
          : null
        }

        {/* Recipe */}
        {hasInitializedCustom ?
          <fieldset className={`margin-bottom-100 ${dataSeriesType !== DataSeriesType.Custom ? "display-none" : ""}`} disabled={dataSeriesType !== DataSeriesType.Custom}>
            <RecipeContextProvider
              initialRecipe={currentGoal?.dataSeries?.recipeUsed?.recipe ? Recipe.from(currentGoal.dataSeries.recipeUsed.recipe).withEditableExternals().serialize() : undefined}
              availableDataSeries={currentGoal?.dataSeries?.recipeUsed?.sourceDataSeries}
            >
              <RecipeEditor />
              <FormSync
                RecipeFormElement={<input name={GoalFormName.ResultingRecipe} />}
                DateValuesFormElement={<input name={GoalFormName.ResultingDateValues} />}
              />
              <ParameterSync
                setter={setIndicatorParameter}
              />
              <RecipeSync
                onUnit={setUnit}
                onDateValues={setPreviewDataSerie}
                onError={setDataSeriesRecipeError}
                active={dataSeriesType === DataSeriesType.Custom}
              />
            </RecipeContextProvider>
          </fieldset>
          : null
        }

        {/* Manual */}
        <fieldset className={`margin-bottom-100 ${dataSeriesType === DataSeriesType.Manual ? "" : "display-none"}`} disabled={dataSeriesType !== DataSeriesType.Manual}>
          <RecipeContextProvider
            initialRecipe={Recipe.fromManualDateValues(manualInitialDateValues ?? { unit: undefined, dateValues: {} }).serialize()}
          >
            <ManualDataSeriesInput
              id="goal-dataseries"
              label={t("forms:data_series_input.data_series")}
              initialDateValues={manualInitialDateValues}
            />
            <FormSync
              RecipeFormElement={<input name={GoalFormName.ResultingRecipe} />}
              DateValuesFormElement={<input name={GoalFormName.ResultingDateValues} />}
            />
          </RecipeContextProvider>
        </fieldset>

        {/* Unit */}
        <label htmlFor="dataUnit">
          {t("forms:goal.data_unit")}
        </label>
        <TextSingleAutocomplete
          props={{
            id: "dataUnit",
            name: GoalFormName.DataUnit,
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

      {/* Baseline selection section */}
      <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
        <legend
          data-position={positionIndex++}
          className={`${styles.timeLineLegend} padding-block-125 font-weight-bold`}
        >
          {t("forms:goal.create_baseline_for_actions")}
        </legend>

        <label>
          {t("forms:goal.baseline_label")}
          <select className="block margin-top-25 margin-bottom-100" name={GoalFormName.BaselineType} id="baselineSelector" value={baselineType} onChange={(e) => setBaselineType(e.target.value as BaselineType)}>
            <option value={BaselineType.Initial}>{t("forms:goal.baseline_types.initial")}</option>
            <option value={BaselineType.InitialNonZero}>{t("forms:goal.baseline_types.initial_non_zero")}</option>
            <option value={BaselineType.Custom}>{t("forms:goal.baseline_types.custom")}</option>
            <option value={BaselineType.Inherited}>{t("forms:goal.baseline_types.inherited")}</option>
          </select>
        </label>

        {/* Custom baseline input */}
        {baselineType === BaselineType.Custom &&
          <RecipeContextProvider
            initialRecipe={Recipe.fromManualDateValues(
              currentGoal?.baseline ? dataSeriesToDateValues(currentGoal.baseline) : { unit: undefined, dateValues: {} },
            ).serialize()}
          >
            <ManualDataSeriesInput
              id="baseline-dataseries"
              label={t("forms:data_series_input.data_series")}
              {...currentGoal?.baseline
                ? { initialDateValues: dataSeriesToDateValues(currentGoal.baseline) }
                : {}
              }
            />
            <FormSync DateValuesFormElement={<input name={GoalFormName.BaselineDataSeries} />} />
          </RecipeContextProvider>
        }

        {/* Inherited baseline input */}
        {baselineType === BaselineType.Inherited &&
          <InheritingBaseline
            outputFormElement={<input name={GoalFormName.InheritedBaselineId} />}
          />
        }
      </fieldset>


      <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200 min-width-0`}>
        <legend
          // eslint-disable-next-line no-useless-assignment
          data-position={positionIndex++}
          className={`${styles.timeLineLegend} padding-block-125 font-weight-bold`}
        >
          {t("forms:goal.input_historical_data")}
        </legend>

        <HistoricalDataSection goal={currentGoal} />
      </fieldset>

      {/* Suggested recipes section 
      <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
        <legend
          // eslint-disable-next-line no-useless-assignment
          data-position={positionIndex++}
          className={`${styles.timeLineLegend} padding-block-125 font-weight-bold`}
        >
          {t("forms:goal.suggested_recipes")}
        </legend>

        <p className="margin-top-25 margin-bottom-100">
          {t("forms:goal.suggested_recipes_description")}
        </p>

        <SuggestedRecipesList
          currentGoal={currentGoal}
          existingSuggestedRecipes={currentGoal?.recipeSuggestions ?? []}
        />
      </fieldset>
      */}

      <div
        className="margin-top-200 min-width-0"
        style={{
          height: '400px',
        }}
      >
        <h2 className="text-align-center margin-0 padding-block-125">goal.preview</h2>
        {previewDataSerie?.dateValues ? (
          <GoalGraph
            chartType="main"
            series={{
              main: {
                name: 'placeholder name',
                unit: previewDataSerie.unit,
                dateValues: previewDataSerie.dateValues,
              },
            }}
          />
        ) :
          <strong className="grid height-100" style={{ placeContent: 'center' }}>goal.no_preview</strong>
        }
      </div>


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