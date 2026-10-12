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
import type { CuratedHistoricalCatalog, CuratedHistoricalEntry, CuratedSeries, CuratedSource } from "@/lib/curatedHistoricalData";
import type { ApiSelectionItem, ApiTableContent, DatasetKeys, PxWebCompatTableMetadata, UpstreamFailureReporter } from "@/lib/api/apiTypes";
import type { ExternalVariable } from "@/functions/recipe/types";
import type { DateValues } from "@/types";
import type { GeoAreaType } from "@/lib/prisma/generated";
import type { TFunction } from "i18next";

export type CuratedGeoArea = { code: string, name: string, type: GeoAreaType };

export type CuratedHistoricalSeriesData = Pick<CuratedSeries, "key" | "name"> & {
  /** The source that served this geo area's level. */
  source: CuratedSource;
  /** The source's selection with the geo area's region injected: what was actually queried, reusable as-is in a recipe. */
  selection: ApiSelectionItem[];
  dateValues: DateValues;
};

export type CuratedHistoricalEntryData = Omit<CuratedHistoricalEntry, "series"> & {
  series: CuratedHistoricalSeriesData[];
};

export type CuratedHistoricalCatalogData = Omit<CuratedHistoricalCatalog, "entries"> & {
  entries: CuratedHistoricalEntryData[];
};

/**
 * Fetches the curated historical catalog for a geo area. Series whose source
 * has no data for the area (or no source for its level) are dropped, and so
 * are entries left without series, so callers can render what comes back as-is.
 *
 * Not a public endpoint (`server-only`, no `"use server"`), so unlike the
 * scb*Query proxies this needs no guardExternalApi: the upstream traffic is
 * bounded by the catalog size and the days-long cache below.
 */
export async function getCuratedHistoricalData(t: TFunction, geoArea: CuratedGeoArea): Promise<CuratedHistoricalCatalogData> {
  const catalog = getCuratedHistoricalCatalog(t, geoArea.name);
  return { ...catalog, entries: await fetchEntries(catalog.entries.filter(entry => entry.listed !== false), geoArea) };
}

/**
 * One curated entry for a geo area, e.g. for the entry's own page; null when
 * the catalog has no such entry or none of its series have data for the area.
 * Only that entry's series are fetched.
 */
export async function getCuratedHistoricalEntry(t: TFunction, geoArea: CuratedGeoArea, entryKey: string): Promise<CuratedHistoricalEntryData | null> {
  const entry = getCuratedHistoricalCatalog(t, geoArea.name).entries.find(entry => entry.key === entryKey);
  if (!entry) return null;
  const [fetched] = await fetchEntries([entry], geoArea);
  return fetched ?? null;
}

/**
 * A subset of the catalog's entries for a geo area, fetched together (see
 * `fetchEntries` for why that matters), in catalog order. Unknown keys are
 * ignored; entries without data for the area are dropped like elsewhere.
 */
export async function getCuratedHistoricalEntries(t: TFunction, geoArea: CuratedGeoArea, entryKeys: Iterable<string>): Promise<CuratedHistoricalEntryData[]> {
  const wanted = new Set(entryKeys);
  const entries = getCuratedHistoricalCatalog(t, geoArea.name).entries.filter(entry => wanted.has(entry.key));
  return entries.length ? fetchEntries(entries, geoArea) : [];
}

/**
 * How many series of one dataset (one upstream) are requested at once on a cold cache.
 * Energimyndigheten (STEM) answers even 2 concurrent requests with 429s (measured 2026-10-12,
 * despite the PxWeb path's retry after Retry-After), so it stays strictly serial, and so does SCB
 * (also PxWeb, rate-limited per IP, not measured). Trafa took 3 at a time without complaint;
 * drop it to 2 if it starts answering 429.
 */
const seriesConcurrency: Record<DatasetKeys, number> = {
  STEM: 1,
  SCB: 1,
  SSB: 1,
  Trafa: 3,
};

async function fetchEntries(catalogEntries: CuratedHistoricalEntry[], geoArea: CuratedGeoArea): Promise<CuratedHistoricalEntryData[]> {
  const area = { code: geoArea.code, type: geoArea.type };

  // Datasets are fetched in parallel, but within a dataset at most
  // `seriesConcurrency[dataset]` series at a time: on a cold cache a catalog is
  // a dozen requests to the same upstream, and Energimyndigheten in particular
  // answers bursts with 429s. Strictly one at a time made a cold Trafa catalog
  // (8 series at ~300 ms) take ~2.5 s.
  const seriesByDataset = new Map<DatasetKeys, { id: string, source: CuratedSource }[]>();
  for (const entry of catalogEntries) {
    for (const series of entry.series) {
      const source = series.sources[geoArea.type];
      if (!source) continue;
      const group = seriesByDataset.get(source.dataset) ?? [];
      group.push({ id: `${entry.key}/${series.key}`, source });
      seriesByDataset.set(source.dataset, group);
    }
  }

  const results = new Map<string, CachedSeries | null>();
  await Promise.all([...seriesByDataset].map(async ([dataset, group]) => {
    // A few workers drain the dataset's queue, so no more than that many requests are in flight per upstream
    let next = 0;
    const worker = async () => {
      while (next < group.length) {
        const { id, source } = group[next++];
        results.set(id, await getCachedSeries(source, area));
      }
    };
    await Promise.all(Array.from({ length: Math.min(seriesConcurrency[dataset], group.length) }, worker));
  }));

  const entries = catalogEntries.map(entry => ({
    ...entry,
    series: entry.series.flatMap(series => {
      const source = series.sources[geoArea.type];
      const result = results.get(`${entry.key}/${series.key}`);
      if (!source || !result || Object.keys(result.dateValues).length === 0) return [];
      return [{ key: series.key, name: series.name, source, selection: result.selection, dateValues: result.dateValues }];
    }),
  }));

  return entries.filter(entry => entry.series.length > 0);
}

type CachedSeries = { selection: ApiSelectionItem[], dateValues: DateValues };

/**
 * Cache-scoped core: resolve the region, then fetch + parse one external series. A series the
 * upstream has no data for is cached as null for days, so an area a table doesn't cover doesn't
 * re-hit the upstream API on every page view. A failed request (network error, rate limit, server
 * error) is cached as null too, rather than thrown, so a rate-limited upstream isn't hit again on
 * every render, but only for minutes (clear either with `revalidateTag('curatedHistoricalData')`).
 */
async function getCachedSeries(source: CuratedSource, geoArea: { code: string, type: GeoAreaType }): Promise<CachedSeries | null> {
  'use cache: upstream';
  cacheTag('curatedHistoricalData');

  let failed = false;
  const series = await fetchSeries(source, geoArea, () => { failed = true; });
  // Exactly one cacheLife per invocation (the docs allow choosing it conditionally)
  if (failed) cacheLife("minutes");
  else cacheLife("days");
  return series;
}

async function fetchSeries(source: CuratedSource, geoArea: { code: string, type: GeoAreaType }, onFailure: UpstreamFailureReporter): Promise<CachedSeries | null> {
  const { dataset, tableId } = source;

  try {
    const regionSelection = await resolveRegionSelection(source, geoArea, onFailure);
    if (!regionSelection) {
      console.debug(`Curated historical series from ${dataset} table ${tableId} has no region matching geo area ${geoArea.code}`);
      return null;
    }

    const selection = [...regionSelection, ...source.selection];
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

    const { dateValues } = await fetchExternalVariableData(variable, [], (tableId, dataset, selection) => getTableContent(tableId, dataset, selection, onFailure));
    return { selection, dateValues };
  } catch (err) {
    console.error(`Error fetching curated historical series from ${dataset} table ${tableId}`, { selection: source.selection, geoArea, err });
    return null;
  }
}

async function resolveRegionSelection(source: CuratedSource, geoArea: { code: string, type: GeoAreaType }, onFailure: UpstreamFailureReporter): Promise<ApiSelectionItem[] | null> {
  if (source.region.kind !== CuratedRegionKind.PxWebLabelPrefix) {
    return buildRegionSelection(source.region, geoArea);
  }

  const { variableCode } = source.region;
  const { metadata, failed } = await getCachedPxWebTableMetadata(source.tableId, source.dataset);
  if (failed) onFailure();
  const dimension = metadata?.regularDimensions.find(dimension => dimension.id === variableCode);
  if (!dimension) {
    console.error(`Curated historical source ${source.dataset} table ${source.tableId} has no region dimension "${variableCode}"`);
    return null;
  }
  return buildRegionSelection(source.region, geoArea, findRegionCodeByLabel(dimension.options, geoArea.code));
}

/**
 * Region resolution needs the same table's metadata for every series and area; share it across
 * them. `failed` marks a failed request, cached for minutes instead of days, and tells callers
 * that their own result rests on a failure.
 */
async function getCachedPxWebTableMetadata(tableId: string, dataset: DatasetKeys): Promise<{ metadata: PxWebCompatTableMetadata | null, failed: boolean }> {
  'use cache: upstream';
  cacheTag('curatedHistoricalData');

  let failed = false;
  const metadata = await getPxWebTableMetadata(tableId, dataset, undefined, undefined, { onFailure: () => { failed = true; } });
  if (failed) cacheLife("minutes");
  else cacheLife("days");
  return { metadata, failed };
}

/** Cache-safe counterpart of `getTableContent`: the same dispatch, over the unguarded cores. */
async function getTableContent(tableId: string, externalDataset: string, selection: ApiSelectionItem[], onFailure: UpstreamFailureReporter): Promise<ApiTableContent | null> {
  const dataset = ExternalDataset.getDatasetByAlternateName(externalDataset);
  if (dataset?.api === "PxWeb") {
    return getPxWebTableContent(tableId, externalDataset, selection, "sv", undefined, onFailure);
  } else if (dataset?.api === "Trafa") {
    return getTrafaTableContent(tableId, selection, "sv", onFailure);
  }
  return null;
}
