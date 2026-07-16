'use client';

import type { getRoadmaps } from "@/fetchers";
import formSubmitter from "@/functions/formSubmitter";
import { GoalDataTarget, isDateValuesWithUnit, DataSeriesType, BaselineType } from "@/types";
import type { DateValuesWithUnit, Goal, GoalCreateInput, GoalUpdateInput } from "@/types";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import styles from '../forms.module.css';
import TextSingleAutocomplete from "../elements/combobox/textSingleAutocomplete";
import parameterOptions from "@/lib/LEAPList.json" with { type: "json" };
import TextEditor from "../elements/textEditor/editor";
import SelectSingleSearch from "../elements/combobox/selectSingleSearch";
import { Recipe } from "@/functions/recipe/recipe";
import type { SerializedRecipe } from "@/functions/recipe";
import { useToast } from "@/components/generic/toast/toastContext.use";
import { useRouter } from "next/navigation";
import { GoalFormName } from "../formNames";
import GoalGraph from "@/components/graph/graphs/goal/main";
import HistoricalSeriesSection from "../sections/dataseries/historical";
import BaselineSeriesSection from "../sections/dataseries/baseline";
import GoalSeriesSection from "../sections/dataseries/goal";

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

  // No recipe: manual value input (or a legacy baseline; both edit as custom values)
  if (!goal.baseline.recipeUsed) return BaselineType.Custom;

  const recipe = Recipe.from(goal.baseline.recipeUsed.recipe);

  // Derived from the goal's data series (first / first non-zero value)
  const derivation = recipe.baselineDerivation();
  if (derivation === BaselineType.Initial || derivation === BaselineType.InitialNonZero) {
    return derivation;
  }

  // Manual entry stored as an inline data series recipe is custom; anything
  // else (e.g. a recipe linking another goal's series) is inherited.
  return recipe.isManual()
    ? BaselineType.Custom
    : BaselineType.Inherited;
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
  async function handleSubmit(event: React.ChangeEvent<HTMLFormElement>) {
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
      // Prefer explicit overrides, but keep the recipe/manual unit when override is empty.
      const dataUnitOverride = (formData.get(GoalFormName.DataUnit) as string | null)?.trim();
      dataSeries.unit = dataUnitOverride || dataSeries.unit;
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
    let baselineRecipe: Recipe | undefined = undefined;
    if (baselineType === BaselineType.Custom || baselineType === BaselineType.Inherited) {
      // Both flow through a recipe context: the recipe is a manual entry
      // (Custom) or links the inherited series (Inherited), and the baseline
      // date values are its evaluation result.
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

      const baselineRecipeString = formData.get(GoalFormName.BaselineRecipe) as string | null;
      if (baselineRecipeString) {
        try {
          baselineRecipe = Recipe.deserialize(baselineRecipeString);
        }
        catch (err) {
          addToast(`${t("forms:goal.errors.failed_parse_recipe")} ${err instanceof Error ? err.message : String(err)}`, "error", false);
          event.target.reportValidity();
          return;
        }
      }
    }
    else if (
      baselineType === BaselineType.Initial
      || baselineType === BaselineType.InitialNonZero
    ) {
      // Derive the baseline from the submitted data series through a recipe,
      // like the other baseline types: the equation picks the first (non-zero)
      // value and the evaluator broadcasts it across the series' years.
      if (Object.keys(dataSeries.dateValues).length === 0) {
        addToast(t("forms:goal.errors.initial_baseline_error"), "error", false);
        event.target.reportValidity();
        return;
      }

      baselineRecipe = Recipe.fromInitialDateValue(
        { unit: dataSeries.unit, dateValues: dataSeries.dateValues },
        { nonZero: baselineType === BaselineType.InitialNonZero },
      );
      try {
        const evaluated = await baselineRecipe.evaluate();
        if (!evaluated) throw new Error("Baseline recipe evaluation returned no result.");
        // The recipe evaluates unitless (see Recipe.fromInitialDateValue); the
        // baseline keeps the data series' unit verbatim.
        baseline = { unit: dataSeries.unit, dateValues: evaluated.dateValues };
      }
      catch (err) {
        addToast(`${t("forms:goal.errors.initial_baseline_error")} ${err instanceof Error ? err.message : String(err)}`, "error", false);
        event.target.reportValidity();
        return;
      }
    }
    if (baselineType === BaselineType.Inherited && (!baselineRecipe || !baseline)) {
      addToast(t("forms:goal.errors.missing_inherited_baseline"), "error", false);
      event.target.reportValidity();
      return;
    }
    // Throw if baseline is missing on create
    if (!currentGoal && !baseline) {
      addToast(t("forms:goal.errors.missing_baseline"), "error", false);
      event.target.reportValidity();
      return;
    }

    let historicalDataSeries: DateValuesWithUnit | undefined = undefined;
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

    let historicalRecipe: Recipe | undefined = undefined;
    const historicalRecipeString = formData.get(GoalFormName.HistoricalRecipe) as string | null;
    if (historicalRecipeString) {
      try {
        const parsedHistoricalRecipe = Recipe.deserialize(historicalRecipeString);
        // An empty recipe (external mode before a selection is completed) or a
        // manual recipe whose grid produced no values carries no data; skip it
        // rather than storing an orphaned recipe.
        if (!parsedHistoricalRecipe.isEmpty() && !(parsedHistoricalRecipe.isManual() && !historicalDataSeries)) {
          historicalRecipe = parsedHistoricalRecipe;
        }
      }
      catch (err) {
        addToast(`${t("forms:goal.errors.failed_parse_recipe")} ${err instanceof Error ? err.message : String(err)}`, "error", false);
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
    if (!currentGoal && baseline) {
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

        baselineId: null,
        baseline: baseline,
        baselineRecipeId: null,
        baselineRecipe: baselineRecipe?.serialize() ?? null,

        historicalId: null,
        historical: historicalDataSeries,
        historicalRecipeId: null,
        historicalRecipe: historicalRecipe?.serialize() ?? null,

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

        baselineId: undefined,
        baseline: baseline,
        baselineRecipeId: undefined,
        baselineRecipe: baselineRecipe?.serialize() ?? undefined,

        historicalId: undefined,
        historical: historicalDataSeries,
        historicalRecipeId: undefined,
        historicalRecipe: historicalRecipe?.serialize() ?? undefined,

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
    <form onSubmit={(event) => { void handleSubmit(event); }} name="goalForm">
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

      {/* Goal series input section */}
      <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200 padding-left-200`}>
        <legend data-position={positionIndex} className={`${styles.timeLineLegend} padding-block-125 font-weight-bold`}>{t("forms:goal.data_series.create")}</legend>
        <fieldset className={`${styles.timeLineFieldset} margin-top-200 margin-left-400`}>
          <legend data-position={positionIndex + 0.1} className={`  ${styles.timeLineLegend} padding-block-125 font-weight-bold`}>{t("forms:goal.data_series.goal.title")}</legend>

          <GoalSeriesSection
            goal={currentGoal}
            dataSeriesType={dataSeriesType}
            setDataSeriesType={setDataSeriesType}
            setIndicatorParameter={setIndicatorParameter}
            setPreviewDataSerie={setPreviewDataSerie}
            setDataSeriesRecipeError={setDataSeriesRecipeError}
            hasInitializedSuggested={hasInitializedSuggested}
            hasInitializedCustom={hasInitializedCustom}
          />
        </fieldset>

        {/* Baseline series input section */}
        <fieldset className={`${styles.timeLineFieldset} margin-top-200 margin-left-400`}>
          <legend
            data-position={positionIndex + 0.2}
            className={`${styles.timeLineLegend} padding-block-125 font-weight-bold`}
          >
            {t("forms:goal.data_series.baseline.title")}
          </legend>

          <BaselineSeriesSection
            goal={currentGoal}
            baselineType={baselineType}
            setBaselineType={setBaselineType}
          />
        </fieldset>

        {/* Historical series input section */}
        <fieldset className={`${styles.timeLineFieldset} margin-top-200 min-width-0 margin-left-400`}>
          <legend
            data-position={positionIndex + 0.3}
            className={`${styles.timeLineLegend} padding-block-125 font-weight-bold`}
          >
            {t("forms:goal.data_series.historical.title")}
          </legend>
          <HistoricalSeriesSection goal={currentGoal} />
        </fieldset>

        <div
          className="margin-top-200 min-width-0 margin-left-400"
        >
          <h2 className="text-align-center margin-0 padding-block-125">goal.preview</h2>
          {previewDataSerie?.dateValues ? (
            <GoalGraph
              chartType="main"
              series={{
                main: {
                  name: 'placeholder name',
                  unit: previewDataSerie.unit,
                  dateValues: previewDataSerie.dateValues, // TODO: Needs to be updated if we remove stuff
                },
              }}
            />
          ) :
            <strong className="grid height-100" style={{ placeContent: 'center' }}>goal.no_preview</strong>
          }
        </div>
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