import "server-only";
import getPxWebTableContent from "@/lib/api/pxWeb/getPxWebTableContent";
import getPxWebTableMetadata from "@/lib/api/pxWeb/getPxWebTableMetadata";
import getTrafaTableContent from "@/lib/api/trafa/getTrafaTableContent";
import { ExternalDataset } from "@/lib/api/utility";
import { fetchExternalVariableData } from "@/functions/recipe/extractors";
import { RecipeDataTypes, VectorIndexPickerOptions } from "@/functions/recipe/types/enums";
import { buildRegionSelection, CuratedRegionKind, findRegionCodeByLabel, getCuratedHistoricalCatalog } from "@/lib/curatedHistoricalData";
import { UnitFlags } from "@/types/enums";
import { cacheLife, cacheTag } from "next/cache";
import type { CuratedHistoricalCatalog, CuratedHistoricalCatalogKey, CuratedHistoricalEntry, CuratedSeries, CuratedSource } from "@/lib/curatedHistoricalData";
import type { ApiSelectionItem, ApiTableContent, DatasetKeys } from "@/lib/api/apiTypes";
import type { ExternalVariable } from "@/functions/recipe/types";
import type { DateValues } from "@/types";
import type { GeoAreaType } from "@/lib/prisma/generated";
import type { TFunction } from "i18next";

export type CuratedGeoArea = { code: string, name: string, type: GeoAreaType };

export type CuratedHistoricalSeriesData = Pick<CuratedSeries, "key" | "name"> & {
  /** The source that served this geo area's level. */
  source: CuratedSource;
  dateValues: DateValues;
};

export type CuratedHistoricalEntryData = Omit<CuratedHistoricalEntry, "series"> & {
  series: CuratedHistoricalSeriesData[];
};

export type CuratedHistoricalCatalogData = Omit<CuratedHistoricalCatalog, "entries"> & {
  entries: CuratedHistoricalEntryData[];
};

/**
 * Fetches one curated historical catalog for a geo area. Series whose source
 * has no data for the area (or no source for its level) are dropped, and so
 * are entries left without series, so callers can render what comes back as-is.
 *
 * Not a public endpoint (`server-only`, no `"use server"`), so unlike the
 * scb*Query proxies this needs no guardExternalApi: the upstream traffic is
 * bounded by the catalog size and the days-long cache below.
 */
export async function getCuratedHistoricalData(t: TFunction, catalogKey: CuratedHistoricalCatalogKey, geoArea: CuratedGeoArea): Promise<CuratedHistoricalCatalogData> {
  const catalog = getCuratedHistoricalCatalog(t, catalogKey, geoArea.name);
  const area = { code: geoArea.code, type: geoArea.type };

  // The series are fetched one at a time per dataset (datasets in parallel):
  // on a cold cache a catalog is a dozen requests to the same upstream, and
  // Energimyndigheten in particular answers bursts with 429s.
  const seriesByDataset = new Map<DatasetKeys, { id: string, source: CuratedSource }[]>();
  for (const entry of catalog.entries) {
    for (const series of entry.series) {
      const source = series.sources[geoArea.type];
      if (!source) continue;
      const group = seriesByDataset.get(source.dataset) ?? [];
      group.push({ id: `${entry.key}/${series.key}`, source });
      seriesByDataset.set(source.dataset, group);
    }
  }

  const results = new Map<string, DateValues | null>();
  await Promise.all([...seriesByDataset.values()].map(async group => {
    for (const { id, source } of group) {
      results.set(id, await getCachedSeries(source, area));
    }
  }));

  const entries = catalog.entries.map(entry => ({
    ...entry,
    series: entry.series.flatMap(series => {
      const source = series.sources[geoArea.type];
      const dateValues = results.get(`${entry.key}/${series.key}`);
      if (!source || !dateValues || Object.keys(dateValues).length === 0) return [];
      return [{ key: series.key, name: series.name, source, dateValues }];
    }),
  }));

  return { ...catalog, entries: entries.filter(entry => entry.series.length > 0) };
}

/**
 * Cache-scoped core: resolve the region, then fetch + parse one external
 * series. Failures are cached as null rather than thrown so an area a table
 * doesn't cover doesn't re-hit the upstream API on every page view; the
 * tradeoff is that a transient upstream outage also sticks for the cache
 * duration (clear with `revalidateTag('curatedHistoricalData')`).
 */
async function getCachedSeries(source: CuratedSource, geoArea: { code: string, type: GeoAreaType }): Promise<DateValues | null> {
  'use cache';
  cacheTag('curatedHistoricalData');
  cacheLife("days");

  const { dataset, tableId } = source;

  try {
    const regionSelection = await resolveRegionSelection(source, geoArea);
    if (!regionSelection) {
      console.debug(`Curated historical series from ${dataset} table ${tableId} has no region matching geo area ${geoArea.code}`);
      return null;
    }

    const variable: ExternalVariable = {
      // Only surfaces in warning/error logs; display names live in the catalog
      id: `curated-${tableId}`,
      name: `curated-${tableId}`,
      type: RecipeDataTypes.External,
      pick: VectorIndexPickerOptions.Default,
      unit: UnitFlags.Missing,
      dataset,
      tableId,
      selection: [...regionSelection, ...source.selection],
    };

    const { dateValues } = await fetchExternalVariableData(variable, [], getTableContent);
    return dateValues;
  } catch (err) {
    console.error(`Error fetching curated historical series from ${dataset} table ${tableId}`, { selection: source.selection, geoArea, err });
    return null;
  }
}

async function resolveRegionSelection(source: CuratedSource, geoArea: { code: string, type: GeoAreaType }): Promise<ApiSelectionItem[] | null> {
  if (source.region.kind !== CuratedRegionKind.PxWebLabelPrefix) {
    return buildRegionSelection(source.region, geoArea);
  }

  const { variableCode } = source.region;
  const metadata = await getCachedPxWebTableMetadata(source.tableId, source.dataset);
  const dimension = metadata?.regularDimensions.find(dimension => dimension.id === variableCode);
  if (!dimension) {
    console.error(`Curated historical source ${source.dataset} table ${source.tableId} has no region dimension "${variableCode}"`);
    return null;
  }
  return buildRegionSelection(source.region, geoArea, findRegionCodeByLabel(dimension.options, geoArea.code));
}

/** Region resolution needs the same table's metadata for every series and area; share it across them. */
async function getCachedPxWebTableMetadata(tableId: string, dataset: DatasetKeys) {
  'use cache';
  cacheTag('curatedHistoricalData');
  cacheLife("days");

  return getPxWebTableMetadata(tableId, dataset);
}

/** Cache-safe counterpart of `getTableContent`: the same dispatch, over the unguarded cores. */
async function getTableContent(tableId: string, externalDataset: string, selection: ApiSelectionItem[]): Promise<ApiTableContent | null> {
  const dataset = ExternalDataset.getDatasetByAlternateName(externalDataset);
  if (dataset?.api === "PxWeb") {
    return getPxWebTableContent(tableId, externalDataset, selection, "sv");
  } else if (dataset?.api === "Trafa") {
    return getTrafaTableContent(tableId, selection, "sv");
  }
  return null;
}
