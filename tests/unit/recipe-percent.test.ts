/* eslint-disable no-template-curly-in-string */
import { expect, test } from "playwright/test";

import { Recipe } from "../../src/functions/recipe";
import { RecipeDataTypes, VectorIndexPickerOptions } from "../../src/functions/recipe/types/enums";
import type { DataSeriesVariable, ScalarVariable } from "../../src/functions/recipe/types";
import type { DataSeries, DateValues, DateValuesWithUnit, ISOIshDate } from "../../src/types";
import { parseUnit } from "../../src/functions/unit";

/*
 * Regression for the bug card "Percent goals come out 100x too small through
 * any recipe": `procent` is a dimensionless hundredth in src/math.ts, and
 * mathjs used to collapse `90 procent * 0.5` into the bare number 0.45, which
 * the evaluator then relabelled as procent. The instance now runs with
 * `predictable: true` so the unit survives, and the evaluator converts the
 * result into the declared unit instead of relabelling it.
 */

const isoYear = (year: number): ISOIshDate => `${year}-01-01T00:00:00.000Z`;
const byYear = (result: DateValuesWithUnit | null): Record<number, number> => Object.fromEntries(
  Object.entries(result?.dateValues ?? {}).map(([date, value]) => [new Date(date).getUTCFullYear(), value]),
);

const shareValues: DateValues = { [isoYear(2020)]: 90, [isoYear(2021)]: 91.68 };

const share = (): DataSeriesVariable => ({
  id: "share", name: "Share", type: RecipeDataTypes.DataSeries, pick: VectorIndexPickerOptions.Whole, unit: parseUnit("procent"), dataSeriesId: null, value: shareValues,
});
const scalar = (id: string, value: number, unit?: string | null): ScalarVariable => ({ id, name: id, type: RecipeDataTypes.Scalar, value, unit: parseUnit(unit) });
const personSeries = (id: string, value: number): DataSeriesVariable => ({
  id, name: id, type: RecipeDataTypes.DataSeries, pick: VectorIndexPickerOptions.Whole, unit: parseUnit("person"), dataSeriesId: null, value: { [isoYear(2020)]: value, [isoYear(2021)]: value },
});

test.describe("Percent units through Recipe.evaluate", () => {
  test("a percent series read as-is keeps its values and unit", async () => {
    const result = await new Recipe({ name: "As is", equation: "${share}", variables: [share()] }).evaluate([]);
    expect(result?.unit).toBe("procent");
    expect(byYear(result)).toEqual({ 2020: 90, 2021: 91.68 });
  });

  test("percent plus percent stays in percent", async () => {
    const result = await new Recipe({ name: "Sum", equation: "${share} + ${bonus}", variables: [share(), scalar("bonus", 10, "procent")] }).evaluate([]);
    expect(result?.unit).toBe("procent");
    expect(byYear(result)[2020]).toBeCloseTo(100);
  });

  test("a percent series times a unitless scalar keeps its percent magnitude", async () => {
    const result = await new Recipe({ name: "Half", equation: "${share} * ${factor}", variables: [share(), scalar("factor", 0.5)] }).evaluate([]);
    expect(byYear(result)[2020]).toBeCloseTo(45);
    expect(result?.unit).toBe("procent");
  });

  test("copying a percent goal through the scalar method with factor 1 keeps the national values", async () => {
    // The copied goal declares procent as its unit, like the goal form does for a copy of `Elbilar\Andel av personbilskm`
    const nationalId = "11111111-1111-1111-1111-111111111111";
    const copy = new Recipe({
      name: "Copy",
      equation: "${parent} * ${factor}",
      variables: [
        { id: "parent", name: "National", type: RecipeDataTypes.DataSeries, pick: VectorIndexPickerOptions.Whole, unit: parseUnit(""), dataSeriesId: nationalId, value: null },
        scalar("factor", 1),
      ],
      unit: parseUnit("procent"),
    });
    const dataSeriesGetter = (): Promise<DataSeries> => Promise.resolve({
      id: nationalId,
      unit: "procent",
      values: Object.entries(shareValues).map(([timestamp, value]) => ({ data_series_id: nationalId, timestamp: new Date(timestamp), value })),
    });
    const result = await copy.evaluate([], { dataSeriesGetter });
    expect(result?.unit).toBe("procent");
    expect(byYear(result)[2021]).toBeCloseTo(91.68);
  });

  test("scaling a percent share by a per-year population ratio stays in percent", async () => {
    // The LEAP per-year population method: share .* extend(local) ./ extend(national); Boden is a hundredth of the nation
    const recipe = new Recipe({
      name: "Ratio",
      equation: "${share} .* extend(year, ${local}) ./ extend(year, ${national})",
      variables: [share(), personSeries("local", 100_000), personSeries("national", 10_000_000)],
    });
    const result = await recipe.evaluate([]);
    expect(result?.unit).toBe("procent");
    expect(byYear(result)[2020]).toBeCloseTo(0.9);
  });

  test("a share of a share declared as percent is converted from procent^2", async () => {
    const result = await new Recipe({ name: "Product", equation: "${share} * ${half}", variables: [share(), scalar("half", 50, "procent")], unit: parseUnit("procent") }).evaluate([]);
    expect(result?.unit).toBe("procent");
    expect(byYear(result)[2020]).toBeCloseTo(45);
  });

  test("a bare number declared as percent is labelled, not scaled (manual input and shares of absolutes)", async () => {
    const result = await new Recipe({ name: "Share", equation: "${part} / ${whole}", variables: [scalar("part", 3), scalar("whole", 10)], unit: parseUnit("procent") }).evaluate([]);
    expect(result?.unit).toBe("procent");
    expect(byYear(result)[2020]).toBeCloseTo(0.3);
  });

  test("a declared unit the result converts to is a conversion, not a label", async () => {
    const result = await new Recipe({ name: "Prefix", equation: "${energy} * ${k}", variables: [scalar("energy", 1500, "kWh"), scalar("k", 2)], unit: parseUnit("MWh") }).evaluate([]);
    expect(result?.unit).toBe("MWh");
    expect(byYear(result)[2020]).toBeCloseTo(3);
  });

  test("a percent scalar times a unitless scalar is not relabelled 100x too small", async () => {
    const result = await new Recipe({ name: "Scalars", equation: "${p} * ${k}", variables: [scalar("p", 40, "procent"), scalar("k", 2)], unit: parseUnit("procent") }).evaluate([]);
    expect(byYear(result)[2020]).toBeCloseTo(80);
  });
});
