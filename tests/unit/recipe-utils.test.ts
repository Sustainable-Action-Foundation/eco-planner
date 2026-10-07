/* eslint-disable no-template-curly-in-string */
import { expect, test } from "playwright/test";

import type { Unit as MathJSUnit } from "mathjs";
import mathjs from "../../src/math";
import {
  Recipe,
  cancelMatchingUnits,
  dataSeriesToDateValues,
  dateValuesToDBDateRecord,
  externalSelectionKey,
  getPrevailingUnit,
  isMathjsUnit,
  isoYearDate,
  parseDateValuesFromVector,
  pickDateValues,
  sanityCheckDataSeries,
  sanityCheckExternalDatasets,
  sanityCheckScalars,
  transformDateValuesToVector,
} from "../../src/functions/recipe";
import { RecipeDataTypes, VectorIndexPickerOptions } from "../../src/functions/recipe/types/enums";
import type { DataSeriesVariable, ScalarVariable } from "../../src/functions/recipe/types";
import type { DateValues, DateValuesWithUnit, ISOIshDate } from "../../src/types";
import { parseUnit } from "../../src/functions/unit";
import { UnitFlags } from "../../src/types/enums";

/*
 * The pure helpers around the evaluator: picking out of a series, the vector
 * <-> date-values conversions, unit helpers, the external selection key, the
 * custom mathjs functions (firstNonZero / extend / trend / reachBy) and the
 * sanity-check warnings.
 */

const isoYear = (year: number): ISOIshDate => `${year}-01-01T00:00:00.000Z`;

/** mathjs.evaluate is typed `any`; the custom functions return units or vectors of them. */
const evaluate = (expression: string, scope: Record<string, unknown>): unknown => mathjs.evaluate(expression, scope);

const toNumber = (value: unknown): number => {
  if (!mathjs.isUnit(value)) throw new Error(`Expected a mathjs Unit, got ${typeof value}`);
  return value.toNumber();
};
const numbers = (vector: unknown): number[] => (vector as unknown[]).map(toNumber);

const byYear = (result: DateValuesWithUnit | null): Record<number, number> => Object.fromEntries(
  Object.entries(result?.dateValues ?? {}).map(([date, value]) => [new Date(date).getUTCFullYear(), value]),
);

const scalar = (id: string, value: number, unit?: string | null): ScalarVariable => ({ id, name: id, type: RecipeDataTypes.Scalar, value, unit: parseUnit(unit) });
const series = (id: string, values: DateValues, pick: DataSeriesVariable["pick"] = VectorIndexPickerOptions.Whole, unit?: string | null): DataSeriesVariable => ({
  id, name: id, type: RecipeDataTypes.DataSeries, pick, unit: parseUnit(unit), dataSeriesId: undefined, value: values,
});

test.describe("pickDateValues", () => {
  const dateValues: DateValuesWithUnit = {
    unit: parseUnit("kg"),
    dateValues: { [isoYear(2020)]: 2, [isoYear(2021)]: 4, [isoYear(2022)]: 8, [isoYear(2023)]: 16 },
  };

  test("First / Last / Mean / Median pick a scalar in the series' unit", () => {
    const picks = {
      [VectorIndexPickerOptions.First]: 2,
      [VectorIndexPickerOptions.Last]: 16,
      [VectorIndexPickerOptions.Mean]: 7.5,
      [VectorIndexPickerOptions.Median]: 6,
    };
    for (const [pick, expected] of Object.entries(picks)) {
      const picked = pickDateValues(dateValues, pick as VectorIndexPickerOptions);
      expect(toNumber(picked)).toBe(expected);
      expect(mathjs.isUnit(picked) && picked.formatUnits()).toBe("kg");
    }
  });

  test("Median of an odd count is the middle value", () => {
    expect(toNumber(pickDateValues({ unit: UnitFlags.Unitless, dateValues: { [isoYear(2020)]: 9, [isoYear(2021)]: 1, [isoYear(2022)]: 5 } }, VectorIndexPickerOptions.Median))).toBe(5);
  });

  test("Default is Whole and returns the series itself; Reverse flips the key order", () => {
    expect(VectorIndexPickerOptions.Default).toBe(VectorIndexPickerOptions.Whole);
    expect(pickDateValues(dateValues, VectorIndexPickerOptions.Default)).toBe(dateValues);

    const reversed = pickDateValues(dateValues, VectorIndexPickerOptions.Reverse);
    if (mathjs.isUnit(reversed)) throw new Error("Expected a series");
    expect(Object.keys(reversed.dateValues)).toEqual([isoYear(2023), isoYear(2022), isoYear(2021), isoYear(2020)]);
    expect(reversed.unit).toBe("kg");
  });

  test("an integer year and an ISO date (with or without .000) pick that value", () => {
    expect(toNumber(pickDateValues(dateValues, 2022))).toBe(8);
    expect(toNumber(pickDateValues(dateValues, "2023-01-01T00:00:00.000Z"))).toBe(16);
    // Keys are stored with milliseconds; the short ISO form is a valid pick but does not match a stored key
    expect(() => pickDateValues(dateValues, "2023-01-01T00:00:00Z")).toThrow("does not contain a valid number for date");
    const shortKeyed: DateValuesWithUnit = { unit: UnitFlags.Unitless, dateValues: { "2023-01-01T00:00:00Z": 3 } };
    expect(toNumber(pickDateValues(shortKeyed, "2023-01-01T00:00:00Z"))).toBe(3);
  });

  test("a year or date the series lacks and a non-integer pick are errors", () => {
    expect(() => pickDateValues(dateValues, 1999)).toThrow("does not contain a valid number for year 1999");
    expect(() => pickDateValues(dateValues, "1999-01-01T00:00:00.000Z")).toThrow("does not contain a valid number for date");
    expect(() => pickDateValues(dateValues, 2020.5)).toThrow("Invalid pick value");
    expect(() => pickDateValues(dateValues, "nope" as never)).toThrow("Unknown VectorIndexPickerOption");
  });

  test("an empty series: First and Last throw, Mean and Median give NaN", () => {
    const empty: DateValuesWithUnit = { unit: UnitFlags.Unitless, dateValues: {} };
    expect(() => pickDateValues(empty, VectorIndexPickerOptions.First)).toThrow("empty");
    expect(() => pickDateValues(empty, VectorIndexPickerOptions.Last)).toThrow("empty");
    expect(Number.isNaN(toNumber(pickDateValues(empty, VectorIndexPickerOptions.Mean)))).toBe(true);
    expect(Number.isNaN(toNumber(pickDateValues(empty, VectorIndexPickerOptions.Median)))).toBe(true);
  });

  test("a NaN entry poisons Mean, and Median neither throws nor sorts around it", () => {
    const withGap: DateValuesWithUnit = { unit: parseUnit("kg"), dateValues: { [isoYear(2020)]: 1, [isoYear(2021)]: NaN, [isoYear(2022)]: 3, [isoYear(2023)]: 2 } };
    expect(Number.isNaN(toNumber(pickDateValues(withGap, VectorIndexPickerOptions.Mean)))).toBe(true);
    // Sorting with NaN is not a total order, so the median is whatever lands in the middle; it must at least be a unit in kg
    const median = pickDateValues(withGap, VectorIndexPickerOptions.Median);
    expect(mathjs.isUnit(median) && median.formatUnits()).toBe("kg");
    expect(toNumber(pickDateValues(withGap, VectorIndexPickerOptions.First))).toBe(1);
  });
});

test.describe("transformDateValuesToVector / parseDateValuesFromVector", () => {
  test("isoYearDate keys a year the way the evaluator does", () => {
    expect(isoYearDate(2024)).toBe("2024-01-01T00:00:00.000Z");
  });

  test("a series becomes one unit per axis year, NaN where it has no value", () => {
    const vector = transformDateValuesToVector({ unit: parseUnit("kg"), dateValues: { [isoYear(2020)]: 1, [isoYear(2022)]: 3 } }, [2019, 2020, 2021, 2022]);
    expect(numbers(vector)).toEqual([NaN, 1, NaN, 3]);
    expect(vector.every(value => value.formatUnits() === "kg")).toBe(true);

    const unitless = transformDateValuesToVector({ unit: UnitFlags.Unitless, dateValues: { [isoYear(2020)]: 1 } }, [2020]);
    expect(unitless[0].formatUnits()).toBe("");
  });

  test("a vector reads back as date values, NaN years left out; the round trip is lossless", () => {
    const original: DateValuesWithUnit = { unit: parseUnit("kg"), dateValues: { [isoYear(2020)]: 1, [isoYear(2022)]: 3 } };
    const axis = [2020, 2021, 2022];
    expect(parseDateValuesFromVector(transformDateValuesToVector(original, axis), axis)).toEqual(original);
  });

  test("length mismatch with the axis is an error", () => {
    expect(() => parseDateValuesFromVector([mathjs.unit(1, "kg")], [2020, 2021])).toThrow("does not match the year axis");
  });

  test("units: all unitless → Unitless, all equal → that unit, mixed → Missing", () => {
    expect(parseDateValuesFromVector([mathjs.unit(1), mathjs.unit(2)], [2020, 2021]).unit).toBe(UnitFlags.Unitless);
    expect(parseDateValuesFromVector([mathjs.unit(1, "kg"), mathjs.unit(2, "kg")], [2020, 2021]).unit).toBe("kg");

    const mixed = parseDateValuesFromVector([mathjs.unit(1, "kg"), mathjs.unit(NaN, "kg"), mathjs.unit(2, "g")], [2020, 2021, 2022]);
    expect(mixed.unit).toBe(UnitFlags.Missing);
    expect(mixed.dateValues).toEqual({ [isoYear(2020)]: 1, [isoYear(2022)]: 2 });
  });

  test("factors that cancel are dropped from the result unit", () => {
    const backAgain = evaluate("total / population * other", { total: mathjs.unit(6, "kWh"), population: mathjs.unit(3, "person"), other: mathjs.unit(2, "person") }) as MathJSUnit;
    const parsed = parseDateValuesFromVector([backAgain], [2020]);
    expect(parsed.unit).toBe("kWh");
    expect(parsed.dateValues[isoYear(2020)]).toBeCloseTo(4);
  });
});

test.describe("cancelMatchingUnits", () => {
  test("cancels aliases of the same dimension and value, keeping the numeric value", () => {
    const perCount = evaluate("a / b", { a: mathjs.unit(2, "kWh antal"), b: mathjs.unit(1, "antal") }) as MathJSUnit;
    const cancelled = cancelMatchingUnits(perCount);
    expect(cancelled.formatUnits()).toBe("kWh");
    expect(cancelled.toNumber()).toBeCloseTo(2);

    const perCapita = evaluate("a * b", { a: mathjs.unit(3, "t CO2e / capita"), b: mathjs.unit(1, "person") }) as MathJSUnit;
    expect(cancelMatchingUnits(perCapita).formatUnits()).toBe("t CO2e");
  });

  test("does not cancel different prefixes of one dimension and returns the same instance when nothing cancels", () => {
    const ratio = evaluate("a / b", { a: mathjs.unit(1, "kWh"), b: mathjs.unit(1, "Wh") });
    // mathjs already collapses a dimensionless ratio to a number, so build the mixed-prefix unit explicitly
    expect(typeof ratio).toBe("number");
    const mixed = mathjs.unit(1, "kWh / Wh");
    expect(cancelMatchingUnits(mixed).formatUnits()).toBe("kWh / Wh");

    const plain = mathjs.unit(5, "kg");
    expect(cancelMatchingUnits(plain)).toBe(plain);
  });
});

test.describe("getPrevailingUnit / isMathjsUnit", () => {
  test("a missing new unit keeps the existing one; a real or unitless new unit wins", () => {
    expect(getPrevailingUnit(parseUnit("kg"), UnitFlags.Missing)).toBe("kg");
    expect(getPrevailingUnit(parseUnit("kg"), parseUnit("g"))).toBe("g");
    expect(getPrevailingUnit(parseUnit("kg"), UnitFlags.Unitless)).toBe(UnitFlags.Unitless);
    expect(getPrevailingUnit(UnitFlags.Missing, UnitFlags.Missing)).toBe(UnitFlags.Missing);
  });

  test("isMathjsUnit accepts the project's Swedish spellings after parseUnit and rejects flags and garbage", () => {
    for (const unit of ["kg", "kWh/år", "invånare", "t CO2e/capita", "procent", "Mkr", "fordonskm", "kton"]) {
      expect(isMathjsUnit(parseUnit(unit)), unit).toBe(true);
    }
    expect(isMathjsUnit(parseUnit("not-a-unit"))).toBe(false);
    expect(isMathjsUnit(UnitFlags.Missing)).toBe(false);
    expect(isMathjsUnit(UnitFlags.Unitless)).toBe(false);
  });
});

test.describe("dataSeriesToDateValues / dateValuesToDBDateRecord", () => {
  test("db records map to date values with the unit parsed at the boundary", () => {
    const mapped = dataSeriesToDateValues({
      id: "id",
      unit: null,
      values: [
        { timestamp: new Date("2020-01-01T00:00:00Z"), value: 1 },
        { timestamp: new Date("2021-01-01T00:00:00Z"), value: 2 },
      ],
    } as never);
    expect(mapped).toEqual({ unit: UnitFlags.Unitless, dateValues: { [isoYear(2020)]: 1, [isoYear(2021)]: 2 } });
    expect(() => dataSeriesToDateValues(null)).toThrow("missing");
    // Any midnight date is an ISO-ish key (the evaluator normalizes to years later); a time of day is not
    expect(dataSeriesToDateValues({ id: "x", unit: "kg", values: [{ timestamp: new Date("2020-06-01T00:00:00Z"), value: 1 }] } as never).dateValues).toEqual({ "2020-06-01T00:00:00.000Z": 1 });
    expect(() => dataSeriesToDateValues({ id: "x", unit: "kg", values: [{ timestamp: new Date("2020-01-01T12:00:00Z"), value: 1 }] } as never)).toThrow("invalid ISOIshDate");
  });

  test("date values become timestamped records, optionally linked to a series, and reject bad keys", () => {
    const converted = dateValuesToDBDateRecord({ [isoYear(2020)]: 5, [isoYear(2021)]: 9 }, "ds-1");
    expect(converted).toEqual([
      { data_series_id: "ds-1", timestamp: new Date(isoYear(2020)), value: 5 },
      { data_series_id: "ds-1", timestamp: new Date(isoYear(2021)), value: 9 },
    ]);
    expect(dateValuesToDBDateRecord({ [isoYear(2020)]: 5 })[0]).not.toHaveProperty("data_series_id");
    expect(() => dateValuesToDBDateRecord({ "not-an-iso": 1 } as unknown as DateValues)).toThrow("Invalid ISOIshDate key");
  });
});

test.describe("externalSelectionKey", () => {
  const selection = [
    { variableCode: "Region", valueCodes: ["2582", "00"] },
    { variableCode: "ContentsCode", valueCodes: ["BE0101U2"] },
  ];

  test("is insensitive to the order of selection items and of value codes", () => {
    const key = externalSelectionKey("SCB", "TAB628", selection);
    expect(externalSelectionKey("SCB", "TAB628", [selection[1], selection[0]])).toBe(key);
    expect(externalSelectionKey("SCB", "TAB628", [{ variableCode: "Region", valueCodes: ["00", "2582"] }, selection[1]])).toBe(key);
  });

  test("differs by dataset, table, variable and value codes, and does not mutate its input", () => {
    const key = externalSelectionKey("SCB", "TAB628", selection);
    expect(externalSelectionKey("Trafa", "TAB628", selection)).not.toBe(key);
    expect(externalSelectionKey("SCB", "TAB629", selection)).not.toBe(key);
    expect(externalSelectionKey("SCB", "TAB628", [selection[0]])).not.toBe(key);
    expect(externalSelectionKey("SCB", "TAB628", [{ variableCode: "Region", valueCodes: ["2582"] }, selection[1]])).not.toBe(key);
    expect(externalSelectionKey(null, null, [])).not.toBe(key);
    expect(selection[0].valueCodes).toEqual(["2582", "00"]);
    expect(selection.map(item => item.variableCode)).toEqual(["Region", "ContentsCode"]);
  });
});

test.describe("firstNonZero", () => {
  test("skips leading zeros and NaN gaps, falls back to the first value when all are zero", () => {
    expect(toNumber(evaluate("firstNonZero(a)", { a: [mathjs.unit(0, "kg"), mathjs.unit(NaN, "kg"), mathjs.unit(3, "kg")] }))).toBe(3);
    expect(toNumber(evaluate("firstNonZero(a)", { a: [mathjs.unit(NaN), mathjs.unit(0), mathjs.unit(0)] }))).toBe(0);
    expect(toNumber(evaluate("firstNonZero(a)", { a: [mathjs.unit(7)] }))).toBe(7);
  });

  test("an empty vector throws and an all-NaN vector has nothing to return", async () => {
    expect(() => evaluate("firstNonZero(a)", { a: [] })).toThrow("non-empty vector");
    expect(evaluate("firstNonZero(a)", { a: [mathjs.unit(NaN), mathjs.unit(NaN)] })).toBeUndefined();

    // Through the evaluator a series is never all-NaN on its own axis, but a picked scalar is not a vector
    const picked = new Recipe({ name: "Picked", equation: "firstNonZero(${s})", variables: [series("s", { [isoYear(2020)]: 1 }, VectorIndexPickerOptions.Last)] });
    await expect(picked.evaluate([])).rejects.toThrow("non-empty vector");
  });
});

test.describe("extend", () => {
  const axis = [2020, 2021, 2022, 2023, 2024];

  test("fills leading, interior and trailing gaps by carrying the nearest known value, keeping the unit", () => {
    const filled = evaluate("extend(y, s)", { y: axis, s: [mathjs.unit(NaN, "kg"), mathjs.unit(2, "kg"), mathjs.unit(NaN, "kg"), mathjs.unit(4, "kg"), mathjs.unit(NaN, "kg")] }) as unknown[];
    expect(numbers(filled)).toEqual([2, 2, 2, 4, 4]);
    expect((filled as MathJSUnit[]).every(value => value.formatUnits() === "kg")).toBe(true);
  });

  test("a single point is broadcast; an all-NaN or empty series is returned as is", () => {
    expect(numbers(evaluate("extend(y, s)", { y: axis, s: [mathjs.unit(NaN), mathjs.unit(NaN), mathjs.unit(5), mathjs.unit(NaN), mathjs.unit(NaN)] }))).toEqual([5, 5, 5, 5, 5]);
    expect(numbers(evaluate("extend(y, s)", { y: [2020, 2021], s: [mathjs.unit(NaN), mathjs.unit(NaN)] }))).toEqual([NaN, NaN]);
    expect(evaluate("extend(y, s)", { y: [], s: [] })).toEqual([]);
  });

  test("rejects a picked value instead of the whole series", () => {
    expect(() => evaluate("extend(y, s)", { y: axis, s: mathjs.unit(1) })).toThrow("whole series");
    expect(() => evaluate("extend(s, s)", { s: [mathjs.unit(1)] })).toThrow("year axis");
  });

  test("through the evaluator an all-NaN series yields no values", async () => {
    // A series that only exists outside the other's years is NaN on every year it is multiplied in
    const recipe = new Recipe({
      name: "Empty",
      equation: "${a} .* ${b}",
      variables: [series("a", { [isoYear(2020)]: 1 }), series("b", { [isoYear(2030)]: 1 })],
    });
    await expect(recipe.evaluate([])).rejects.toThrow("no overlapping years");
  });
});

test.describe("trend", () => {
  test("fits the least-squares line through the known years and continues it to the axis horizon", async () => {
    const recipe = new Recipe({
      name: "Trend",
      equation: "trend(year, ${s})",
      // Exactly on the line 100 - 2 * (year - 2016), with a gap in 2018
      variables: [series("s", { [isoYear(2016)]: 100, [isoYear(2017)]: 98, [isoYear(2019)]: 94, [isoYear(2024)]: 84 }, VectorIndexPickerOptions.Whole, "kt CO2e")],
    });
    const result = await recipe.evaluate([]);
    expect(result?.unit).toBe("kt CO2e");
    const years = byYear(result);
    expect(years[2016]).toBeCloseTo(100);
    expect(years[2018]).toBeCloseTo(96);
    expect(years[2050]).toBeCloseTo(32);
    expect(Object.keys(years)).toHaveLength(2050 - 2016 + 1);
  });

  test("stops at the end year and never backcasts before the first known year", async () => {
    const recipe = new Recipe({
      name: "Until",
      equation: "trend(year, ${s}, ${until})",
      variables: [
        series("s", { [isoYear(2020)]: 1, [isoYear(2021)]: 3, [isoYear(2022)]: 2 }),
        series("other", { [isoYear(2010)]: 0 }), // pulls the axis start back to 2010
        scalar("until", 2030),
      ],
    });
    const result = await recipe.evaluate([]);
    expect(result?.unit).toBe(UnitFlags.Unitless);
    const years = byYear(result);
    expect(years[2019]).toBeUndefined();
    expect(years[2021]).toBeCloseTo(2);
    expect(years[2030]).toBeCloseTo(6.5);
    expect(years[2031]).toBeUndefined();
  });

  test("two points define the line exactly", () => {
    const line = evaluate("trend(y, s)", { y: [2020, 2021, 2022, 2023], s: [mathjs.unit(1), mathjs.unit(NaN), mathjs.unit(5), mathjs.unit(NaN)] });
    expect(numbers(line)).toEqual([1, 3, 5, 7]);
  });

  test("rejects a picked value, a single point, an all-NaN series and a NaN end year", async () => {
    const picked = new Recipe({ name: "Picked", equation: "trend(year, ${s})", variables: [series("s", { [isoYear(2020)]: 1, [isoYear(2021)]: 3 }, VectorIndexPickerOptions.Last)] });
    await expect(picked.evaluate([])).rejects.toThrow("whole series");

    const single = new Recipe({ name: "Single", equation: "trend(year, ${s})", variables: [series("s", { [isoYear(2020)]: 1 })] });
    await expect(single.evaluate([])).rejects.toThrow("at least two known values");

    expect(() => evaluate("trend(y, s)", { y: [2020, 2021], s: [mathjs.unit(NaN), mathjs.unit(NaN)] })).toThrow("at least two known values");
    expect(() => evaluate("trend(y, s, u)", { y: [2020, 2021], s: [mathjs.unit(1), mathjs.unit(2)], u: "soon" })).toThrow("end year");
  });
});

test.describe("reachBy", () => {
  test("draws the line through start and target and continues at the same slope; years before the start drop out", async () => {
    const recipe = new Recipe({
      name: "Reach",
      equation: "reachBy(year, ${start}, ${target}, ${from}, ${to})",
      variables: [scalar("start", 10, "MW"), scalar("target", 50), scalar("from", 2030), scalar("to", 2034)],
    });
    const result = await recipe.evaluate([]);
    expect(result?.unit).toBe("MW");
    const years = byYear(result);
    expect(years[2029]).toBeUndefined();
    expect(years[2030]).toBe(10);
    expect(years[2032]).toBe(30);
    expect(years[2034]).toBe(50);
    expect(years[2050]).toBe(210);
    expect(Object.keys(years)).toHaveLength(2050 - 2030 + 1);
  });

  test("a target with a unit is converted into the start's unit", () => {
    const line = evaluate("reachBy(y, s, t, 2020, 2022)", { y: [2020, 2021, 2022], s: mathjs.unit(10, "MW"), t: mathjs.unit(0.05, "GW") }) as MathJSUnit[];
    expect(line.map(value => value.toNumber("MW"))).toEqual([10, 30, 50]);
  });

  test("reads a picked series value as the start and is unitless when the start is", async () => {
    const recipe = new Recipe({
      name: "From series",
      equation: "reachBy(year, ${s}, ${target}, ${from}, ${to})",
      variables: [series("s", { [isoYear(2016)]: 4, [isoYear(2024)]: 8 }, VectorIndexPickerOptions.Last), scalar("target", 0), scalar("from", 2026), scalar("to", 2030)],
    });
    const result = await recipe.evaluate([]);
    expect(result?.unit).toBe(UnitFlags.Unitless);
    const years = byYear(result);
    expect(years[2026]).toBe(8);
    expect(years[2028]).toBe(4);
    expect(years[2030]).toBe(0);
  });

  test("rejects an end year at or before the start year and non-numeric inputs", () => {
    const scope = { y: [2020], s: mathjs.unit(1), t: mathjs.unit(2) };
    expect(() => evaluate("reachBy(y, s, t, 2040, 2030)", scope)).toThrow("end year to come after");
    expect(() => evaluate("reachBy(y, s, t, 2030, 2030)", scope)).toThrow("end year to come after");
    expect(() => evaluate("reachBy(y, s, t, 2020, u)", { ...scope, u: "later" })).toThrow("end year");
    expect(() => evaluate("reachBy(y, s, t, 2020, 2030)", { ...scope, t: "fifty" })).toThrow("target value");
  });

  test("a single-year axis gives a single point", () => {
    expect(numbers(evaluate("reachBy(y, s, t, 2020, 2030)", { y: [2025], s: mathjs.unit(0), t: mathjs.unit(10) }))).toEqual([5]);
  });
});

test.describe("sanity checks", () => {
  test("sanityCheckScalars warns for huge, near-zero, negative and zero scalars", () => {
    const warnings: string[] = [];
    sanityCheckScalars([
      { id: "huge", displayName: "Huge", value: 1e13 },
      { id: "near", displayName: "NearZero", value: 1e-13 },
      { id: "neg", displayName: "Negative", value: -1 },
      { id: "zero", displayName: "Zero", value: 0 },
      { id: "fine", displayName: "Fine", value: 42 },
    ], warnings);

    expect(warnings).toHaveLength(4);
    expect(warnings.join(" ")).toContain("huge scalar values: Huge");
    expect(warnings.join(" ")).toContain("close to zero: NearZero");
    expect(warnings.join(" ")).toContain("negative scalar values: Negative");
    expect(warnings.join(" ")).toContain("scalar values that are zero: Zero");
    expect(warnings.join(" ")).not.toContain("Fine");
  });

  test("sanityCheckDataSeries warns for picked scalars and for long, short and huge series", () => {
    const warnings: string[] = [];
    const longSeries = Object.fromEntries(Array.from({ length: 60 }, (_, i) => [isoYear(1990 + i), i])) satisfies DateValues;
    sanityCheckDataSeries([
      { id: "s1", displayName: "HugeScalar", value: 1e14 },
      { id: "long", displayName: "LongSeries", series: { dateValues: longSeries, unit: UnitFlags.Unitless } },
      { id: "short", displayName: "ShortSeries", series: { dateValues: { [isoYear(2020)]: 1 }, unit: UnitFlags.Unitless } },
      { id: "huge", displayName: "HugeSeriesValues", series: { dateValues: { [isoYear(2020)]: 1e13, [isoYear(2021)]: 2 }, unit: UnitFlags.Unitless } },
    ], warnings);

    const text = warnings.join(" ");
    expect(text).toContain("Data series extraction contains huge scalar values: HugeScalar");
    expect(text).toContain("very long data series: LongSeries");
    expect(text).toContain("very short data series: ShortSeries");
    expect(text).toContain("data series with huge values: HugeSeriesValues");
  });

  test("sanityCheckExternalDatasets uses its own prefix and stays silent for sane input", () => {
    const warnings: string[] = [];
    sanityCheckExternalDatasets([
      { id: "s1", displayName: "ExternalZero", value: 0 },
      { id: "ok", displayName: "Fine", series: { dateValues: { [isoYear(2020)]: 1, [isoYear(2021)]: 2 }, unit: UnitFlags.Unitless } },
    ], warnings);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("External dataset extraction contains scalar values that are zero: ExternalZero");
  });
});
