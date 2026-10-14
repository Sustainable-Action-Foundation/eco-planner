/* eslint-disable no-template-curly-in-string */
import { expect, test } from "playwright/test";

import {
  Recipe,
  extractDataSeries,
  extractExternalDatasets,
  extractScalars,
  fetchExternalVariableData,
} from "../../src/functions/recipe";
import { AxisHorizonYear, DefaultAxisStartYear } from "../../src/functions/recipe/recipe";
import { RecipeDataTypes, VectorIndexPickerOptions } from "../../src/functions/recipe/types/enums";
import { MathjsError, RecipeError } from "../../src/functions/recipe/types/errors";
import type { DataSeriesVariable, ExternalVariable, ScalarVariable } from "../../src/functions/recipe/types";
import type { ApiSelectionItem, ApiTableContent } from "../../src/lib/api/apiTypes";
import type { DataSeries, DateValues, DateValuesWithUnit, ISOIshDate, JSONValue } from "../../src/types";
import { parseUnit } from "../../src/functions/unit";
import { BaselineType, UnitFlags } from "../../src/types/enums";

/*
 * The recipe evaluator and the Recipe class around it: serialization shapes,
 * the factories, and evaluate() with injected data-series / external getters.
 * The year axis runs from the earliest series year (2020 without series) to
 * 2050; a year a series lacks is NaN in its vector and drops out of the result.
 */

const isoYear = (year: number): ISOIshDate => `${year}-01-01T00:00:00.000Z`;

/** The result keyed by year instead of ISO date, for readable assertions. */
const byYear = (result: DateValuesWithUnit | null): Record<number, number> => Object.fromEntries(
  Object.entries(result?.dateValues ?? {}).map(([date, value]) => [new Date(date).getUTCFullYear(), value]),
);

function scalarVariable(id: string, name: string, value: number, unit?: string | null): ScalarVariable {
  return { id, name, type: RecipeDataTypes.Scalar, value, unit: parseUnit(unit) };
}

function inlineDataSeriesVariable({ id, name, values, pick = VectorIndexPickerOptions.Whole, unit }: {
  id: string;
  name: string;
  values: DateValues;
  pick?: DataSeriesVariable["pick"];
  unit?: string | null;
}): DataSeriesVariable {
  return { id, name, type: RecipeDataTypes.DataSeries, pick, dataSeriesId: undefined, value: values, unit: parseUnit(unit) };
}

function linkedDataSeriesVariable(id: string, name: string, dataSeriesId: string, unit?: string | null): DataSeriesVariable {
  return { id, name, type: RecipeDataTypes.DataSeries, pick: VectorIndexPickerOptions.Whole, dataSeriesId, value: undefined, unit: parseUnit(unit) };
}

function makeDataSeriesGetter(seed: Record<string, { values: DateValues; unit?: string | null }>) {
  return (dataSeriesId: string): Promise<DataSeries | null> => {
    const found = seed[dataSeriesId];
    if (!found) return Promise.resolve(null);
    return Promise.resolve({
      id: dataSeriesId,
      unit: found.unit ?? null,
      values: Object.entries(found.values).map(([timestamp, value]) => ({ data_series_id: dataSeriesId, timestamp: new Date(timestamp), value })),
    } satisfies DataSeries);
  };
}

function externalVariable({ id, name, dataset = "SCB", tableId, selection = [{ variableCode: "Region", valueCodes: ["00"] }], pick = VectorIndexPickerOptions.Whole, unit, dataSeriesId }: {
  id: string;
  name: string;
  dataset?: ExternalVariable["dataset"];
  tableId: string | null;
  selection?: ExternalVariable["selection"];
  pick?: ExternalVariable["pick"];
  unit?: string | null;
  dataSeriesId?: string | null;
}): ExternalVariable {
  return { id, name, type: RecipeDataTypes.External, dataset, tableId, selection, pick, unit: parseUnit(unit), ...(dataSeriesId !== undefined ? { dataSeriesId } : {}) };
}

function tableContent(id: string, values: Record<string, string | number>): ApiTableContent {
  return { id, values: Object.entries(values).map(([period, value]) => ({ period, value: String(value) })), metadata: [{ label: "stub", source: "stub" }] };
}

function makeExternalTableContentGetter(seed: Record<string, ApiTableContent>, calls: unknown[][] = []) {
  return (tableId: string, dataset: string, selection: ApiSelectionItem[]): Promise<ApiTableContent | null> => {
    calls.push([tableId, dataset, selection]);
    return Promise.resolve(seed[tableId] ?? null);
  };
}

const dataSeriesIds = {
  main: "11111111-1111-1111-1111-111111111111",
  other: "22222222-2222-2222-2222-222222222222",
  missing: "33333333-3333-3333-3333-333333333333",
};

test.describe("Recipe.from / deserialize / copy", () => {
  const base = () => new Recipe({
    name: "Roundtrip",
    equation: "${a} + ${b}",
    variables: [scalarVariable("a", "Alpha", 2, "kg"), scalarVariable("b", "Beta", 3, "kg")],
    unit: parseUnit("kg"),
  });

  test("serialize/deserialize keeps name, equation, variables, unit and tags the format version", () => {
    const serialized = base().serialize();
    const parsed = Recipe.deserialize(serialized);

    expect(parsed.name).toBe("Roundtrip");
    expect(parsed.equation).toBe("${a} + ${b}");
    expect(parsed.variables.map(v => v.id)).toEqual(["a", "b"]);
    expect(parsed.unit).toBe("kg");
    expect((JSON.parse(serialized) as { meta: { v: number } }).meta.v).toBe(1);
    expect(Recipe.areRecipesEqual(parsed, base())).toBe(true);
  });

  test("from accepts a Recipe instance and returns an independent copy", () => {
    const original = base();
    const copy = Recipe.from(original);
    expect(copy).not.toBe(original);
    expect(Recipe.areRecipesEqual(copy, original)).toBe(true);

    copy.variables.push(scalarVariable("c", "Gamma", 1));
    expect(original.variables).toHaveLength(2);
  });

  test("copy clones variables deeply", () => {
    const original = base();
    const copy = original.copy();
    (copy.variables[0] as ScalarVariable).value = 99;
    expect((original.variables[0] as ScalarVariable).value).toBe(2);
    expect(Recipe.areRecipesEqual(copy, original)).toBe(false);
  });

  test("from accepts the db shape with the recipe as an object or as a serialized string", () => {
    const plain = { name: "Wrapped", equation: "${x}", variables: [scalarVariable("x", "X", 7, null)], unit: null, meta: { v: 1 } };

    const fromObject = Recipe.from({ id: "db-id", recipe: plain });
    const fromString = Recipe.from({ id: "db-id", recipe: JSON.stringify(plain) });

    for (const recipe of [fromObject, fromString]) {
      expect(recipe.name).toBe("Wrapped");
      expect(recipe.variables).toHaveLength(1);
      expect(recipe.variables[0].id).toBe("x");
    }
    expect(Recipe.areRecipesEqual(fromObject, fromString)).toBe(true);
  });

  test("legacy unit spellings are parsed at the boundary: null is unitless, blank is missing, absent is unitless", () => {
    // As it comes out of the db: a JSON round trip, with the unit key dropped entirely on one variable
    const stored = JSON.parse(JSON.stringify({
      name: "Legacy units",
      equation: "${n} + ${b} + ${a}",
      variables: [
        { ...scalarVariable("n", "Null", 1), unit: null },
        { ...scalarVariable("b", "Blank", 1), unit: "" },
        { ...scalarVariable("a", "Absent", 1), unit: undefined },
      ],
      meta: {},
    })) as JSONValue;
    const recipe = Recipe.from(stored);

    expect(recipe.variables.map(v => v.unit)).toEqual([UnitFlags.Unitless, UnitFlags.Missing, UnitFlags.Unitless]);
    // No recipe-level unit field follows the db convention too (undefined → unitless)
    expect(recipe.unit).toBe(UnitFlags.Unitless);
  });

  test("rejects malformed input with a RecipeError naming the problem", () => {
    expect(() => Recipe.from("{not valid json")).toThrow("not a valid JSON string");
    expect(() => Recipe.from(null)).toThrow("expected an object");
    expect(() => Recipe.from({ id: "x", recipe: 42 })).toThrow("'recipe' field is not an object or string");
    expect(() => Recipe.from({ id: "x", recipe: "{bad" })).toThrow("'recipe' field is a string but not a valid JSON string");
    // meta is required by the shape guard, so a recipe without it is not a recipe
    expect(() => Recipe.from({ name: "No meta", equation: "1", variables: [] })).toThrow(RecipeError);
    expect(() => Recipe.from({ name: "Bad variable", equation: "1", variables: [{ id: "a" }], meta: {} })).toThrow("does not conform");
  });

  test("getEmpty / isEmpty: content, not the name, decides emptiness", () => {
    expect(Recipe.getEmpty().isEmpty()).toBe(true);
    expect(new Recipe({ name: Recipe.getEmpty().name, equation: "${a} + 1", variables: [scalarVariable("a", "A", 2)] }).isEmpty()).toBe(false);
    expect(new Recipe({ name: "My recipe", equation: "  ", variables: [] }).isEmpty()).toBe(true);
    expect(new Recipe({ name: "Only vars", equation: "", variables: [scalarVariable("a", "A", 2)] }).isEmpty()).toBe(false);
  });
});

test.describe("Recipe meta round trip", () => {
  test("isManual survives serialize/deserialize and is false for a composed recipe", () => {
    const manual = Recipe.fromManualDateValues({ unit: parseUnit("kg"), dateValues: { [isoYear(2020)]: 1 } });
    expect(manual.isManual()).toBe(true);
    expect(Recipe.deserialize(manual.serialize()).isManual()).toBe(true);

    const composed = new Recipe({ name: "Composed", equation: "${a}", variables: [scalarVariable("a", "A", 1)] });
    expect(composed.isManual()).toBe(false);
    expect(Recipe.deserialize(composed.serialize()).isManual()).toBe(false);
  });

  test("isSuggestedRecipe and baselineDerivation survive the round trip and default to false / undefined", () => {
    const suggested = new Recipe({ name: "Suggested", equation: "1", variables: [], meta: { isSuggestedRecipe: true } });
    expect(Recipe.deserialize(suggested.serialize()).isSuggestedRecipe()).toBe(true);

    const plain = new Recipe({ name: "Plain", equation: "1", variables: [] });
    const roundTripped = Recipe.deserialize(plain.serialize());
    expect(roundTripped.isSuggestedRecipe()).toBe(false);
    expect(roundTripped.baselineDerivation()).toBeUndefined();
    expect(JSON.parse(plain.serialize()) as object).not.toHaveProperty("meta.baselineDerivation");

    const nonZero = Recipe.fromInitialDateValue({ unit: parseUnit("kg"), dateValues: { [isoYear(2020)]: 0 } }, { nonZero: true });
    expect(Recipe.deserialize(nonZero.serialize()).baselineDerivation()).toBe(BaselineType.InitialNonZero);
  });
});

test.describe("Recipe.evaluate", () => {
  test("rejects an empty equation before touching any getter", async () => {
    const recipe = new Recipe({ name: "Empty", equation: "   ", variables: [scalarVariable("x", "X", 1)] });
    await expect(recipe.evaluate([], { dataSeriesGetter: () => Promise.reject(new Error("should not be called")) })).rejects.toThrow("Equation is empty");
  });

  test("a scalar result is broadcast over the default axis with a warning", async () => {
    const recipe = new Recipe({ name: "Scalar", equation: "${s} * 2", variables: [scalarVariable("s", "Scalar", 5, "kg")] });
    const warnings: string[] = [];
    const result = await recipe.evaluate(warnings);

    expect(result?.unit).toBe("kg");
    const years = byYear(result);
    expect(Object.keys(years)).toHaveLength(AxisHorizonYear - DefaultAxisStartYear + 1);
    expect(years[DefaultAxisStartYear]).toBe(10);
    expect(years[AxisHorizonYear]).toBe(10);
    expect(warnings).toContainEqual(expect.stringContaining("returned a scalar"));
  });

  test("the axis starts at the earliest series year and reaches the horizon; years a series lacks drop out", async () => {
    const series = inlineDataSeriesVariable({ id: "a", name: "A", values: { [isoYear(2016)]: 1, [isoYear(2018)]: 3 } });

    const doubled = await new Recipe({ name: "Doubled", equation: "${a} * 2", variables: [series] }).evaluate([]);
    expect(byYear(doubled)).toEqual({ 2016: 2, 2018: 6 });

    const extended = await new Recipe({ name: "Extended", equation: "extend(year, ${a})", variables: [series] }).evaluate([]);
    const years = Object.keys(byYear(extended)).map(Number);
    expect(Math.min(...years)).toBe(2016);
    expect(Math.max(...years)).toBe(AxisHorizonYear);
    expect(byYear(extended)[2017]).toBe(1);
  });

  test("a series past the horizon stretches the axis", async () => {
    const recipe = new Recipe({ name: "Far", equation: "${a}", variables: [inlineDataSeriesVariable({ id: "a", name: "A", values: { [isoYear(2020)]: 1, [isoYear(2055)]: 2 } })] });
    expect(byYear(await recipe.evaluate([]))).toEqual({ 2020: 1, 2055: 2 });
  });

  test("legacy display-name placeholders resolve when the name is unique and fail validity when ambiguous", async () => {
    const unique = new Recipe({ name: "Legacy", equation: "${Legacy Name}", variables: [scalarVariable("x1", "Legacy Name", 4)] });
    expect(byYear(await unique.evaluate([]))[2020]).toBe(4);

    const ambiguous = new Recipe({
      name: "Ambiguous",
      equation: "${Same Name} + 1",
      variables: [scalarVariable("a", "Same Name", 1), scalarVariable("b", "Same Name", 2)],
    });
    const validity = await ambiguous.checkValidity();
    expect(validity.good).toBe(false);
    expect(validity.error).toContain("Error evaluating formula equation");
  });

  test("ids are normalized to identifiers and collisions get suffixes", async () => {
    const recipe = new Recipe({
      name: "Normalize",
      equation: "${a-b} + ${a b} + ${1odd} + ${a_b}",
      variables: [
        scalarVariable("a-b", "A", 1),
        scalarVariable("a b", "B", 2),
        scalarVariable("1odd", "C", 3),
        scalarVariable("a_b", "D", 4), // normalizes to the same identifier as the first two
      ],
    });
    expect(byYear(await recipe.evaluate([]))[2020]).toBe(10);
  });

  test("a variable with the id `year` does not shadow the year axis", async () => {
    const recipe = new Recipe({
      name: "Year clash",
      equation: "reachBy(year, ${year}, 20, 2020, 2030)",
      variables: [scalarVariable("year", "Start", 10)],
    });
    const years = byYear(await recipe.evaluate([]));
    expect(years[2020]).toBe(10);
    expect(years[2030]).toBe(20);
  });

  test("checkValidity skips template recipes without evaluating", async () => {
    const recipe = new Recipe({ name: "Template", equation: "${t} / 0 +", variables: [{ ...scalarVariable("t", "Template", 2), template: true }] });
    expect(recipe.isTemplate()).toBe(true);
    const validity = await recipe.checkValidity();
    expect(validity).toEqual({ good: true, error: undefined, warnings: undefined });
  });

  test("checkValidity reports a unit/number mismatch as invalid", async () => {
    const recipe = new Recipe({ name: "Mismatch", equation: "${a} + 1", variables: [scalarVariable("a", "A", 1, "kg")] });
    const validity = await recipe.checkValidity();
    expect(validity.good).toBe(false);
    expect(validity.error).toContain("addScalar");
    expect(await recipe.isValid()).toBe(false);
  });

  test("checkValidity translates the unit/number mismatch into its friendly message", async () => {
    // The alias table in checkValidity is keyed by the bare mathjs message, but evaluate()
    // wraps it in a MathjsError with an "Error evaluating formula equation: " prefix, so no alias ever matches.
    test.fail(true, "Recipe.checkValidity error aliases never match the prefixed MathjsError message (src/functions/recipe/recipe.ts)");
    const recipe = new Recipe({ name: "Mismatch", equation: "${a} + 1", variables: [scalarVariable("a", "A", 1, "kg")] });
    expect((await recipe.checkValidity()).error).toBe("Cannot add a unitless number to a unit.");
  });

  test("a linked data series is read through the injected getter", async () => {
    const recipe = new Recipe({
      name: "Linked",
      equation: "${ds} + ${offset}",
      variables: [linkedDataSeriesVariable("ds", "Linked DS", dataSeriesIds.main, "kg"), scalarVariable("offset", "Offset", 2, "kg")],
    });
    const result = await recipe.evaluate([], {
      dataSeriesGetter: makeDataSeriesGetter({ [dataSeriesIds.main]: { unit: "kg", values: { [isoYear(2020)]: 5, [isoYear(2021)]: 7 } } }),
    });
    expect(result?.unit).toBe("kg");
    expect(byYear(result)).toEqual({ 2020: 7, 2021: 9 });
  });

  test("a missing, absent or failing data series getter is a RecipeError", async () => {
    const recipe = new Recipe({ name: "Missing", equation: "${m}", variables: [linkedDataSeriesVariable("m", "Missing", dataSeriesIds.missing)] });

    await expect(recipe.evaluate([], { dataSeriesGetter: makeDataSeriesGetter({}) })).rejects.toThrow("Failed to fetch data series");
    await expect(recipe.evaluate([])).rejects.toThrow("no data series getter");
    await expect(recipe.evaluate([], { dataSeriesGetter: () => Promise.reject(new Error("db down")) })).rejects.toThrow("db down");
  });

  test("an external variable is fetched through the injected table content getter with its selection", async () => {
    const selection = [{ variableCode: "Region", valueCodes: ["00"] }];
    const recipe = new Recipe({
      name: "External",
      equation: "${ext} * 2",
      variables: [externalVariable({ id: "ext", name: "External", tableId: "table-1", selection, unit: "kg" })],
    });
    const calls: unknown[][] = [];
    const result = await recipe.evaluate([], {
      externalTableContentGetter: makeExternalTableContentGetter({ "table-1": tableContent("table-1", { 2020: 3, 2021: 4 }) }, calls),
    });

    expect(calls).toEqual([["table-1", "SCB", selection]]);
    expect(result?.unit).toBe("kg");
    expect(byYear(result)).toEqual({ 2020: 6, 2021: 8 });
  });

  test("scalar, data series and external combine over the overlapping years only", async () => {
    const recipe = new Recipe({
      name: "Mixed",
      equation: "${ds} + ${ext} + ${k}",
      variables: [
        linkedDataSeriesVariable("ds", "Data series", dataSeriesIds.other, "kg"),
        externalVariable({ id: "ext", name: "External", tableId: "table-mix", unit: "kg" }),
        scalarVariable("k", "Scalar", 1, "kg"),
      ],
    });
    const result = await recipe.evaluate([], {
      dataSeriesGetter: makeDataSeriesGetter({ [dataSeriesIds.other]: { unit: "kg", values: { [isoYear(2019)]: 100, [isoYear(2020)]: 5, [isoYear(2021)]: 8, [isoYear(2023)]: 21 } } }),
      externalTableContentGetter: makeExternalTableContentGetter({ "table-mix": tableContent("table-mix", { 2020: 20, 2021: 30, 2022: 40 }) }),
    });
    expect(result?.unit).toBe("kg");
    expect(byYear(result)).toEqual({ 2020: 26, 2021: 39 });
  });

  test("non-Jan-1 timestamps of a stored series are normalized to their year", async () => {
    const recipe = new Recipe({ name: "Mid-year", equation: "${ds}", variables: [linkedDataSeriesVariable("ds", "DS", dataSeriesIds.main, "kg")] });
    const dataSeriesGetter = (): Promise<DataSeries> => Promise.resolve({
      id: dataSeriesIds.main,
      unit: "kg",
      values: [
        { data_series_id: dataSeriesIds.main, timestamp: new Date("2020-06-15T00:00:00.000Z"), value: 7 },
        { data_series_id: dataSeriesIds.main, timestamp: new Date("2021-09-30T13:37:00.000Z"), value: 9 },
      ],
    });
    expect(byYear(await recipe.evaluate([], { dataSeriesGetter }))).toEqual({ 2020: 7, 2021: 9 });
  });

  test("series without overlapping years give a clear error", async () => {
    const recipe = new Recipe({
      name: "No overlap",
      equation: "${a} + ${b}",
      variables: [
        inlineDataSeriesVariable({ id: "a", name: "A", values: { [isoYear(2000)]: 1, [isoYear(2001)]: 2 }, unit: "kg" }),
        inlineDataSeriesVariable({ id: "b", name: "B", values: { [isoYear(2030)]: 3, [isoYear(2031)]: 4 }, unit: "kg" }),
      ],
    });
    await expect(recipe.evaluate([])).rejects.toThrow("no overlapping years");
  });

  test("a mathjs failure is wrapped as a MathjsError", async () => {
    const recipe = new Recipe({ name: "Syntax", equation: "${a} +", variables: [scalarVariable("a", "A", 1)] });
    await expect(recipe.evaluate([])).rejects.toThrow(MathjsError);
  });
});

test.describe("Recipe.evaluate unit handling", () => {
  test("adding kg and g converts and keeps the first operand's unit", async () => {
    const recipe = new Recipe({ name: "Mixed units", equation: "${a} + ${b}", variables: [scalarVariable("a", "A", 1, "kg"), scalarVariable("b", "B", 500, "g")] });
    const result = await recipe.evaluate([]);
    expect(result?.unit).toBe("kg");
    expect(byYear(result)[2020]).toBeCloseTo(1.5);
  });

  test("dividing and multiplying by the same dimension cancels it out of the result unit", async () => {
    const recipe = new Recipe({
      name: "Per capita and back",
      equation: "${total} / ${population} * ${population}",
      variables: [scalarVariable("total", "Total", 6, "kWh"), scalarVariable("population", "Population", 3, "person")],
    });
    const result = await recipe.evaluate([]);
    expect(result?.unit).toBe("kWh");
    expect(byYear(result)[2020]).toBeCloseTo(6);

    const perCapita = new Recipe({ name: "Per capita", equation: "${total} / ${population}", variables: recipe.variables });
    expect((await perCapita.evaluate([]))?.unit).toBe("kWh / person");
  });

  test(".* and ./ work elementwise over two series", async () => {
    const a = inlineDataSeriesVariable({ id: "a", name: "A", values: { [isoYear(2020)]: 2, [isoYear(2021)]: 4, [isoYear(2022)]: 8 }, unit: "kg" });
    const b = inlineDataSeriesVariable({ id: "b", name: "B", values: { [isoYear(2020)]: 1, [isoYear(2021)]: 2, [isoYear(2022)]: 2 }, unit: "st" });

    const product = await new Recipe({ name: "Product", equation: "${a} .* ${b}", variables: [a, b] }).evaluate([]);
    expect(product?.unit).toBe("kg st");
    expect(byYear(product)).toEqual({ 2020: 2, 2021: 8, 2022: 16 });

    const quotient = await new Recipe({ name: "Quotient", equation: "${a} ./ ${b}", variables: [a, b] }).evaluate([]);
    expect(quotient?.unit).toBe("kg / st");
    expect(byYear(quotient)).toEqual({ 2020: 2, 2021: 2, 2022: 4 });
  });

  test("division by zero does not throw: 0/0 drops the year, x/0 is not finite", async () => {
    const recipe = new Recipe({
      name: "Division by zero",
      equation: "${a} ./ ${b}",
      variables: [
        inlineDataSeriesVariable({ id: "a", name: "A", values: { [isoYear(2020)]: 0, [isoYear(2021)]: 1, [isoYear(2022)]: 4 } }),
        inlineDataSeriesVariable({ id: "b", name: "B", values: { [isoYear(2020)]: 0, [isoYear(2021)]: 0, [isoYear(2022)]: 2 } }),
      ],
    });
    const years = byYear(await recipe.evaluate([]));
    expect(years[2020]).toBeUndefined();
    expect(Number.isFinite(years[2021])).toBe(false);
    expect(years[2022]).toBe(2);
  });

  test("a declared unit overrides the evaluated one; missing keeps it; unitless overrides too", async () => {
    const variables = [scalarVariable("a", "A", 1, "kg")];
    expect((await new Recipe({ name: "Declared", equation: "${a}", variables, unit: parseUnit("ton") }).evaluate([]))?.unit).toBe("ton");
    expect((await new Recipe({ name: "Missing", equation: "${a}", variables, unit: UnitFlags.Missing }).evaluate([]))?.unit).toBe("kg");
    expect((await new Recipe({ name: "Unitless", equation: "${a}", variables, unit: UnitFlags.Unitless }).evaluate([]))?.unit).toBe(UnitFlags.Unitless);
  });

  test("unitless inputs give a unitless result", async () => {
    const recipe = new Recipe({ name: "Unitless", equation: "${a} * ${b}", variables: [scalarVariable("a", "A", 2), scalarVariable("b", "B", 3)] });
    const result = await recipe.evaluate([]);
    expect(result?.unit).toBe(UnitFlags.Unitless);
    expect(byYear(result)[2020]).toBe(6);
  });

  test("an unparseable unit falls back to unitless with a warning", async () => {
    const recipe = new Recipe({ name: "Bad unit", equation: "${a}", variables: [scalarVariable("a", "A", 2, "not-a-unit")] });
    const warnings: string[] = [];
    const result = await recipe.evaluate(warnings);
    expect(result?.unit).toBe(UnitFlags.Unitless);
    expect(warnings).toContainEqual(expect.stringContaining("invalid unit"));
  });
});

test.describe("Recipe.withEditableExternals", () => {
  const externalSource = { dataset: "SCB" as const, tableId: "TAB628", selection: [{ variableCode: "Region", valueCodes: ["00"] }] };
  const stored = () => new Recipe({
    name: "Stored",
    equation: "${ext} * ${k}",
    variables: [
      { ...linkedDataSeriesVariable("ext", "Population", dataSeriesIds.main, "person"), pick: VectorIndexPickerOptions.Last, externalSource },
      scalarVariable("k", "K", 2),
    ],
  });

  test("rehydrates materialized externals into External variables keeping selection, pick, unit and the stored series id", () => {
    const editable = stored().withEditableExternals();
    const rehydrated = editable.variables[0];
    expect(rehydrated.type).toBe(RecipeDataTypes.External);
    if (rehydrated.type !== RecipeDataTypes.External) return;
    expect(rehydrated).toMatchObject({ id: "ext", name: "Population", unit: "person", pick: VectorIndexPickerOptions.Last, dataSeriesId: dataSeriesIds.main, ...externalSource });
    expect(editable.variables[1]).toEqual(stored().variables[1]);
    expect(editable.equation).toBe("${ext} * ${k}");
  });

  test("leaves the original untouched and plain data series alone", () => {
    const original = stored();
    original.withEditableExternals();
    expect(original.variables[0].type).toBe(RecipeDataTypes.DataSeries);

    const plain = new Recipe({ name: "Plain", equation: "${ds}", variables: [linkedDataSeriesVariable("ds", "DS", dataSeriesIds.main)] });
    expect(plain.withEditableExternals().variables).toEqual(plain.variables);
  });

  test("a rehydrated external evaluates from its stored series, not the upstream API", async () => {
    const editable = stored().withEditableExternals();
    const result = await editable.evaluate([], {
      dataSeriesGetter: makeDataSeriesGetter({ [dataSeriesIds.main]: { unit: "person", values: { [isoYear(2020)]: 10, [isoYear(2021)]: 20 } } }),
      externalTableContentGetter: () => Promise.reject(new Error("must not fetch")),
    });
    expect(result?.unit).toBe("person");
    expect(byYear(result)[2020]).toBe(40);
  });
});

test.describe("Recipe.areRecipesEqual", () => {
  const make = (overrides: Partial<ConstructorParameters<typeof Recipe>[0]> = {}) => new Recipe({
    name: "Same",
    equation: "${a} + ${b}",
    variables: [scalarVariable("a", "A", 1, "kg"), scalarVariable("b", "B", 2, "kg")],
    unit: parseUnit("kg"),
    ...overrides,
  });

  test("equal recipes compare equal regardless of meta and variable key order", () => {
    expect(Recipe.areRecipesEqual(make(), make({ meta: { isSuggestedRecipe: true } }))).toBe(true);
    const reordered = { unit: parseUnit("kg"), value: 1, type: RecipeDataTypes.Scalar, name: "A", id: "a" } as ScalarVariable;
    expect(Recipe.areRecipesEqual(make(), make({ variables: [reordered, scalarVariable("b", "B", 2, "kg")] }))).toBe(true);
  });

  test("name, equation, unit, variable content and variable order all matter", () => {
    expect(Recipe.areRecipesEqual(make(), make({ name: "Other" }))).toBe(false);
    expect(Recipe.areRecipesEqual(make(), make({ equation: "${b} + ${a}" }))).toBe(false);
    expect(Recipe.areRecipesEqual(make(), make({ unit: parseUnit("g") }))).toBe(false);
    expect(Recipe.areRecipesEqual(make(), make({ variables: [scalarVariable("a", "A", 1, "kg"), scalarVariable("b", "B", 3, "kg")] }))).toBe(false);
    expect(Recipe.areRecipesEqual(make(), make({ variables: [scalarVariable("b", "B", 2, "kg"), scalarVariable("a", "A", 1, "kg")] }))).toBe(false);
    expect(Recipe.areRecipesEqual(make(), make({ variables: [scalarVariable("a", "A", 1, "kg")] }))).toBe(false);
  });

  test("isVariableEqual ignores the template flag only", () => {
    const base = scalarVariable("same", "Same", 1, "kg");
    expect(Recipe.isVariableEqual({ ...base, template: true }, base)).toBe(true);
    expect(Recipe.isVariableEqual({ ...base, name: "Renamed" }, base)).toBe(false);
  });
});

test.describe("Recipe.fromManualDateValues", () => {
  const dateValues: DateValuesWithUnit = { unit: parseUnit("kg"), dateValues: { [isoYear(2020)]: 1, [isoYear(2022)]: 3.5 } };

  test("evaluates to the entered values and unit", async () => {
    const recipe = Recipe.fromManualDateValues(dateValues);
    expect(recipe.isManual()).toBe(true);
    expect(recipe.unit).toBe("kg");
    const result = await recipe.evaluate([]);
    expect(result).toEqual(dateValues);
  });

  test("keeps the variable id stable when given, otherwise generates a uuid the equation references", () => {
    const stable = Recipe.fromManualDateValues(dateValues, "my-variable");
    expect(stable.variables[0].id).toBe("my-variable");
    expect(stable.equation).toBe("${my-variable}");

    const generated = Recipe.fromManualDateValues(dateValues);
    expect(generated.variables[0].id).toMatch(/^[0-9a-f-]{36}$/);
    expect(generated.equation).toBe(`\${${generated.variables[0].id}}`);
    const variable = generated.variables[0] as DataSeriesVariable;
    expect(variable.dataSeriesId).toBeNull();
    expect(variable.value).toEqual(dateValues.dateValues);
  });

  test("a unitless manual series stays unitless", async () => {
    const recipe = Recipe.fromManualDateValues({ unit: UnitFlags.Unitless, dateValues: { [isoYear(2020)]: 2 } });
    expect((await recipe.evaluate([]))?.unit).toBe(UnitFlags.Unitless);
  });
});

test.describe("Recipe.fromInitialDateValue", () => {
  const dateValues: DateValuesWithUnit = { unit: parseUnit("kg"), dateValues: { [isoYear(2020)]: 0, [isoYear(2021)]: 5, [isoYear(2022)]: 7 } };

  test("picks the first value and broadcasts it over the axis in the series' unit", async () => {
    const recipe = Recipe.fromInitialDateValue(dateValues);
    expect(recipe.baselineDerivation()).toBe(BaselineType.Initial);
    const result = await recipe.evaluate([]);
    expect(result?.unit).toBe("kg");
    const years = byYear(result);
    expect(years[2020]).toBe(0);
    expect(years[AxisHorizonYear]).toBe(0);
    expect(Object.keys(years)).toHaveLength(AxisHorizonYear - 2020 + 1);
  });

  test("nonZero picks the first non-zero value, falling back to the first when all are zero", async () => {
    const nonZero = Recipe.fromInitialDateValue(dateValues, { nonZero: true });
    expect(nonZero.baselineDerivation()).toBe(BaselineType.InitialNonZero);
    expect(byYear(await nonZero.evaluate([]))[2021]).toBe(5);

    const allZero = Recipe.fromInitialDateValue({ unit: parseUnit("kg"), dateValues: { [isoYear(2020)]: 0, [isoYear(2021)]: 0 } }, { nonZero: true });
    expect(byYear(await allZero.evaluate([]))[2021]).toBe(0);
  });

  test("the inline variable is unitless so a non-mathjs unit never has to parse; the unit is declared on the recipe", async () => {
    const recipe = Recipe.fromInitialDateValue({ unit: parseUnit("widgets per sprint"), dateValues: { [isoYear(2020)]: 3 } }, undefined, "stable");
    expect(recipe.variables[0].unit).toBe(UnitFlags.Unitless);
    expect(recipe.variables[0].id).toBe("stable");
    const result = await recipe.evaluate([]);
    expect(result?.unit).toBe("widgets per sprint");
    expect(byYear(result)[2020]).toBe(3);
  });
});

test.describe("Recipe.fromLinkedDataSeries", () => {
  test("reads the linked series through the getter and takes the stored unit when none is declared", async () => {
    const recipe = Recipe.fromLinkedDataSeries({ name: "Inherited", dataSeriesId: dataSeriesIds.main, variableId: "link" });
    expect(recipe.equation).toBe("${link}");
    const variable = recipe.variables[0] as DataSeriesVariable;
    expect(variable).toMatchObject({ dataSeriesId: dataSeriesIds.main, value: null, unit: UnitFlags.Missing });

    const result = await recipe.evaluate([], {
      dataSeriesGetter: makeDataSeriesGetter({ [dataSeriesIds.main]: { unit: "kg", values: { [isoYear(2020)]: 1, [isoYear(2021)]: 2 } } }),
    });
    expect(result?.unit).toBe("kg");
    expect(byYear(result)).toEqual({ 2020: 1, 2021: 2 });
  });

  test("a declared variable unit takes precedence over the stored one", async () => {
    const recipe = Recipe.fromLinkedDataSeries({ name: "Inherited", dataSeriesId: dataSeriesIds.main, unit: parseUnit("g") });
    const result = await recipe.evaluate([], {
      dataSeriesGetter: makeDataSeriesGetter({ [dataSeriesIds.main]: { unit: "kg", values: { [isoYear(2020)]: 1 } } }),
    });
    expect(result?.unit).toBe("g");
  });

  test("fromExternalSource wraps a selection in a single external variable", async () => {
    const recipe = Recipe.fromExternalSource({ name: "Fetch", dataset: "SCB", tableId: "table-1", selection: [{ variableCode: "Region", valueCodes: ["00"] }], variableId: "ext" });
    expect(recipe.equation).toBe("${ext}");
    expect(recipe.variables[0].type).toBe(RecipeDataTypes.External);
    const result = await recipe.evaluate([], { externalTableContentGetter: makeExternalTableContentGetter({ "table-1": tableContent("table-1", { 2020: 3 }) }) });
    expect(byYear(result)).toEqual({ 2020: 3 });
  });
});

test.describe("extractScalars", () => {
  test("creates mathjs units and warns on an invalid unit", () => {
    const warnings: string[] = [];
    const scalars = extractScalars([scalarVariable("ok", "OK", 3, "kg"), scalarVariable("bad", "Bad", 2, "not-a-unit")], warnings);

    expect(scalars).toHaveLength(2);
    expect(scalars[0].value.toString()).toBe("3 kg");
    expect(scalars[1].value.toString()).toBe("2");
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("invalid unit");
  });

  test("ignores non-scalar variables", () => {
    expect(extractScalars([inlineDataSeriesVariable({ id: "ds", name: "DS", values: { [isoYear(2020)]: 1 } })])).toEqual([]);
  });
});

test.describe("extractDataSeries", () => {
  test("an inline series with the whole pick becomes a series", async () => {
    const [output] = await extractDataSeries([inlineDataSeriesVariable({ id: "ds", name: "Inline", unit: "kg", values: { [isoYear(2020)]: 1, [isoYear(2021)]: 3 } })]);
    expect("series" in output).toBe(true);
    if (!("series" in output)) return;
    expect(output.series.unit).toBe("kg");
    expect(output.series.dateValues).toEqual({ [isoYear(2020)]: 1, [isoYear(2021)]: 3 });
  });

  test("a pick by year becomes a scalar", async () => {
    const [output] = await extractDataSeries([inlineDataSeriesVariable({ id: "ds", name: "Inline", pick: 2021, values: { [isoYear(2020)]: 4, [isoYear(2021)]: 6 } })]);
    expect("value" in output && !Array.isArray(output.value) && typeof output.value !== "number" && output.value.toNumber()).toBe(6);
  });

  test("a variable with neither a link nor inline values is a RecipeError", async () => {
    await expect(extractDataSeries([{ id: "broken", name: "Broken", type: RecipeDataTypes.DataSeries, pick: VectorIndexPickerOptions.Whole, dataSeriesId: undefined, value: undefined, unit: UnitFlags.Unitless }]))
      .rejects.toThrow(RecipeError);
  });

  test("a linked series is resolved through the getter and the stored unit applies when the variable has none", async () => {
    const [output] = await extractDataSeries([linkedDataSeriesVariable("linked", "Linked", dataSeriesIds.main, "")], [], makeDataSeriesGetter({
      [dataSeriesIds.main]: { unit: "kg", values: { [isoYear(2020)]: 10, [isoYear(2021)]: 20 } },
    }));
    expect("series" in output && output.series.unit).toBe("kg");
    expect("series" in output && output.series.dateValues[isoYear(2020)]).toBe(10);
  });
});

test.describe("extractExternalDatasets / fetchExternalVariableData", () => {
  test("fails fast when dataset, tableId or selection are missing", async () => {
    await expect(extractExternalDatasets([externalVariable({ id: "ext", name: "External", dataset: null, tableId: null, selection: [] })])).rejects.toThrow(RecipeError);
  });

  test("fails when no table content getter is injected", async () => {
    await expect(extractExternalDatasets([externalVariable({ id: "ext", name: "External", tableId: "t" })])).rejects.toThrow("no table content getter");
  });

  test("fails when the getter has no data or no values", async () => {
    const variable = externalVariable({ id: "ext", name: "External", tableId: "t" });
    await expect(extractExternalDatasets([variable], [], makeExternalTableContentGetter({}))).rejects.toThrow("has no data");
    await expect(extractExternalDatasets([variable], [], makeExternalTableContentGetter({ t: tableContent("t", {}) }))).rejects.toThrow("has no values");
  });

  test("a pick by year gives a scalar", async () => {
    const [output] = await extractExternalDatasets(
      [externalVariable({ id: "ext", name: "External", tableId: "t", pick: 2021, unit: "kg" })],
      [],
      makeExternalTableContentGetter({ t: tableContent("t", { 2020: 1, 2021: 5, 2022: 9 }) }),
    );
    expect("value" in output && !Array.isArray(output.value) && typeof output.value !== "number" && output.value.toString()).toBe("5 kg");
  });

  test("sub-yearly periods collapse to the first record of each year and non-numeric values are skipped with a warning", async () => {
    const warnings: string[] = [];
    const fetched = await fetchExternalVariableData(
      externalVariable({ id: "ext", name: "External", tableId: "t" }),
      warnings,
      makeExternalTableContentGetter({ t: { id: "t", metadata: [], values: [
        { period: "2020K1", value: "1" },
        { period: "2020K2", value: "2" },
        { period: "2021M01", value: ".." },
        { period: "2021M02", value: "3" },
        { period: "2022", value: "4" },
      ] } }),
    );
    expect(fetched.dateValues).toEqual({ [isoYear(2020)]: 1, [isoYear(2022)]: 4 });
    expect(warnings).toContainEqual(expect.stringContaining("non-numeric value"));
    expect(fetched.unit).toBe(UnitFlags.Unitless);
  });

  test("a materialized external reads its stored series instead of fetching", async () => {
    const calls: unknown[][] = [];
    const [output] = await extractExternalDatasets(
      [externalVariable({ id: "ext", name: "External", tableId: "t", unit: "", dataSeriesId: dataSeriesIds.main })],
      [],
      makeExternalTableContentGetter({}, calls),
      makeDataSeriesGetter({ [dataSeriesIds.main]: { unit: "kg", values: { [isoYear(2020)]: 7 } } }),
    );
    expect(calls).toEqual([]);
    expect("series" in output && output.series).toEqual({ unit: "kg", dateValues: { [isoYear(2020)]: 7 } });
  });

  test("a materialized external whose series is gone falls back to a live fetch with a warning", async () => {
    const warnings: string[] = [];
    const [output] = await extractExternalDatasets(
      [externalVariable({ id: "ext", name: "External", tableId: "t", dataSeriesId: dataSeriesIds.missing })],
      warnings,
      makeExternalTableContentGetter({ t: tableContent("t", { 2020: 2 }) }),
      makeDataSeriesGetter({}),
    );
    expect(warnings).toContainEqual(expect.stringContaining("falling back to a live fetch"));
    expect("series" in output && output.series.dateValues).toEqual({ [isoYear(2020)]: 2 });
  });
});
