import "server-only";
import { getCuratedHistoricalEntry } from "@/fetchers/getCuratedHistoricalData";
import { getUserOrgs } from "@/fetchers/getUserOrgs";
import { RecipeDataTypes, VectorIndexPickerOptions } from "@/functions/recipe/types/enums";
import { parseSeriesRef, SeriesRefKind } from "@/lib/seriesRef";
import { UnitFlags } from "@/types/enums";
import type { CuratedGeoArea } from "@/fetchers/getCuratedHistoricalData";
import type { SeriesRef } from "@/lib/seriesRef";
import type { PrefilledSeries } from "@/types";
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
          // The unit is declared on the recipes built from this instead (see
          // `prefilledSeriesRecipe`): the table metadata carries no usable one
          unit: UnitFlags.Missing,
          dataset: series.source.dataset,
          tableId: series.source.tableId,
          selection: series.selection,
        },
      };
    }
    default: {
      return null;
    }
  }
}

/**
 * The series the goal creation form should start from, from its link's search
 * params: `series` carries the ref (see `seriesRef`) and `org` names the org
 * whose geo area it is resolved for. `failed` is true when a ref was given but
 * could not be resolved (or the org isn't one of the user's), so the page can
 * say the link didn't work rather than silently starting empty.
 */
export async function getPrefilledSeries(
  t: TFunction,
  params: { org?: string | string[], series?: string | string[] },
): Promise<{ series: PrefilledSeries | null, failed: boolean }> {
  if (typeof params.series !== "string") return { series: null, failed: false };

  const ref = parseSeriesRef(params.series);
  const orgId = typeof params.org === "string" ? params.org : "";
  const geoArea = (await getUserOrgs()).find(org => org.id === orgId)?.geoArea ?? null;
  if (!ref || !geoArea) return { series: null, failed: true };

  const series = await resolveSeriesRef(t, ref, geoArea);
  return { series, failed: !series };
}
