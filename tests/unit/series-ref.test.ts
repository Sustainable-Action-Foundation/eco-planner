import { expect, test } from "playwright/test";
import { formatSeriesRef, parseSeriesRef, SeriesRefKind } from "../../src/lib/seriesRef";

test.describe("Series refs", () => {
  test("round-trips a curated ref", () => {
    const ref = { kind: SeriesRefKind.Curated, entryKey: "cars-by-fuel", seriesKey: "electric" } as const;
    const formatted = formatSeriesRef(ref);
    expect(formatted).toBe("curated:cars-by-fuel/electric");
    expect(parseSeriesRef(formatted)).toEqual(ref);
  });

  test("accepts the kind case-insensitively", () => {
    expect(parseSeriesRef("CURATED:wind-capacity/capacity")).toEqual({ kind: SeriesRefKind.Curated, entryKey: "wind-capacity", seriesKey: "capacity" });
  });

  test("rejects malformed refs", () => {
    for (const raw of [
      undefined, null, "", "curated", "curated:", "curated:wind-capacity", "curated:wind-capacity/", "curated:/capacity",
      "curated:wind-capacity/capacity/extra", "curated:Wind Capacity/capacity", "curated:../etc/capacity", "series:abc", ["curated:a/b"],
    ]) {
      expect(parseSeriesRef(raw), `parsing ${JSON.stringify(raw)}`).toBeNull();
    }
  });
});
