"use client";

import GoalSeriesSection from "@/components/form/sections/dataseries/goal";
import { GoalGraph } from "@/components/graph/graphs/goal/main";
import { waitForRecipeFormSyncs } from "@/components/recipe";
import { useToast } from "@/components/generic/toast/toastContext.use";
import formSubmitter from "@/functions/formSubmitter";
import type { DateValuesWithUnit, Goal, GoalUpdateInput } from "@/types";
import { DataSeriesType, GoalDataTarget } from "@/types/enums";
import { useRouter } from "next/navigation";
import { useState, type SubmitEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  buildBaselineSection,
  GoalFormError,
  isDerivedBaselineType,
  parseDataSeriesSection,
  resolveBaselineType,
  resolveDataSeriesType,
  storedHistoricalForGraph,
  storedSeriesForGraph,
  useInitializedValues,
} from "./goalSections";

/**
 * Edits only the main data series of an existing goal: the goal form's data
 * series section on its own, submitted as a sectional update.
 */
export default function DataSeriesForm({
  goal,
}: {
  goal: Goal;
}) {
  const { t } = useTranslation(["forms", "graphs", "common"]);
  const { addToast } = useToast();
  const router = useRouter();

  // Same wiring as the goal form: the section renders every input type in
  // hidden-not-unmounted fieldsets once visited, with the type lifted here.
  const [dataSeriesType, setDataSeriesType] = useState<DataSeriesType>(() => resolveDataSeriesType(goal));
  const initializedTypes = useInitializedValues(dataSeriesType);
  const [previewDataSerie, setPreviewDataSerie] = useState<DateValuesWithUnit | null>(null);
  // Evaluation error of the currently-selected recipe input (Suggested/Custom),
  // lifted out of the recipe context so submission can be blocked when it fails
  const [dataSeriesRecipeError, setDataSeriesRecipeError] = useState<string | null>(null);
  const [timestamp] = useState(() => Date.now());

  // A baseline derived from the series' first (non-zero) value goes stale when
  // the series changes, so it is re-derived and written after the series lands
  // (the full goal form does the same on every submit).
  const baselineType = resolveBaselineType(goal);
  const rederivesBaseline = isDerivedBaselineType(baselineType);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!(event.target instanceof HTMLFormElement)) return;
    if (!(event.target.checkValidity())) {
      event.target.reportValidity();
      return;
    }

    // The recipe context evaluates on a debounce; wait for the FormSync
    // outputs to settle so a submit right after an edit doesn't read stale data.
    await waitForRecipeFormSyncs(event.target);

    if ((dataSeriesType === DataSeriesType.Suggested || dataSeriesType === DataSeriesType.Custom) && dataSeriesRecipeError) {
      addToast(`${t("forms:goal.errors.recipe_has_error")} ${dataSeriesRecipeError}`, "error", false);
      return;
    }

    const formData = new FormData(event.target);

    let dataSeries: DateValuesWithUnit;
    let dataSeriesRecipe: Awaited<ReturnType<typeof parseDataSeriesSection>>["dataSeriesRecipe"];
    let baseline: DateValuesWithUnit | undefined;
    let baselineRecipe: Awaited<ReturnType<typeof buildBaselineSection>>["baselineRecipe"];
    try {
      ({ dataSeries, dataSeriesRecipe } = parseDataSeriesSection(formData, t));
      if (rederivesBaseline) {
        ({ baseline, baselineRecipe } = await buildBaselineSection(formData, baselineType, dataSeries, t));
      }
    }
    catch (err) {
      if (!(err instanceof GoalFormError)) throw err;
      addToast(err.message, "error", false);
      return;
    }

    const dataSeriesPayload = JSON.stringify({
      target: GoalDataTarget.DataSeries,
      goalId: goal.id,
      timestamp: timestamp,
      dataSeries: dataSeries,
      // Values-only (manual entry) lets the API store a fresh manual recipe
      dataSeriesRecipe: dataSeriesRecipe?.serialize() ?? undefined,
    } satisfies GoalUpdateInput);

    const navigate = (url: string) => router.push(url);

    if (rederivesBaseline && baseline) {
      const baselinePayload = () => JSON.stringify({
        target: GoalDataTarget.Baseline,
        goalId: goal.id,
        // The first write bumps the goal's updated_at; a fresh timestamp keeps the second from reading as stale
        timestamp: Date.now(),
        baseline: baseline,
        baselineRecipe: baselineRecipe?.serialize() ?? undefined,
      } satisfies GoalUpdateInput);

      formSubmitter("/api/goal", dataSeriesPayload, "PUT", t, undefined, undefined,
        // Only on success: write the re-derived baseline, then follow the default success flow
        () => formSubmitter("/api/goal", baselinePayload(), "PUT", t, undefined, undefined, undefined, undefined, addToast, navigate),
        undefined, addToast,
      );
      return;
    }

    formSubmitter("/api/goal", dataSeriesPayload, "PUT", t, undefined, undefined, undefined, undefined, addToast, navigate);
  }

  return (
    <form onSubmit={(event) => { void handleSubmit(event); }} name="goalForm">
      {/* This hidden submit button prevents submitting by pressing enter, to avoid accidental submission */}
      <button type="submit" disabled={true} className="display-none" aria-hidden={true} />

      <GoalSeriesSection
        goal={goal}
        dataSeriesType={dataSeriesType}
        setDataSeriesType={setDataSeriesType}
        setIndicatorParameter={() => { /* The indicator parameter is goal metadata, outside this section; the suggestion is ignored here */ }}
        setPreviewDataSerie={setPreviewDataSerie}
        setDataSeriesRecipeError={setDataSeriesRecipeError}
        hasInitializedSuggested={initializedTypes.has(DataSeriesType.Suggested)}
        hasInitializedManual={initializedTypes.has(DataSeriesType.Manual)}
        hasInitializedCustom={initializedTypes.has(DataSeriesType.Custom)}
      />

      {rederivesBaseline ?
        <p className="margin-block-100">{t("forms:goal.data_series.goal.baseline_rederived")}</p>
        : null}

      <div className="margin-top-200 min-width-0">
        <strong className="block font-size-125 font-weight-bold text-align-center margin-0 padding-top-125">{t("forms:goal.preview")}</strong>
        <p className="text-align-center margin-top-50">{t("forms:goal.preview_info")}</p>
        <output className="display-block" style={{ height: '400px' }}>
          <GoalGraph
            chartType="preview"
            series={{
              main: previewDataSerie?.dateValues ? { ...previewDataSerie, name: t("common:goal_one") } : undefined,
              baseline: storedSeriesForGraph(goal.baseline, t("graphs:common.baseline_scenario")),
              historical: storedHistoricalForGraph(goal, t),
            }}
          />
        </output>
      </div>

      <div className="margin-top-400 padding-top-100 margin-bottom-100 min-width-0" style={{ borderTop: "1px solid var(--gray-80)" }}>
        <button
          id="submit-button"
          type="submit"
          className="text-align-center seagreen color-purewhite width-100"
          style={{ fontSize: "14px", transform: "none" }}
        >
          {t("common:tsx.save_changes")}
        </button>
      </div>
    </form>
  );
}
