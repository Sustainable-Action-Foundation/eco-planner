import { expect, test } from "playwright/test";

import { assembleCuratedEntries, curatedSeriesId } from "../../src/functions/curatedEntries";
import type { CuratedSeriesOutcome } from "../../src/functions/curatedEntries";
import { CuratedHistoricalCategory, CuratedRegionKind } from "../../src/lib/curatedHistoricalData";
import type { CuratedHistoricalEntry, CuratedSource } from "../../src/lib/curatedHistoricalData";
import { GeoAreaType } from "../../src/lib/prisma/generated";

/*
 * The step between fetching the curated series and rendering them: a series
 * the source has no data for is dropped, one whose source failed to answer is
 * kept as unavailable, so an outage reads as such rather than as a missing entry.
 */

const source: CuratedSource = {
  dataset: "STEM",
  tableId: "EN0105_4",
  selection: [{ variableCode: "ContentsCode", valueCodes: ["0"] }],
  region: { kind: CuratedRegionKind.PxWebLabelPrefix, variableCode: "Kommun" },
};

function entry(key: string, seriesKeys: string[], sources: Partial<Record<GeoAreaType, CuratedSource>> = { [GeoAreaType.MUNICIPALITY]: source }): CuratedHistoricalEntry {
  return {
    key,
    category: CuratedHistoricalCategory.WindPower,
    name: `${key} name`,
    description: `${key} description`,
    unit: "antal",
    series: seriesKeys.map(seriesKey => ({ key: seriesKey, name: `${seriesKey} name`, sources })),
  };
}

const loaded: CuratedSeriesOutcome = { series: { selection: source.selection, dateValues: { "2020-01-01T00:00:00Z": 3 } }, failed: false };
const noData: CuratedSeriesOutcome = { series: null, failed: false };
const emptyData: CuratedSeriesOutcome = { series: { selection: source.selection, dateValues: {} }, failed: false };
const failedFetch: CuratedSeriesOutcome = { series: null, failed: true };

test.describe("Curated entries from series outcomes", () => {
  test("a series that loaded is kept with its values; one without data is dropped", () => {
    const outcomes = new Map([
      [curatedSeriesId("mixed", "a"), loaded],
      [curatedSeriesId("mixed", "b"), noData],
      [curatedSeriesId("mixed", "c"), emptyData],
    ]);
    const [result] = assembleCuratedEntries([entry("mixed", ["a", "b", "c"])], GeoAreaType.MUNICIPALITY, outcomes);
    expect(result.series.map(series => series.key)).toEqual(["a"]);
    expect(result.series[0]).toMatchObject({ name: "a name", source, selection: source.selection, dateValues: { "2020-01-01T00:00:00Z": 3 } });
    expect(result.unavailable).toEqual([]);
  });

  test("a series whose source failed is kept as unavailable, not dropped", () => {
    const outcomes = new Map([
      [curatedSeriesId("partial", "a"), loaded],
      [curatedSeriesId("partial", "b"), failedFetch],
    ]);
    const [result] = assembleCuratedEntries([entry("partial", ["a", "b"])], GeoAreaType.MUNICIPALITY, outcomes);
    expect(result.series.map(series => series.key)).toEqual(["a"]);
    expect(result.unavailable).toEqual([{ key: "b", name: "b name", source }]);
  });

  test("an entry whose every source failed survives with no loaded series", () => {
    const outcomes = new Map([[curatedSeriesId("down", "a"), failedFetch]]);
    const [result] = assembleCuratedEntries([entry("down", ["a"])], GeoAreaType.MUNICIPALITY, outcomes);
    expect(result.series).toEqual([]);
    expect(result.unavailable.map(series => series.key)).toEqual(["a"]);
  });

  test("entries without data, without a source for the level, or without an outcome are dropped", () => {
    const outcomes = new Map([
      [curatedSeriesId("empty", "a"), noData],
      [curatedSeriesId("wrong-level", "a"), loaded],
    ]);
    const entries = [
      entry("empty", ["a"]),
      entry("wrong-level", ["a"], { [GeoAreaType.COUNTY]: source }),
      entry("unfetched", ["a"]),
    ];
    expect(assembleCuratedEntries(entries, GeoAreaType.MUNICIPALITY, outcomes)).toEqual([]);
  });

  test("values that arrived despite a flagged failure count as loaded", () => {
    const outcomes = new Map([[curatedSeriesId("flaky", "a"), { ...loaded, failed: true }]]);
    const [result] = assembleCuratedEntries([entry("flaky", ["a"])], GeoAreaType.MUNICIPALITY, outcomes);
    expect(result.series.map(series => series.key)).toEqual(["a"]);
    expect(result.unavailable).toEqual([]);
  });

  test("entries keep catalog order", () => {
    const outcomes = new Map([
      [curatedSeriesId("second", "a"), failedFetch],
      [curatedSeriesId("first", "a"), loaded],
    ]);
    const result = assembleCuratedEntries([entry("first", ["a"]), entry("second", ["a"])], GeoAreaType.MUNICIPALITY, outcomes);
    expect(result.map(entry => entry.key)).toEqual(["first", "second"]);
  });
});
