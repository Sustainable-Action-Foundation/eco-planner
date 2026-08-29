"use client";

import BaselineSeriesSection from "@/components/form/sections/dataseries/baseline";
import { GoalGraph } from "@/components/graph/graphs/goal/main";
import { waitForRecipeFormSyncs } from "@/components/recipe";
import { useToast } from "@/components/generic/toast/toastContext.use";
import formSubmitter from "@/functions/formSubmitter";
import { dataSeriesToDateValues } from "@/functions/recipe";
import type { DateValuesWithUnit, Goal, GoalUpdateInput } from "@/types";
import { BaselineType, GoalDataTarget } from "@/types/enums";
import { useRouter } from "next/navigation";
import { useMemo, useState, type SubmitEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  buildBaselineSection,
  GoalFormError,
  resolveBaselineType,
  storedHistoricalForGraph,
  storedSeriesForGraph,
  useInitializedValues,
} from "./goalSections";

/**
 * Edits only the baseline of an existing goal: the goal form's baseline section
 * on its own, submitted as a sectional update. Derived baselines (first value /
 * first non-zero value) are computed from the goal's stored data series.
 */
export default function BaselineForm({
  goal,
}: {
  goal: Goal;
}) {
  const { t } = useTranslation(["forms", "graphs", "common"]);
  const { addToast } = useToast();
  const router = useRouter();

  const initialBaselineType = useMemo(() => resolveBaselineType(goal), [goal]);
  const [baselineType, setBaselineType] = useState<BaselineType>(initialBaselineType);
  const initializedTypes = useInitializedValues(baselineType);
  const [previewBaselineSerie, setPreviewBaselineSerie] = useState<DateValuesWithUnit | null>(null);
  const [timestamp] = useState(() => Date.now());

  // The goal form feeds the section its live data series preview; here the
  // stored series is the fixed source the derived baseline types read from
  const dataSeries = useMemo<DateValuesWithUnit | null>(() => {
    try {
      return goal.data_series ? dataSeriesToDateValues(goal.data_series) : null;
    } catch {
      return null;
    }
  }, [goal.data_series]);

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

    if (!dataSeries) {
      addToast(t("forms:goal.errors.missing_date_values"), "error", false);
      return;
    }

    const formData = new FormData(event.target);

    let baseline: DateValuesWithUnit | undefined;
    let baselineRecipe: Awaited<ReturnType<typeof buildBaselineSection>>["baselineRecipe"];
    try {
      ({ baseline, baselineRecipe } = await buildBaselineSection(formData, baselineType, dataSeries, t));
    }
    catch (err) {
      if (!(err instanceof GoalFormError)) throw err;
      addToast(err.message, "error", false);
      return;
    }
    if (!baseline) {
      addToast(t("forms:goal.errors.missing_baseline"), "error", false);
      return;
    }

    formSubmitter("/api/goal", JSON.stringify({
      target: GoalDataTarget.Baseline,
      goalId: goal.id,
      timestamp: timestamp,
      baseline: baseline,
      baselineRecipe: baselineRecipe?.serialize() ?? undefined,
    } satisfies GoalUpdateInput), "PUT", t, undefined, undefined, undefined, undefined, addToast, (url) => router.push(url));
  }

  return (
    <form onSubmit={(event) => { void handleSubmit(event); }} name="goalForm">
      {/* This hidden submit button prevents submitting by pressing enter, to avoid accidental submission */}
      <button type="submit" disabled={true} className="display-none" aria-hidden={true} />

      <BaselineSeriesSection
        goal={goal}
        baselineType={baselineType}
        initialBaselineType={initialBaselineType}
        dataSeries={dataSeries}
        setBaselineType={setBaselineType}
        setPreviewBaselineSerie={setPreviewBaselineSerie}
        hasInitializedInitial={initializedTypes.has(BaselineType.Initial)}
        hasInitializedInitialNonZero={initializedTypes.has(BaselineType.InitialNonZero)}
        hasInitializedManual={initializedTypes.has(BaselineType.Custom)}
        hasInitializedInherited={initializedTypes.has(BaselineType.Inherited)}
      />

      <div className="margin-top-200 min-width-0">
        <strong className="block font-size-125 font-weight-bold text-align-center margin-0 padding-top-125 margin-bottom-50">{t("forms:goal.preview")}</strong>
        <output className="display-block" style={{ height: '400px' }}>
          <GoalGraph
            chartType="preview"
            series={{
              main: storedSeriesForGraph(goal.data_series, goal.name ?? t("common:goal_one")),
              baseline: previewBaselineSerie?.dateValues ? { ...previewBaselineSerie, name: t("graphs:common.baseline_scenario") } : undefined,
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
