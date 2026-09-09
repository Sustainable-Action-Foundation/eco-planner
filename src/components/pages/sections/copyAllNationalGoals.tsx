"use client";

import { useToast } from "@/components/generic/toast/toastContext.use";
import { DefaultSuggestedRecipeId, getDefaultSuggestedRecipes } from "@/components/recipe/suggestions/defaultSuggestedRecipes";
import { buildBaselineSection, prefilledSeriesRecipe } from "@/components/form/forms/goalSections";
import { clientSafeGetOneRoadmapIteration } from "@/fetchers/client";
import { scaleToLocal } from "@/functions/localScale";
import { Recipe } from "@/functions/recipe/recipe";
import { parseUnit } from "@/functions/unit";
import { iterationPath } from "@/functions/versionSlug";
import { GoalListing } from "@/lib/prisma/generated";
import { BaselineType, GoalDataTarget } from "@/types/enums";
import type { DateValuesWithUnit, GoalCreateInput, GoalPrefill } from "@/types";
import { IconCopy } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";

export type NationalGoalCopy = { goalId: string, name: string, prefill: GoalPrefill };
export type CopyTargetIteration = { id: string, roadmapId: string, version: number, name: string };

/**
 * Copies every matched national goal into one version of the org's roadmaps
 * in one go: each copy is exactly what the goal form would save from the
 * card's link with nothing changed (local history, the trajectory scaled to
 * the local level, a first-value baseline). Goals the version already has
 * (same indicator parameter) are skipped, so the button can be pressed again
 * after the catalog grows. Only goals with something to scale from are
 * offered: copied as is they would be the national figures, which is never
 * what a local roadmap wants.
 */
export default function CopyAllNationalGoals({ copies, iterations }: { copies: NationalGoalCopy[], iterations: CopyTargetIteration[] }) {
  const { t } = useTranslation(["pages", "forms", "components", "common"]);
  const { addToast } = useToast();
  const router = useRouter();
  const [iterationId, setIterationId] = useState(iterations[0]?.id ?? "");
  const [progress, setProgress] = useState<{ done: number, total: number } | null>(null);

  if (copies.length === 0 || iterations.length === 0) return null;

  async function copyAll() {
    const target = iterations.find(iteration => iteration.id === iterationId);
    if (!target) return;

    // Goals the version already has are skipped
    const existing = new Set((await clientSafeGetOneRoadmapIteration(target.id))?.goals.map(goal => goal.indicator_parameter) ?? []);
    const pending = copies.filter(copy => !existing.has(copy.prefill.copy?.indicatorParameter ?? ""));
    setProgress({ done: 0, total: pending.length });

    const failed: string[] = [];
    let created = 0;
    // One at a time: every copy materializes two external series server-side,
    // and the statistics APIs answer bursts with 429s
    for (const copy of pending) {
      try {
        const body = await buildCopyPayload(copy.prefill, target.id, t);
        const response = await fetch("/api/goal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        if (!response.ok) throw new Error(`${response.status}`);
        created++;
      }
      catch (err) {
        console.error(`Failed to copy national goal ${copy.goalId}`, err);
        failed.push(copy.name);
      }
      setProgress({ done: created + failed.length, total: pending.length });
    }

    addToast(t("pages:home.national_goals.copy_all_done", { created, skipped: copies.length - pending.length }), failed.length ? "warning" : "success", true);
    if (failed.length) addToast(t("pages:home.national_goals.copy_all_failed", { names: failed.join(", ") }), "error", false);
    setProgress(null);
    router.push(iterationPath(target.roadmapId, target.version));
    router.refresh();
  }

  return (
    <form
      className="flex gap-50 align-items-flex-end flex-wrap-wrap margin-bottom-100"
      onSubmit={(event) => { event.preventDefault(); void copyAll(); }}
    >
      <label className="flex-grow-100" style={{ maxWidth: '24rem' }}>
        {t("pages:home.national_goals.copy_all_target")}
        <select className="block margin-top-25 width-100" value={iterationId} onChange={event => setIterationId(event.target.value)} disabled={!!progress}>
          {iterations.map(iteration => <option key={iteration.id} value={iteration.id}>{iteration.name}</option>)}
        </select>
      </label>
      <button type="submit" className="seagreen color-purewhite round font-weight-500 display-inline-flex align-items-center gap-50" disabled={!!progress}>
        <IconCopy aria-hidden="true" width={18} height={18} style={{ minWidth: '18px' }} />
        {progress
          ? t("pages:home.national_goals.copy_all_progress", { done: progress.done, total: progress.total })
          : t("pages:home.national_goals.copy_all", { count: copies.length })}
      </button>
    </form>
  );
}

/** The goal form's create payload for a copy left as prefilled; the prefill has to carry a local reference. */
async function buildCopyPayload(prefill: GoalPrefill, iterationId: string, t: TFunction): Promise<GoalCreateInput> {
  const suggestion = getDefaultSuggestedRecipes(t, prefill.parent, prefill.localReference).find(recipe => recipe.id === DefaultSuggestedRecipeId.LocalScale);
  // What the method evaluates to (the same math as the preview), in the local statistic's unit
  const scaled = prefill.localReference ? scaleToLocal(prefill.parent.dateValues ?? {}, prefill.localReference.series.dateValues ?? {}) : null;
  if (!suggestion || !scaled) throw new Error("The copy has nothing to scale from");
  const dataSeriesRecipe = Recipe.from(suggestion.recipe).serialize();
  const dataSeries: DateValuesWithUnit = { dateValues: scaled, unit: parseUnit(prefill.localReference?.series.unit) };
  if (!prefill.historical) throw new Error("A national goal copy needs its local series");
  const historical: DateValuesWithUnit = { dateValues: prefill.historical.dateValues ?? {}, unit: parseUnit(prefill.historical.unit) };
  const { baseline, baselineRecipe } = await buildBaselineSection(new FormData(), BaselineType.Initial, dataSeries, t);

  return {
    target: GoalDataTarget.Full,
    goalId: undefined,
    timestamp: undefined,

    name: prefill.copy?.name ?? null,
    description: prefill.copy?.description ?? null,
    indicatorParameter: prefill.copy?.indicatorParameter ?? "",
    listing: GoalListing.LISTED,
    iterationId,
    recipeSuggestions: undefined,

    dataSeriesId: null,
    dataSeries,
    dataSeriesRecipeId: null,
    dataSeriesRecipe,

    baselineId: null,
    baseline,
    baselineRecipeId: null,
    baselineRecipe: baselineRecipe?.serialize() ?? null,

    historicalId: null,
    historical,
    historicalRecipeId: null,
    historicalRecipe: prefilledSeriesRecipe(prefill.historical),

    rawTags: undefined,
  };
}
