import "server-only";
import { getCuratedHistoricalEntry } from "@/fetchers/getCuratedHistoricalData";
import { getOneGoal } from "@/fetchers/getOneGoal";
import { getUserOrgs } from "@/fetchers/getUserOrgs";
import { goalDisplayName } from "@/functions/goalName";
import { localAnchor } from "@/functions/localScale";
import { RecipeDataTypes, VectorIndexPickerOptions } from "@/functions/recipe/types/enums";
import { parseSeriesRef, SeriesRefKind } from "@/lib/seriesRef";
import { parseUnit } from "@/functions/unit";
import { UnitFlags } from "@/types/enums";
import type { CuratedGeoArea } from "@/fetchers/getCuratedHistoricalData";
import type { SeriesRef } from "@/lib/seriesRef";
import type { DateValues, GoalPrefill, PrefilledSeries } from "@/types";
import type { TFunction } from "i18next";

/**
 * Resolves a series reference (see `seriesRef`) into a series the goal form
 * can start from: the display name and unit, plus a recipe variable reading
 * the series from its source — the same variable the form's external data
 * input builds when the user picks that selection by hand.
 *
 * Curated refs are resolved for a geo area, since the catalog is localized
 * per area. Null when the ref doesn't resolve (unknown entry/series, or no data
 * for the area).
 */
export async function resolveSeriesRef(t: TFunction, ref: SeriesRef, geoArea: CuratedGeoArea): Promise<PrefilledSeries | null> {
  switch (ref.kind) {
    case SeriesRefKind.Curated: {
      const entry = await getCuratedHistoricalEntry(t, geoArea, ref.entryKey);
      const series = entry?.series.find(series => series.key === ref.seriesKey);
      if (!entry || !series) return null;

      // A multi-series entry's series are only distinct together with the entry ("Passenger cars by fuel: Electric")
      const name = entry.series.length > 1 ? `${entry.name}: ${series.name}` : entry.name;
      return {
        name,
        unit: entry.unit,
        variable: {
          id: crypto.randomUUID(),
          name,
          type: RecipeDataTypes.External,
          pick: VectorIndexPickerOptions.Default,
          // The catalog's declared unit, since the table metadata carries no usable
          // one; lets evaluation convert and check it like any other unit
          unit: parseUnit(entry.unit),
          dataset: series.source.dataset,
          tableId: series.source.tableId,
          selection: series.selection,
        },
        dateValues: series.dateValues,
      };
    }
    default: {
      return null;
    }
  }
}

/**
 * A goal to copy, as the parent the suggested methods scale: a variable
 * linked to its data series (read through the access-checked series fetcher
 * at evaluation time, so no values travel in the link). Null when the goal
 * isn't visible to the user or has no data series.
 */
async function resolveCopiedGoal(goalId: string): Promise<{ series: PrefilledSeries, copy: NonNullable<GoalPrefill["copy"]> } | null> {
  const goal = await getOneGoal(goalId);
  if (!goal?.data_series) return null;

  const name = goalDisplayName(goal);
  return {
    series: {
      name,
      unit: goal.data_series.unit || null,
      variable: {
        id: crypto.randomUUID(),
        name,
        type: RecipeDataTypes.DataSeries,
        pick: VectorIndexPickerOptions.Default,
        unit: UnitFlags.Missing,
        dataSeriesId: goal.data_series.id,
        value: null,
      },
      dateValues: Object.fromEntries(goal.data_series.values.map(record => [record.timestamp.toISOString(), record.value])) as DateValues,
    },
    copy: {
      name: goal.name,
      description: goal.description,
      indicatorParameter: goal.indicator_parameter,
    },
  };
}

/**
 * What the goal creation form should start from, from its link's search
 * params: `series` carries a ref (see `seriesRef`) resolved for the geo area of
 * the org named by `org`, and `from` optionally names a goal to copy, whose
 * data series then becomes the parent the suggested methods scale, with the
 * series as the local level to scale it to. `failed` is true when a
 * param was given but could not be resolved (or the org isn't one of the
 * user's), so the page can say the link didn't work rather than silently
 * starting empty.
 */
export async function getGoalPrefill(
  t: TFunction,
  params: { org?: string | string[], series?: string | string[], from?: string | string[] },
): Promise<{ prefill: GoalPrefill | null, failed: boolean }> {
  if (typeof params.series !== "string") return { prefill: null, failed: typeof params.from === "string" };

  const ref = parseSeriesRef(params.series);
  const orgId = typeof params.org === "string" ? params.org : "";
  const geoArea = (await getUserOrgs()).find(org => org.id === orgId)?.geoArea ?? null;
  if (!ref || !geoArea) return { prefill: null, failed: true };

  const historical = await resolveSeriesRef(t, ref, geoArea);
  if (!historical) return { prefill: null, failed: true };
  if (typeof params.from !== "string") {
    return { prefill: { historical, parent: historical }, failed: false };
  }

  // Copying a goal: the local statistic once more (with its own variable id) is
  // the level the goal's trajectory is scaled to
  const [copied, local] = await Promise.all([resolveCopiedGoal(params.from), resolveSeriesRef(t, ref, geoArea)]);
  if (!copied || !local) return { prefill: null, failed: true };

  // A goal that is zero in the anchor year has no development to follow from
  // the local level; the copy then starts from the goal as is
  const anchor = localAnchor(local.dateValues ?? {}, copied.series.dateValues ?? {});
  const localReference = anchor && anchor.goalValue !== 0 ? { series: local, year: anchor.year, goalValue: anchor.goalValue } : undefined;

  return {
    prefill: { historical, parent: copied.series, copy: copied.copy, ...(localReference ? { localReference } : {}) },
    failed: false,
  };
}
