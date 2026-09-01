import "server-only";
import { getCuratedHistoricalEntry } from "@/fetchers/getCuratedHistoricalData";
import { getUserOrgs } from "@/fetchers/getUserOrgs";
import { Recipe } from "@/functions/recipe/recipe";
import { parseUnit } from "@/functions/unit";
import { parseSeriesRef, SeriesRefKind } from "@/lib/seriesRef";
import type { CuratedGeoArea } from "@/fetchers/getCuratedHistoricalData";
import type { SeriesRef } from "@/lib/seriesRef";
import type { GoalFormPrefill, PrefilledSeries } from "@/types";
import type { TFunction } from "i18next";

/**
 * Resolves a series reference (see `seriesRef`) into a series the goal form
 * can start from: the display name and unit, plus a recipe reading the series
 * from its source — the same recipe the form's external data input builds
 * when the user picks that selection by hand.
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
      const recipe = Recipe.fromExternalSource({
        name,
        dataset: series.source.dataset,
        tableId: series.source.tableId,
        selection: series.selection,
      });
      // The source's unit is declared on the recipe, like a manual series' is,
      // since the upstream table metadata doesn't carry a usable one
      if (entry.unit) recipe.unit = parseUnit(entry.unit);
      return { name, unit: entry.unit, recipe: recipe.serialize() };
    }
    default: {
      return null;
    }
  }
}

/**
 * The goal creation form's prefill, from its link's search params: `org` names
 * the org whose geo area the refs are resolved for, `historical` and
 * `dataSeries` carry the refs (see `seriesRef`). `failed` is true when a ref
 * was given but could not be resolved (or the org isn't one of the user's),
 * so the page can say the link didn't work rather than silently starting empty.
 */
export async function getGoalFormPrefill(
  t: TFunction,
  params: { org?: string | string[], historical?: string | string[], dataSeries?: string | string[] },
): Promise<{ prefill: GoalFormPrefill, failed: boolean }> {
  const refs = {
    historical: parseSeriesRef(params.historical),
    dataSeries: parseSeriesRef(params.dataSeries),
  };
  const requested = typeof params.historical === "string" || typeof params.dataSeries === "string";
  if (!requested) return { prefill: {}, failed: false };

  const orgId = typeof params.org === "string" ? params.org : "";
  const geoArea = (await getUserOrgs()).find(org => org.id === orgId)?.geoArea ?? null;
  if (!geoArea) return { prefill: {}, failed: true };

  const [historical, dataSeries] = await Promise.all([
    refs.historical ? resolveSeriesRef(t, refs.historical, geoArea) : null,
    refs.dataSeries ? resolveSeriesRef(t, refs.dataSeries, geoArea) : null,
  ]);

  const failed = (typeof params.historical === "string" && !historical) || (typeof params.dataSeries === "string" && !dataSeries);
  return {
    prefill: { ...(historical ? { historical } : {}), ...(dataSeries ? { dataSeries } : {}) },
    failed,
  };
}
