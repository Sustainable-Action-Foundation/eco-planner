'use client';

import type { getRoadmaps } from "@/fetchers";
import formSubmitter from "@/functions/formSubmitter";
import type { DateValuesWithUnit, Goal, GoalCreateInput, GoalUpdateInput } from "@/types";
import { BaselineType, DataSeriesType, GoalDataTarget, GoalVisibility, HistoricalDataType } from "@/types/enums";
import { GoalFormName } from "@/types/form-names";
import { goalVisibilityFromFlags, goalVisibilityToFlags, isGoalVisibility } from "@/functions/goalVisibility";
import { IconCaretRightFilled, IconEye, IconEyeOff, IconStar } from "@tabler/icons-react";
import { waitForRecipeFormSyncs } from "@/components/recipe";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import styles from '../forms.module.css';
import TextSingleAutocomplete from "../elements/combobox/textSingleAutocomplete";
import parameterOptions from "@/lib/LEAPList.json" with { type: "json" };
import TextEditor from "../elements/textEditor/editor";
import SelectSingleSearch from "../elements/combobox/selectSingleSearch";
import { Recipe } from "@/functions/recipe/recipe";
import type { SerializedRecipe } from "@/functions/recipe";
import {
  buildBaselineSection,
  GoalFormError,
  parseDataSeriesSection,
  parseHistoricalSection,
  parseRecipeSuggestions,
  resolveBaselineType,
  resolveDataSeriesType,
  resolveHistoricalDataType,
  useInitializedValues,
} from "./goalSections";
import { useToast } from "@/components/generic/toast/toastContext.use";
import { useRouter } from "next/navigation";
import HistoricalSeriesSection from "../sections/dataseries/historical";
import BaselineSeriesSection from "../sections/dataseries/baseline";
import GoalSeriesSection from "../sections/dataseries/goal";
import { getHistoricalDatasetFromRecipe } from "@/functions/getHistoricalDataset";
import PreviewSeries from "../sections/dataseries/preview";
import DraggableSnapBack from "@/components/generic/draggable/draggable";

export default function GoalForm({
  iterationId,
  roadmapAlternatives,
  currentGoal,
}: {
  /** The roadmap iteration the goal belongs to, if preselected */
  iterationId?: string,
  roadmapAlternatives: Awaited<ReturnType<typeof getRoadmaps>>,
  currentGoal?: Goal;
}) {
  const { t } = useTranslation(["forms", "graphs", "common"]);

  const [dataSeriesType, setDataSeriesType] = useState<DataSeriesType>(() => resolveDataSeriesType(currentGoal));
  const initializedDataSeriesTypes = useInitializedValues(dataSeriesType);
  const hasInitializedSuggested = initializedDataSeriesTypes.has(DataSeriesType.Suggested);
  const hasInitializedManual = initializedDataSeriesTypes.has(DataSeriesType.Manual);
  const hasInitializedCustom = initializedDataSeriesTypes.has(DataSeriesType.Custom);

  const [baselineType, setBaselineType] = useState<BaselineType>(() => resolveBaselineType(currentGoal));
  const initializedBaselineTypes = useInitializedValues(baselineType);
  const baselineHasInitializedInitial = initializedBaselineTypes.has(BaselineType.Initial);
  const baselineHasInitializedInitialNonZero = initializedBaselineTypes.has(BaselineType.InitialNonZero);
  const baselineHasInitializedManual = initializedBaselineTypes.has(BaselineType.Custom);
  const baselineHasInitializedInherited = initializedBaselineTypes.has(BaselineType.Inherited);

  const [historicalDataType, setHistoricalDataType] = useState<HistoricalDataType>(() => resolveHistoricalDataType(currentGoal));

  // Baseline and historical data are optional, so their sections start collapsed
  // unless the goal already has one; the summary shows the current choice.
  const [baselineOpen, setBaselineOpen] = useState<boolean>(() => !!currentGoal?.baseline);
  const [historicalOpen, setHistoricalOpen] = useState<boolean>(() => !!currentGoal?.historical);
  // Inline records so every key stays a literal inside t()
  const baselineTypeLabels: Record<BaselineType, string> = {
    [BaselineType.None]: t("forms:goal.baseline_types.none"),
    [BaselineType.Initial]: t("forms:goal.baseline_types.initial"),
    [BaselineType.InitialNonZero]: t("forms:goal.baseline_types.initial_non_zero"),
    [BaselineType.Custom]: t("forms:goal.baseline_types.custom"),
    [BaselineType.Inherited]: t("forms:goal.baseline_types.inherited"),
  };
  const historicalTypeLabels: Record<HistoricalDataType, string> = {
    [HistoricalDataType.None]: t("forms:goal.data_series.historical.no_historical_title"),
    [HistoricalDataType.External]: t("forms:goal.data_series.historical.external_title"),
    [HistoricalDataType.Custom]: t("forms:goal.data_series.historical.custom_title"),
  };
  const initializedHistoricalTypes = useInitializedValues(historicalDataType);
  const historicalHasInitializedNone = initializedHistoricalTypes.has(HistoricalDataType.None);
  const historicalHasInitializedExternal = initializedHistoricalTypes.has(HistoricalDataType.External);
  const historicalHasInitializedCustom = initializedHistoricalTypes.has(HistoricalDataType.Custom);

  const [indicatorParameter, setIndicatorParameter] = useState<string>(currentGoal?.indicator_parameter ?? "");
  const initialVisibility = goalVisibilityFromFlags({ is_featured: !!currentGoal?.is_featured, is_unlisted: !!currentGoal?.is_unlisted });
  // const [goalName, setGoalName] = useState<string>(currentGoal?.name ?? "");
  const [parentIterationId, setParentIterationId] = useState<string>(iterationId || "");
  const [previewDataSerie, setPreviewDataSerie] = useState<DateValuesWithUnit | null>(null);
  const [previewHistoricalSerie, setPreviewHistoricalSerie] = useState<DateValuesWithUnit | null>(null);
  const [previewBaselineSerie, setPreviewBaselineSerie] = useState<DateValuesWithUnit | null>(null);
  const [previewHistoricalRecipe, setPreviewHistoricalRecipe] = useState<SerializedRecipe | null>(null);

  // Evaluation error of the currently-selected recipe input (Manual/Suggested/Custom)
  // lifted out of the recipe context so submission can be blocked when it fails
  // to evaluate (e.g. an external variable with an incomplete selection).
  const [dataSeriesRecipeError, setDataSeriesRecipeError] = useState<string | null>(null);
  const descriptionRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const { addToast } = useToast();

  const historicalLabel = useMemo(() => {
    if (!previewHistoricalRecipe) return "";
    try {
      return getHistoricalDatasetFromRecipe(Recipe.from(previewHistoricalRecipe)).label ?? "";
    } catch {
      return "";
    }
  }, [previewHistoricalRecipe]);

  const previewGraphSeries = useMemo(() => ({
    main: previewDataSerie?.dateValues && {
      //name: goalName ? `${goalName} (goal)` : 'goal',
      name: t("common:goal_one"), // TODO: Really want this implemented as is it above but this turned out to be really expensive as tracking the name will re-render the form.
      unit: previewDataSerie.unit,
      dateValues: previewDataSerie.dateValues, // TODO: Needs to be updated if we remove stuff
    },
    baseline: (previewBaselineSerie?.dateValues && previewDataSerie) && {
      name: t('graphs:common.baseline_scenario'),
      unit: previewDataSerie.unit, // TODO: For now we lie and say that baseline and preview data series share the same unit. Should make sure that we sync properly in the future though.
      dateValues: previewBaselineSerie.dateValues,
    },
    historical: (previewHistoricalSerie?.dateValues && previewDataSerie) && {
      name: historicalLabel ? t("graphs:common.historical_series", { label: historicalLabel }) : t("common:historical_data"),
      unit: previewDataSerie.unit, // TODO: For now we lie and say that historical and preview data series share the same unit. Should make sure that we sync properly in the future though.
      dateValues: previewHistoricalSerie.dateValues,
    },
  }), [previewDataSerie, previewBaselineSerie, previewHistoricalSerie, historicalLabel, t]);


  const parentIterations = useMemo(() => {
    return (roadmapAlternatives ?? []).flatMap(roadmap =>
      roadmap.iterations.map(iteration => ({
        name: t("common:roadmap_version_name", { name: roadmap.name, version: iteration.version }),
        value: iteration.id,
      })),
    );
  }, [roadmapAlternatives, t]);

  const [timestamp] = useState(() => Date.now());

  const indicatorParameters = useMemo(() => {
    return [...new Set(parameterOptions)].map(option => ({
      name: option,
      value: option,
    }));
  }, []);

  // TODO: Error messages were translated directly from English to Swedish when switching to toasts.
  // They can likely be translated better.
  async function handleSubmit(event: React.ChangeEvent<HTMLFormElement>) {
    event.target.reportValidity();
    event.preventDefault();

    // The recipe contexts evaluate on a debounce; wait for their FormSync
    // outputs to settle so a submit right after an edit doesn't read stale data.
    await waitForRecipeFormSyncs(event.target);

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
    // external dataset variable with an incomplete selection, or a manual series
    // that didn't pass the recipe type guards). Without this the recipe is sent
    // and only fails server-side (invalid body / 500 while materializing externals).
    if (dataSeriesRecipeError) {
      addToast(`${t("forms:goal.errors.recipe_has_error")} ${dataSeriesRecipeError}`, "error", false);
      event.target.reportValidity();
      return;
    }

    let dataSeries: DateValuesWithUnit;
    let dataSeriesRecipe: Recipe | undefined;
    let baseline: DateValuesWithUnit | undefined;
    let baselineRecipe: Recipe | undefined;
    let historicalDataSeries: DateValuesWithUnit | undefined;
    let historicalRecipe: Recipe | undefined;
    let recipeSuggestions: SerializedRecipe[] | undefined;
    try {
      ({ dataSeries, dataSeriesRecipe } = parseDataSeriesSection(formData, t));
      ({ baseline, baselineRecipe } = await buildBaselineSection(formData, baselineType, dataSeries, t));
      ({ historical: historicalDataSeries, historicalRecipe } = parseHistoricalSection(formData, t));
      recipeSuggestions = parseRecipeSuggestions(formData, t);
    }
    catch (err) {
      if (!(err instanceof GoalFormError)) throw err;
      addToast(err.message, "error", false);
      event.target.reportValidity();
      return;
    }

    // The visibility radio stands in for the two listing flags the API takes
    const visibilityValue = formData.get(GoalFormName.Visibility);
    const visibilityFlags = goalVisibilityToFlags(isGoalVisibility(visibilityValue) ? visibilityValue : GoalVisibility.Public);

    // Build the JSON payload for the API
    let formContent: GoalCreateInput | GoalUpdateInput;
    if (!currentGoal) {
      // Create
      formContent = {
        target: GoalDataTarget.Full,
        goalId: undefined, // Ignored when creating
        timestamp: undefined, // Ignored when creating

        name: formData.get(GoalFormName.GoalName) as string | null ?? null,
        description: formData.get(GoalFormName.Description) as string | null ?? null, // Use the hidden input for the description, which contains the latest editor content
        indicatorParameter: formData.get(GoalFormName.IndicatorParameter) as string | null ?? (event.target.reportValidity(), ""),
        ...visibilityFlags,
        iterationId: iterationId || parentIterationId,
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

        rawTags: undefined, // TODO: add tags input
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
        ...visibilityFlags,
        recipeSuggestions: recipeSuggestions,

        dataSeriesId: undefined,
        dataSeries: dataSeries,
        dataSeriesRecipeId: undefined,
        dataSeriesRecipe: dataSeriesRecipe?.serialize() ?? undefined,

        // Selecting "no baseline" on an existing goal drops its current one
        baselineId: baselineType === BaselineType.None ? null : undefined,
        baseline: baseline,
        baselineRecipeId: undefined,
        baselineRecipe: baselineRecipe?.serialize() ?? undefined,

        historicalId: undefined,
        historical: historicalDataSeries,
        historicalRecipeId: undefined,
        historicalRecipe: historicalRecipe?.serialize() ?? undefined,

        iterationId: undefined, // Can't reassign the roadmap iteration of an existing goal
        rawTags: undefined, // TODO: add tags input
      } satisfies GoalUpdateInput;
    }
    else {
      throw new Error("Missing data to create or update goal.");
    }

    const formJSON = JSON.stringify(formContent);

    // Submit the form to the API (POST for new, PUT for edit)
    formSubmitter('/api/goal', formJSON, currentGoal ? 'PUT' : 'POST', t, undefined, undefined, undefined, undefined, addToast, (url) => router.push(url));
  }

  // Index for data-position attribute in legend elements (for accessibility)
  let positionIndex = 1;

  return (
    <form onSubmit={(event) => { void handleSubmit(event); }} name="goalForm">
      {/* This hidden submit button prevents submitting by pressing enter, to avoid accidental submission */}
      <button type="submit" disabled={true} className="display-none" aria-hidden={true} />

      {/* Allow user to select parent roadmap iteration if not already selected */}
      {!(iterationId || currentGoal?.roadmap_iteration_id) ?
        <fieldset className={`${styles.timeLineFieldset} width-100`}>
          <legend data-position={positionIndex++} className={`${styles.timeLineLegend} padding-block-125 font-weight-bold`}>{t("forms:goal.choose_relationship")}</legend>
          <label htmlFor="parent-roadmap">{t("forms:goal.relationship_label")}</label> {/* TODO: i18n, title case */}
          <SelectSingleSearch
            props={{
              required: true,
              className: "margin-top-25 margin-bottom-100",
              id: "parent-roadmap",
              name: "parent-roadmap",
              placeholder: `${t("common:tsx.select")}  ${t("common:roadmap_one")}`,
            }}
            onChange={(value) => value?.value ? setParentIterationId(value.value) : setParentIterationId("")}
            options={parentIterations}
          />
        </fieldset>
        : null
      }

      {/* Goal name and description */}
      <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
        <legend data-position={positionIndex++} className={`${styles.timeLineLegend} padding-block-125 font-weight-bold`}>{t("forms:goal.goal_description_legend")}</legend>
        <label>
          {t("forms:goal.goal_name")}
          <input
            className="margin-top-25 margin-bottom-100"
            type="text"
            name={GoalFormName.GoalName}
            id="goalName"
            defaultValue={currentGoal?.name ?? undefined}
          // onChange={(e) => setGoalName(e.target.value)}
          />
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
            defaultValue: currentGoal?.indicator_parameter ?? undefined,
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
        {/* Visibility: one setting standing in for the featured/unlisted flags, like the admin panel */}
        <fieldset className="margin-top-100">
          <legend>
            {t("forms:goal.visibility")}
          </legend>
          {[
            {
              value: GoalVisibility.Public,
              id: "isPublic",
              icon: <IconEye aria-hidden="true" width={20} height={20} style={{ minWidth: '20px' }} />,
              label: t("components:table_menu.visibility_public"),
              description: t("forms:goal.visibility_public_description"),
            },
            {
              value: GoalVisibility.Unlisted,
              id: "isUnlisted",
              icon: <IconEyeOff aria-hidden="true" width={20} height={20} style={{ minWidth: '20px' }} />,
              label: t("components:table_menu.visibility_unlisted"),
              description: t("forms:goal.visibility_unlisted_description"),
            },
            {
              value: GoalVisibility.Featured,
              id: "isFeatured",
              icon: <IconStar aria-hidden="true" width={20} height={20} style={{ minWidth: '20px' }} />,
              label: t("components:table_menu.visibility_featured"),
              description: t("forms:goal.visibility_featured_description"),
            },
          ].map((option) => (
            <label key={option.value} className="flex align-items-start gap-50 margin-top-50 margin-bottom-50">
              <input
                type="radio"
                required={true}
                name={GoalFormName.Visibility}
                id={option.id}
                value={option.value}
                defaultChecked={initialVisibility === option.value}
              />
              <span>
                <span className="flex align-items-center gap-25" style={{ textShadow: '0 0' }}>{option.icon}{option.label}</span>
                <span className="block" style={{ color: '#292929' }}>{option.description}</span>
              </span>
            </label>
          ))}
        </fieldset>
      </fieldset>

      {/* Goal series input section */}
      <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
        <legend data-position={positionIndex++} className={`${styles.timeLineLegend} padding-block-125 font-weight-bold`}>{t("forms:goal.data_series.goal.title")}</legend>
        <GoalSeriesSection
          goal={currentGoal}
          dataSeriesType={dataSeriesType}
          setDataSeriesType={setDataSeriesType}
          indicatorParameter={indicatorParameter}
          setIndicatorParameter={setIndicatorParameter}
          setPreviewDataSerie={setPreviewDataSerie}
          setDataSeriesRecipeError={setDataSeriesRecipeError}
          hasInitializedSuggested={hasInitializedSuggested}
          hasInitializedManual={hasInitializedManual}
          hasInitializedCustom={hasInitializedCustom}
        />
      </fieldset>

      {/* Baseline series input section */}
      <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
        <legend
          data-position={positionIndex++}
          className={`${styles.timeLineLegend} padding-block-125 font-weight-bold`}
        >
          {t("forms:goal.data_series.baseline.title")}
        </legend>

        <details
          className={`smooth ${styles['action-details']}`}
          open={baselineOpen}
          onToggle={(e) => setBaselineOpen(e.currentTarget.open)}
          data-testid="baseline-section"
        >
          <summary className="flex justify-content-space-between align-items-center gap-50 padding-50 cursor-pointer">
            <span className="flex align-items-center gap-25">
              <IconCaretRightFilled className={`${styles['caret']}`} height={20} width={20} style={{ minWidth: '20px' }} aria-hidden="true" />
              {t("forms:goal.data_series.baseline.type")}
            </span>
            <span className="font-weight-normal">{baselineTypeLabels[baselineType]}</span>
          </summary>
          <div className={`padding-50 ${styles['action-details-body']}`}>
            <BaselineSeriesSection
              goal={currentGoal}
              baselineType={baselineType}
              initialBaselineType={resolveBaselineType(currentGoal)}
              dataSeries={previewDataSerie}
              setBaselineType={setBaselineType}
              setPreviewBaselineSerie={setPreviewBaselineSerie}
              hasInitializedInitial={baselineHasInitializedInitial}
              hasInitializedInitialNonZero={baselineHasInitializedInitialNonZero}
              hasInitializedManual={baselineHasInitializedManual}
              hasInitializedInherited={baselineHasInitializedInherited}
            />
          </div>
        </details>
      </fieldset>

      {/* Historical series input section */}
      <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200 min-width-0`}>
        <legend
          // Technically incrementing here is unused but if you add another entry after this one it will be correct
          // eslint-disable-next-line no-useless-assignment
          data-position={positionIndex++}
          className={`${styles.timeLineLegend} padding-block-125 font-weight-bold`}
        >
          {t("forms:goal.data_series.historical.title")}
        </legend>
        <details
          className={`smooth min-width-0 ${styles['action-details']}`}
          open={historicalOpen}
          onToggle={(e) => setHistoricalOpen(e.currentTarget.open)}
          data-testid="historical-section"
        >
          <summary className="flex justify-content-space-between align-items-center gap-50 padding-50 cursor-pointer">
            <span className="flex align-items-center gap-25">
              <IconCaretRightFilled className={`${styles['caret']}`} height={20} width={20} style={{ minWidth: '20px' }} aria-hidden="true" />
              {t("forms:goal.data_series.historical.type")}
            </span>
            <span className="font-weight-normal">{historicalTypeLabels[historicalDataType]}</span>
          </summary>
          <div className={`padding-50 min-width-0 ${styles['action-details-body']}`}>
            <HistoricalSeriesSection
              goal={currentGoal}
              historicalDataType={historicalDataType}
              setHistoricalDataType={setHistoricalDataType}
              setPreviewHistoricalSerie={setPreviewHistoricalSerie}
              setPreviewHistoricalRecipe={setPreviewHistoricalRecipe}
              hasInitializedNone={historicalHasInitializedNone}
              hasInitializedExternal={historicalHasInitializedExternal}
              hasInitializedManual={historicalHasInitializedCustom}
            />
          </div>
        </details>
      </fieldset>

      <div className="margin-top-200 min-width-0">
        <strong className="block font-size-125 font-weight-bold text-align-center margin-0 padding-top-125 margin-bottom-50">{t("forms:goal.preview")}</strong>
        <DraggableSnapBack>
          <PreviewSeries
            main={previewGraphSeries.main}
            baseline={previewGraphSeries.baseline}
            historical={previewGraphSeries.historical}
          />
        </DraggableSnapBack>
      </div>


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