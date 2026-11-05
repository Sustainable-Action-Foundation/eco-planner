import type { ApiSelectionItem } from "@/lib/api/apiTypes";
import type { CuratedHistoricalCatalog, CuratedHistoricalEntry, CuratedSeries, CuratedSource } from "@/lib/curatedHistoricalData";
import type { GeoAreaType } from "@/lib/prisma/generated";
import type { DateValues } from "@/types";

/*
 * The curated historical catalog once fetched for a geo area: the shapes the
 * fetcher (`@/fetchers/getCuratedHistoricalData`) hands out, and the pure step
 * that assembles them from each series' fetch outcome, kept apart from the
 * fetcher so it can be tested without an upstream.
 */

export type CuratedHistoricalSeriesData = Pick<CuratedSeries, "key" | "name"> & {
  /** The source that served this geo area's level. */
  source: CuratedSource;
  /** The source's selection with the geo area's region injected: what was actually queried, reusable as-is in a recipe. */
  selection: ApiSelectionItem[];
  dateValues: DateValues;
};

/**
 * A series whose source failed to answer (network error, rate limit, server
 * error), so whether the area has data for it is unknown. Unlike a series the
 * source has no data for, which is dropped, it is kept so a page can say so.
 */
export type CuratedHistoricalUnavailableSeries = Pick<CuratedSeries, "key" | "name"> & {
  /** The source that failed for this geo area's level. */
  source: CuratedSource;
};

export type CuratedHistoricalEntryData = Omit<CuratedHistoricalEntry, "series"> & {
  /** The series with data for the area, in catalog order. */
  series: CuratedHistoricalSeriesData[];
  /** The series whose source failed to answer, in catalog order; empty when every source answered. */
  unavailable: CuratedHistoricalUnavailableSeries[];
};

export type CuratedHistoricalCatalogData = Omit<CuratedHistoricalCatalog, "entries"> & {
  entries: CuratedHistoricalEntryData[];
};

/** What fetching one series' source for an area came to. */
export type CuratedSeriesOutcome = {
  /** The fetched series; null when the source has no data for the area, and when the fetch failed. */
  series: { selection: ApiSelectionItem[], dateValues: DateValues } | null;
  /** Whether a request behind the result failed (network error, rate limit, server error). */
  failed: boolean;
};

/** The key a series' outcome is filed under in `assembleCuratedEntries`. */
export function curatedSeriesId(entryKey: string, seriesKey: string): string {
  return `${entryKey}/${seriesKey}`;
}

/**
 * Assembles the entries for a geo area from the outcome of fetching each
 * series' source for the area's level (keyed by `curatedSeriesId`). Series
 * without a source for the level, without an outcome, or without data for the
 * area are dropped; series whose fetch failed are kept apart as `unavailable`;
 * entries left with neither are dropped.
 */
export function assembleCuratedEntries(
  catalogEntries: CuratedHistoricalEntry[],
  level: GeoAreaType,
  outcomes: ReadonlyMap<string, CuratedSeriesOutcome>,
): CuratedHistoricalEntryData[] {
  const entries = catalogEntries.map(entry => {
    const series: CuratedHistoricalSeriesData[] = [];
    const unavailable: CuratedHistoricalUnavailableSeries[] = [];
    for (const candidate of entry.series) {
      const source = candidate.sources[level];
      const outcome = source ? outcomes.get(curatedSeriesId(entry.key, candidate.key)) : undefined;
      if (!source || !outcome) continue;
      if (outcome.series && Object.keys(outcome.series.dateValues).length > 0) {
        series.push({ key: candidate.key, name: candidate.name, source, selection: outcome.series.selection, dateValues: outcome.series.dateValues });
      } else if (outcome.failed) {
        unavailable.push({ key: candidate.key, name: candidate.name, source });
      }
    }
    return { ...entry, series, unavailable };
  });

  return entries.filter(entry => entry.series.length > 0 || entry.unavailable.length > 0);
}
