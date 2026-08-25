import "server-only";
import getPxWebTableContent from "@/lib/api/pxWeb/getPxWebTableContent";
import { fetchExternalVariableData } from "@/functions/recipe/extractors";
import { RecipeDataTypes, VectorIndexPickerOptions } from "@/functions/recipe/types/enums";
import { getCuratedHistoricalCatalog } from "@/lib/curatedHistoricalData";
import { UnitFlags } from "@/types/enums";
import { cacheLife, cacheTag } from "next/cache";
import type { CuratedHistoricalEntry } from "@/lib/curatedHistoricalData";
import type { ApiSelectionItem } from "@/lib/api/apiTypes";
import type { ExternalVariable } from "@/functions/recipe/types";
import type { DateValues } from "@/types";
import type { TFunction } from "i18next";

export type CuratedHistoricalSeries = CuratedHistoricalEntry & {
  /** The entry's selection with the Region dimension filled in. */
  selection: ApiSelectionItem[];
  dateValues: DateValues;
};

/**
 * Fetches the curated historical catalog for one geo area. Entries whose table
 * has no data for the area (e.g. counties in the municipality-only emissions
 * table) are dropped, so callers can render whatever comes back as-is.
 *
 * Not a public endpoint (`server-only`, no `"use server"`), so unlike the
 * scb*Query proxies this needs no guardExternalApi: the upstream traffic is
 * bounded by the catalog size and the days-long cache below.
 */
export async function getCuratedHistoricalData(t: TFunction, geoAreaCode: string): Promise<CuratedHistoricalSeries[]> {
  const catalog = getCuratedHistoricalCatalog(t);

  const series = await Promise.all(catalog.map(async entry => {
    const selection: ApiSelectionItem[] = [
      { variableCode: "Region", valueCodes: [geoAreaCode] },
      ...entry.selection,
    ];
    const dateValues = await getCachedSeries(entry.dataset, entry.tableId, selection);
    if (!dateValues || Object.keys(dateValues).length === 0) return null;
    return { ...entry, selection, dateValues };
  }));

  return series.filter(entry => entry !== null);
}

/**
 * Cache-scoped core: fetch + parse one external series. Failures are cached as
 * null rather than thrown so an area a table doesn't cover doesn't re-hit the
 * upstream API on every page view; the tradeoff is that a transient upstream
 * outage also sticks for the cache duration (clear with
 * `revalidateTag('curatedHistoricalData')`).
 */
async function getCachedSeries(dataset: CuratedHistoricalEntry["dataset"], tableId: string, selection: ApiSelectionItem[]): Promise<DateValues | null> {
  'use cache';
  cacheTag('curatedHistoricalData');
  cacheLife("days");

  const variable: ExternalVariable = {
    // Only surfaces in warning/error logs; display names live in the catalog
    id: `curated-${tableId}`,
    name: `curated-${tableId}`,
    type: RecipeDataTypes.External,
    pick: VectorIndexPickerOptions.Default,
    unit: UnitFlags.Missing,
    dataset,
    tableId,
    selection,
  };

  try {
    const { dateValues } = await fetchExternalVariableData(variable, [],
      (tableId, dataset, selection) => getPxWebTableContent(tableId, dataset, selection, "sv"),
    );
    return dateValues;
  } catch (err) {
    console.error(`Error fetching curated historical series from ${dataset} table ${tableId}`, { selection, err });
    return null;
  }
}
