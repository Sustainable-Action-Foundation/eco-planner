import { expect, test } from "playwright/test";

import dataSeriesInterest, { derive } from "../../src/functions/weightedAverageDelta";
import type { DataSeries, DateValues, ISOIshDate } from "../../src/types";

/*
 * "Interest" = mean over the yearly rates of change of (|rate| / max |rate|) × 0.9^(years from now).
 * `now` is injected; the series fixtures use consecutive non-leap years so the
 * rates are exact multiples of each other.
 */

const iso = (year: number): ISOIshDate => `${year}-01-01T00:00:00.000Z`;
const DAYS_PER_YEAR = 365.24;
/** The derivative over a 365-day year, as the function computes it */
const perYear = (delta: number, days = 365) => delta / (days / DAYS_PER_YEAR);

function series(values: Record<number, number>, unit: string | null = null): DataSeries {
  return {
    id: "series",
    unit,
    values: Object.entries(values).map(([year, value]) => ({ timestamp: new Date(iso(Number(year))), value, data_series_id: "series" })),
  };
}

test.describe("derive", () => {
  test("is the rate of change per year, keyed by the later date", () => {
    const derived = derive({ [iso(2021)]: 0, [iso(2022)]: 10, [iso(2023)]: 15 });
    expect(Object.keys(derived)).toEqual([iso(2022), iso(2023)]);
    expect(derived[iso(2022)]).toBeCloseTo(perYear(10), 10);
    expect(derived[iso(2023)]).toBeCloseTo(perYear(5), 10);
  });

  test("spans multi-year gaps and leap years by the actual day count", () => {
    const derived = derive({ [iso(2020)]: 0, [iso(2022)]: 20 });
    expect(derived[iso(2022)]).toBeCloseTo(perYear(20, 731), 10);
  });

  test("sorts the dates before differencing", () => {
    const ordered = derive({ [iso(2021)]: 0, [iso(2022)]: 10 });
    const reversed = derive({ [iso(2022)]: 10, [iso(2021)]: 0 });
    expect(reversed).toEqual(ordered);
  });

  test("skips pairs with a non-finite end", () => {
    expect(derive({ [iso(2021)]: 0, [iso(2022)]: NaN, [iso(2023)]: 5 })).toEqual({});
    expect(derive({ [iso(2021)]: 0, [iso(2022)]: Infinity })).toEqual({});
    const withGap = derive({ [iso(2021)]: 0, [iso(2022)]: NaN, [iso(2023)]: 5, [iso(2024)]: 6 });
    expect(Object.keys(withGap)).toEqual([iso(2024)]);
  });

  test("is empty for fewer than two points", () => {
    expect(derive({})).toEqual({});
    expect(derive({ [iso(2021)]: 1 })).toEqual({});
  });

  test("throws on keys that are not ISO-ish dates", () => {
    expect(() => derive({ "2021": 0, "2022": 1 } as unknown as DateValues)).toThrow(/non-date keys/);
  });
});

test.describe("dataSeriesInterest", () => {
  test("an empty or constant series is not interesting", () => {
    expect(dataSeriesInterest(series({}), new Date(iso(2025)))).toBe(0);
    expect(dataSeriesInterest(series({ 2024: 5 }), new Date(iso(2025)))).toBe(0);
    expect(dataSeriesInterest(series({ 2024: 5, 2025: 5, 2026: 5 }), new Date(iso(2025)))).toBe(0);
  });

  test("a single change is fully interesting the year it happens", () => {
    expect(dataSeriesInterest(series({ 2024: 0, 2025: 10 }), new Date(iso(2025)))).toBeCloseTo(1, 10);
    // Magnitude and sign do not matter when there is only one rate
    expect(dataSeriesInterest(series({ 2024: 0, 2025: -0.001 }), new Date(iso(2025)))).toBeCloseTo(1, 10);
  });

  test("decays by 10 % per year of distance from now, in both directions", () => {
    const change = series({ 2024: 0, 2025: 10 });
    expect(dataSeriesInterest(change, new Date(iso(2027)))).toBeCloseTo(0.9 ** 2, 10);
    expect(dataSeriesInterest(change, new Date(iso(2022)))).toBeCloseTo(0.9 ** 3, 10);
    expect(dataSeriesInterest(change, new Date(iso(2035)))).toBeCloseTo(0.9 ** 10, 10);
  });

  test("the reference year is read in UTC", () => {
    const change = series({ 2024: 0, 2025: 10 });
    expect(dataSeriesInterest(change, new Date("2025-12-31T23:59:59Z"))).toBeCloseTo(1, 10);
    expect(dataSeriesInterest(change, new Date("2026-01-01T00:00:00Z"))).toBeCloseTo(0.9, 10);
  });

  test("averages the magnitude-weighted, time-decayed rates", () => {
    // Rates: 10/yr at 2022 (one year out → 0.9), 5/yr at 2023 (now → 1): (1 × 0.9 + 0.5 × 1) / 2
    expect(dataSeriesInterest(series({ 2021: 0, 2022: 10, 2023: 15 }), new Date(iso(2023)))).toBeCloseTo(0.7, 10);
    // From 2022 the weights swap: (1 × 1 + 0.5 × 0.9) / 2
    expect(dataSeriesInterest(series({ 2021: 0, 2022: 10, 2023: 15 }), new Date(iso(2022)))).toBeCloseTo(0.725, 10);
  });

  test("defaults the reference time to now", () => {
    const year = new Date().getUTCFullYear();
    expect(dataSeriesInterest(series({ [year - 1]: 0, [year]: 10 }))).toBeCloseTo(1, 10);
  });

  test("the unit does not matter", () => {
    const now = new Date(iso(2025));
    expect(dataSeriesInterest(series({ 2024: 0, 2025: 10 }, "kg"), now)).toBe(dataSeriesInterest(series({ 2024: 0, 2025: 10 }, null), now));
  });
});
