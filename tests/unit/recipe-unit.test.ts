/* eslint-disable no-template-curly-in-string */
import { expect, test } from "playwright/test";

import mathjs from "../../src/math";
import {
  ANDMasks,
  Recipe,
  RecipeDataTypes,
  RecipeError,
  VectorIndexPickerOptions,
  dateValuesToDBDateRecord,
  dataSeriesToDateValues,
  extractDataSeries,
  extractExternalDatasets,
  extractScalars,
  getPrevailingUnit,
  isMathjsUnit,
  parseDateValuesFromVector,
  pickDateValues,
  sanityCheckDataSeries,
  sanityCheckExternalDatasets,
  sanityCheckScalars,
  transformDateValuesToVector,
} from "../../src/functions/recipe";
import type { DataSeriesVariable, ExternalVariable, ScalarVariable } from "../../src/functions/recipe/types";
import type { ApiTableData } from "../../src/lib/api/apiTypes";
import type { DataSeries, DateValues, DateValuesWithUnit, ISOIshDate } from "../../src/types";

const isoYear = (year: number): ISOIshDate => `${year}-01-01T00:00:00.000Z`;

const unitValueToNumber = (value: unknown): number => {
  if (!mathjs.isUnit(value)) {
    throw new Error("Expected a mathjs Unit value");
  }
  return value.toNumber();
};

type EvaluateOptions = Parameters<Recipe["evaluate"]>[1];

async function evaluateWithWarnings(recipe: Recipe, options?: EvaluateOptions) {
  const warnings: string[] = [];
  const result = await recipe.evaluate(warnings, options);
  if (warnings.length > 0) {
    console.warn("Recipe.evaluate warnings:", warnings);
  }
  return { result, warnings };
}

function scalarVariable(
  id: string,
  name: string,
  value: number,
  unit?: string | null,
): ScalarVariable {
  return {
    id,
    name,
    type: RecipeDataTypes.Scalar,
    value,
    unit,
  };
}

function inlineDataSeriesVariable({
  id,
  name,
  values,
  pick = VectorIndexPickerOptions.Whole,
  unit,
}: {
  id: string;
  name: string;
  values: DateValues;
  pick?: DataSeriesVariable["pick"];
  unit?: string | null;
}): DataSeriesVariable {
  return {
    id,
    name,
    type: RecipeDataTypes.DataSeries,
    pick,
    dataSeriesId: undefined,
    value: values,
    unit,
  };
}

function makeDataSeriesGetter(seed: Record<string, { values: DateValues; unit?: string | null }>) {
  // eslint-disable-next-line @typescript-eslint/require-await
  return async (dataSeriesId: string): Promise<DataSeries | null> => {
    const found = seed[dataSeriesId];
    if (!found) {
      return null;
    }

    return {
      id: dataSeriesId,
      unit: found.unit ?? null,
      values: Object.entries(found.values).map(([timestamp, value]) => ({
        dataSeriesId,
        timestamp: new Date(timestamp),
        value,
      })),
    } satisfies DataSeries;
  };
}

function externalVariable({
  id,
  name,
  dataset,
  tableId,
  selection,
  pick = VectorIndexPickerOptions.Whole,
  unit,
}: {
  id: string;
  name: string;
  dataset: ExternalVariable["dataset"];
  tableId: string;
  selection: ExternalVariable["selection"];
  pick?: ExternalVariable["pick"];
  unit?: string | null;
}): ExternalVariable {
  return {
    id,
    name,
    type: RecipeDataTypes.External,
    dataset,
    tableId,
    selection,
    pick,
    unit,
  };
}

function makeExternalTableContentGetter(seed: Record<string, ApiTableData>) {
  // eslint-disable-next-line @typescript-eslint/require-await
  return async (tableId: string): Promise<ApiTableData | null> => seed[tableId] ?? null;
}

const dataSeriesIds = {
  main: "11111111-1111-1111-1111-111111111111",
  mix: "22222222-2222-2222-2222-222222222222",
  missing: "33333333-3333-3333-3333-333333333333",
  linked: "44444444-4444-4444-4444-444444444444",
};

test.describe("Recipe evaluator and factories", () => {
  test("serialize/deserialize roundtrip keeps data", () => {
    const recipe = new Recipe({
      name: "Roundtrip",
      equation: "${a} + ${b}",
      variables: [
        scalarVariable("a", "Alpha", 2, "kg"),
        scalarVariable("b", "Beta", 3, "kg"),
      ],
    });

    const serialized = recipe.serialize();
    const parsed = Recipe.deserialize(serialized);

    expect(parsed.name).toBe("Roundtrip");
    expect(parsed.equation).toBe("${a} + ${b}");
    expect(parsed.variables).toHaveLength(2);
    expect(parsed.variables[0].id).toBe("a");
  });

  test("from supports wrapped object shape", () => {
    const recipe = Recipe.from({
      recipe: {
        name: "Wrapped",
        equation: "${x}",
        variables: [scalarVariable("x", "X", 7, null)],
        meta: { v: 1 },
      },
    });

    expect(recipe.name).toBe("Wrapped");
    expect(recipe.variables).toHaveLength(1);
    expect(recipe.variables[0].id).toBe("x");
  });

  test("from invalid JSON string throws", () => {
    expect(() => Recipe.from("{not valid json")).toThrow("Invalid serialized recipe format");
  });

  test("checkValidity skips template recipes", async () => {
    const recipe = new Recipe({
      name: "Template",
      equation: "${templ}",
      variables: [{ ...scalarVariable("templ", "Template", 2), template: true }],
    });

    const validity = await recipe.checkValidity();

    expect(validity.good).toBe(true);
    expect(validity.error).toBeUndefined();
  });

  test("evaluate throws on empty equation", async () => {
    const recipe = new Recipe({
      name: "Empty",
      equation: "   ",
      variables: [scalarVariable("x", "X", 1)],
    });

    await expect(recipe.evaluate([], { dataSeriesGetter: () => new Promise(() => null) })).rejects.toThrow("Equation is empty, no evaluation performed");
  });

  test("evaluate scalar equation broadcasts across default years", async () => {
    const recipe = new Recipe({
      name: "Scalar to timeline",
      equation: "${s} * 2",
      variables: [scalarVariable("s", "Scalar", 5, "kg")],
    });

    const { result } = await evaluateWithWarnings(recipe);
    if (!result) {
      throw new Error("Expected a non-null evaluation result");
    }

    const entries = Object.entries(result.dateValues);
    expect(entries.length).toBe(31);
    expect(result.unit).toBe("kg");
    expect(result.dateValues[isoYear(2020)]).toBe(10);
    expect(result.dateValues[isoYear(2031)]).toBe(10);
    expect(result.dateValues[isoYear(2050)]).toBe(10);
  });

  test("evaluate supports legacy display-name placeholders when unique", async () => {
    const recipe = new Recipe({
      name: "Legacy placeholders",
      equation: "${Legacy Name}",
      variables: [scalarVariable("x1", "Legacy Name", 4)],
    });

    const { result } = await evaluateWithWarnings(recipe);
    if (!result) {
      throw new Error("Expected a non-null evaluation result");
    }
    expect(result.dateValues[isoYear(2020)]).toBe(4);
  });

  test("ambiguous legacy display-name placeholders fail validity", async () => {
    const recipe = new Recipe({
      name: "Ambiguous",
      equation: "${Same Name} + 1",
      variables: [
        scalarVariable("a", "Same Name", 1),
        scalarVariable("b", "Same Name", 2),
      ],
    });

    const validity = await recipe.checkValidity();
    expect(validity.good).toBe(false);
    expect(validity.error).toContain("Error evaluating recipe equation");
  });

  test("evaluate handles IDs needing normalization and collisions", async () => {
    const recipe = new Recipe({
      name: "Normalize",
      equation: "${a-b} + ${a b} + ${1odd}",
      variables: [
        scalarVariable("a-b", "A", 1),
        scalarVariable("a b", "B", 2),
        scalarVariable("1odd", "C", 3),
      ],
    });

    const { result } = await evaluateWithWarnings(recipe);
    if (!result) {
      throw new Error("Expected a non-null evaluation result");
    }
    expect(result.dateValues[isoYear(2020)]).toBe(6);
  });

  test("evaluate with linked data series uses custom dataSeriesGetter", async () => {
    const recipe = new Recipe({
      name: "Linked DS",
      equation: "${ds_linked} + ${offset}",
      variables: [
        {
          id: "ds_linked",
          name: "Linked DS",
          type: RecipeDataTypes.DataSeries,
          pick: VectorIndexPickerOptions.Whole,
          dataSeriesId: dataSeriesIds.main,
          value: undefined,
          unit: "kg",
        },
        scalarVariable("offset", "Offset", 2, "kg"),
      ],
    });

    const { result } = await evaluateWithWarnings(recipe, {
      dataSeriesGetter: makeDataSeriesGetter({
        [dataSeriesIds.main]: {
          unit: "kg",
          values: {
            [isoYear(2020)]: 5,
            [isoYear(2021)]: 7,
            [isoYear(2022)]: 11,
          },
        },
      }),
    });

    if (!result) {
      throw new Error("Expected a non-null evaluation result");
    }

    expect(result.unit).toBe("kg");
    expect(result.dateValues[isoYear(2020)]).toBe(7);
    expect(result.dateValues[isoYear(2021)]).toBe(9);
    expect(result.dateValues[isoYear(2022)]).toBe(13);
  });

  test("evaluate with custom external fetcher supports yearly values", async () => {
    const recipe = new Recipe({
      name: "External override",
      equation: "${ext} * 2",
      variables: [
        externalVariable({
          id: "ext",
          name: "External",
          dataset: "SCB",
          tableId: "table-1",
          selection: [{ variableCode: "Region", valueCodes: ["00"] }],
          unit: "kg",
        }),
      ],
    });

    const { result } = await evaluateWithWarnings(recipe, {
      externalTableContentGetter: makeExternalTableContentGetter({
        "table-1": {
          id: "table-1",
          values: [
            { period: "2020", value: "3" },
            { period: "2021", value: "4" },
            { period: "2022", value: "6" },
          ],
          metadata: [{ label: "stub", source: "stub" }],
        },
      }),
    });

    if (!result) {
      throw new Error("Expected a non-null evaluation result");
    }

    expect(result.unit).toBe("kg");
    expect(result.dateValues[isoYear(2020)]).toBe(6);
    expect(result.dateValues[isoYear(2021)]).toBe(8);
    expect(result.dateValues[isoYear(2022)]).toBe(12);
  });

  test("evaluate combines scalar, data series and external with overlap", async () => {
    const recipe = new Recipe({
      name: "Mixed",
      equation: "${ds} + ${ext} + ${k}",
      variables: [
        {
          id: "ds",
          name: "Data series",
          type: RecipeDataTypes.DataSeries,
          pick: VectorIndexPickerOptions.Whole,
          dataSeriesId: dataSeriesIds.mix,
          value: undefined,
          unit: "kg",
        },
        externalVariable({
          id: "ext",
          name: "External",
          dataset: "SCB",
          tableId: "table-mix",
          selection: [{ variableCode: "Region", valueCodes: ["00"] }],
          unit: "kg",
        }),
        scalarVariable("k", "Scalar", 1, "kg"),
      ],
    });

    const { result } = await evaluateWithWarnings(recipe, {
      dataSeriesGetter: makeDataSeriesGetter({
        [dataSeriesIds.mix]: {
          unit: "kg",
          values: {
            [isoYear(2019)]: 100,
            [isoYear(2020)]: 5,
            [isoYear(2021)]: 8,
            [isoYear(2022)]: 13,
            [isoYear(2023)]: 21,
          },
        },
      }),
      externalTableContentGetter: makeExternalTableContentGetter({
        "table-mix": {
          id: "table-mix",
          values: [
            { period: "2020", value: "20" },
            { period: "2021", value: "30" },
            { period: "2022", value: "40" },
          ],
          metadata: [{ label: "stub", source: "stub" }],
        },
      }),
    });

    if (!result) {
      throw new Error("Expected a non-null evaluation result");
    }

    expect(result.unit).toBe("kg");
    expect(result.dateValues[isoYear(2020)]).toBe(26);
    expect(result.dateValues[isoYear(2021)]).toBe(39);
  });

  test("evaluate fails when custom getter cannot find linked data series", async () => {
    const recipe = new Recipe({
      name: "Missing linked",
      equation: "${missing}",
      variables: [{
        id: "missing",
        name: "Missing",
        type: RecipeDataTypes.DataSeries,
        pick: VectorIndexPickerOptions.Whole,
        dataSeriesId: dataSeriesIds.missing,
        value: undefined,
        unit: null,
      }],
    });

    const warnings: string[] = [];
    await expect(recipe.evaluate(warnings, {
      dataSeriesGetter: makeDataSeriesGetter({}),
    })).rejects.toThrow("Failed to fetch data series");
    if (warnings.length > 0) {
      console.warn("Recipe.evaluate warnings:", warnings);
    }
  });

  test("evaluate fails when custom external getter returns no data", async () => {
    const recipe = new Recipe({
      name: "Missing external",
      equation: "${ext}",
      variables: [
        externalVariable({
          id: "ext",
          name: "External",
          dataset: "SCB",
          tableId: "missing-table",
          selection: [{ variableCode: "Region", valueCodes: ["00"] }],
          unit: undefined,
        }),
      ],
    });

    const warnings: string[] = [];
    await expect(recipe.evaluate(warnings, {
      externalTableContentGetter: makeExternalTableContentGetter({}),
    })).rejects.toThrow("has no data");
    if (warnings.length > 0) {
      console.warn("Recipe.evaluate warnings:", warnings);
    }
  });

  test("isVariableEqual ignores template field", () => {
    const base = scalarVariable("same", "Same", 1, "kg");
    const withTemplate = { ...base, template: true };
    const withoutTemplate = { ...base };

    expect(Recipe.isVariableEqual(withTemplate, withoutTemplate)).toBe(true);
  });

  test("isVariablesEqual respects order", () => {
    const vars1 = [scalarVariable("a", "A", 1), scalarVariable("b", "B", 2)];
    const vars2 = [scalarVariable("b", "B", 2), scalarVariable("a", "A", 1)];

    expect(Recipe.areVariablesEqual(vars1, vars2)).toBe(false);
  });
});

test.describe("Recipe extractors", () => {
  test("extractScalars creates units and warns on invalid unit", () => {
    const warnings: string[] = [];
    const scalars = extractScalars([
      scalarVariable("ok", "OK", 3, "kg"),
      scalarVariable("bad", "Bad", 2, "not-a-unit"),
    ], warnings);

    expect(scalars).toHaveLength(2);
    expect(scalars[0].value.toString()).toContain("kg");
    expect(scalars[1].value.toString()).toContain("2");
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("invalid unit");
  });

  test("extractDataSeries supports inline timeline with whole pick", async () => {
    const output = await extractDataSeries([
      inlineDataSeriesVariable({
        id: "ds",
        name: "Inline",
        unit: "kg",
        pick: VectorIndexPickerOptions.Whole,
        values: {
          [isoYear(2020)]: 1,
          [isoYear(2021)]: 3,
        },
      }),
    ], [], makeDataSeriesGetter({}));

    expect(output).toHaveLength(1);
    expect("series" in output[0]).toBe(true);
    if ("series" in output[0]) {
      expect(Object.values(output[0].series.dateValues)).toContain(3);
      expect(output[0].series.unit).toBe("kg");
    }
  });

  test("extractDataSeries supports scalar pick by year", async () => {
    const output = await extractDataSeries([
      inlineDataSeriesVariable({
        id: "ds",
        name: "Inline",
        pick: 2021,
        values: {
          [isoYear(2020)]: 4,
          [isoYear(2021)]: 6,
        },
      }),
    ], [], makeDataSeriesGetter({}));

    expect(output).toHaveLength(1);
    expect("value" in output[0]).toBe(true);
    if ("value" in output[0] && !Array.isArray(output[0].value)) {
      expect(unitValueToNumber(output[0].value)).toBe(6);
    }
  });

  test("extractDataSeries throws when no source is provided", async () => {
    await expect(extractDataSeries([
      {
        id: "broken",
        name: "Broken",
        type: RecipeDataTypes.DataSeries,
        pick: VectorIndexPickerOptions.Whole,
        dataSeriesId: undefined,
        value: undefined,
        unit: undefined,
      },
    ], [], makeDataSeriesGetter({}))).rejects.toThrow(RecipeError);
  });

  test("extractDataSeries supports linked id with custom getter", async () => {
    const output = await extractDataSeries([
      {
        id: "linked",
        name: "Linked",
        type: RecipeDataTypes.DataSeries,
        pick: VectorIndexPickerOptions.Whole,
        dataSeriesId: dataSeriesIds.linked,
        value: undefined,
        unit: "kg",
      },
    ], [], makeDataSeriesGetter({
      [dataSeriesIds.linked]: {
        unit: "kg",
        values: {
          [isoYear(2020)]: 10,
          [isoYear(2021)]: 20,
        },
      },
    }));

    expect(output).toHaveLength(1);
    expect("series" in output[0]).toBe(true);
    if ("series" in output[0]) {
      expect(output[0].series.dateValues[isoYear(2020)]).toBe(10);
      expect(output[0].series.unit).toBe("kg");
    }
  });

  test("extractExternalDatasets fails fast for missing required props", async () => {
    await expect(extractExternalDatasets([
      {
        id: "ext",
        name: "External",
        type: RecipeDataTypes.External,
        dataset: null,
        tableId: null,
        selection: [],
        pick: VectorIndexPickerOptions.Whole,
        unit: undefined,
      },
    ])).rejects.toThrow(RecipeError);
  });

  test("extractExternalDatasets supports custom override and scalar pick", async () => {
    const output = await extractExternalDatasets([
      externalVariable({
        id: "ext-year",
        name: "External year",
        dataset: "SCB",
        tableId: "table-year",
        selection: [{ variableCode: "Region", valueCodes: ["00"] }],
        pick: 2021,
        unit: "kg",
      }),
    ], [], makeExternalTableContentGetter({
      "table-year": {
        id: "table-year",
        values: [
          { period: "2020", value: "1" },
          { period: "2021", value: "5" },
          { period: "2022", value: "9" },
        ],
        metadata: [{ label: "stub", source: "stub" }],
      },
    }));

    expect(output).toHaveLength(1);
    expect("value" in output[0]).toBe(true);
    if ("value" in output[0] && !Array.isArray(output[0].value)) {
      expect(unitValueToNumber(output[0].value)).toBe(5);
    }
  });

  test("extractExternalDatasets default getter path is still used when no override is passed", async () => {
    await expect(extractExternalDatasets([
      externalVariable({
        id: "ext-default",
        name: "External default",
        dataset: "UnknownDataset" as never,
        tableId: "table-default",
        selection: [{ variableCode: "Region", valueCodes: ["00"] }],
        unit: undefined,
      }),
    ])).rejects.toThrow("has no data");
  });
});

test.describe("Vector and mask utilities", () => {
  const dateValues: DateValuesWithUnit = {
    unit: "kg",
    dateValues: {
      [isoYear(2020)]: 2,
      [isoYear(2021)]: 4,
      [isoYear(2022)]: 8,
      [isoYear(2023)]: 16,
    },
  };

  test("pickDateValues supports first/last/mean/median/year/date/reverse", () => {
    expect(unitValueToNumber(pickDateValues(dateValues, VectorIndexPickerOptions.First))).toBe(2);
    expect(unitValueToNumber(pickDateValues(dateValues, VectorIndexPickerOptions.Last))).toBe(16);
    expect(unitValueToNumber(pickDateValues(dateValues, VectorIndexPickerOptions.Mean))).toBe(7.5);
    expect(unitValueToNumber(pickDateValues(dateValues, VectorIndexPickerOptions.Median))).toBe(6);
    expect(unitValueToNumber(pickDateValues(dateValues, 2022))).toBe(8);
    expect(unitValueToNumber(pickDateValues(dateValues, isoYear(2023)))).toBe(16);

    const reversed = pickDateValues(dateValues, VectorIndexPickerOptions.Reverse);
    if (reversed instanceof mathjs.Unit) {
      throw new Error("Expected reverse pick to return a timeline");
    }
    expect(Object.keys(reversed.dateValues)[0]).toBe(isoYear(2023));
  });

  test("pickDateValues throws for invalid numeric pick", () => {
    expect(() => pickDateValues(dateValues, 2020.5)).toThrow("Invalid pick value");
  });

  test("transformDateValuesToVector sets mask for missing years", () => {
    const transformed = transformDateValuesToVector({
      unit: "kg",
      dateValues: {
        [isoYear(2020)]: 1,
        [isoYear(2022)]: 3,
      },
    }, new Date("2020-01-01T00:00:00Z"), 4);

    expect(transformed.vector).toHaveLength(4);
    expect(transformed.vector[1].toNumber()).toBe(0);
    expect(transformed.mask[isoYear(2020)]).toBe(false);
    expect(transformed.mask[isoYear(2021)]).toBe(true);
    expect(transformed.mask[isoYear(2022)]).toBe(false);
  });

  test("parseDateValuesFromVector throws on vector/mask length mismatch", () => {
    expect(() => parseDateValuesFromVector({
      vector: [mathjs.unit(1, "kg")],
      mask: {
        [isoYear(2020)]: false,
        [isoYear(2021)]: false,
      },
    })).toThrow("Vector length does not match mask length");
  });

  test("parseDateValuesFromVector returns undefined unit when units differ", () => {
    const parsed = parseDateValuesFromVector({
      vector: [
        mathjs.unit(1, "kg"),
        mathjs.unit(2, "g"),
      ],
      mask: {
        [isoYear(2020)]: false,
        [isoYear(2021)]: false,
      },
    });

    expect(parsed.unit).toBeUndefined();
    expect(parsed.dateValues[isoYear(2020)]).toBe(1);
    expect(parsed.dateValues[isoYear(2021)]).toBe(2);
  });

  test("ANDMasks merges with logical OR semantics over true-mask flags", () => {
    const combined = ANDMasks([
      {
        [isoYear(2020)]: false,
        [isoYear(2021)]: true,
      },
      {
        [isoYear(2020)]: true,
        [isoYear(2021)]: false,
      },
    ]);

    expect(combined[isoYear(2020)]).toBe(true);
    expect(combined[isoYear(2021)]).toBe(true);
  });

  test("unit helpers: getPrevailingUnit and isMathjsUnit", () => {
    expect(getPrevailingUnit("kg", undefined)).toBe("kg");
    expect(getPrevailingUnit("kg", "g")).toBe("g");
    expect(getPrevailingUnit("kg", null)).toBeNull();

    expect(isMathjsUnit("kg")).toBe(true);
    expect(isMathjsUnit("not-a-unit")).toBe(false);
    expect(isMathjsUnit(undefined)).toBe(false);
  });

  test("dataSeriesToDateValues maps db-like records", () => {
    const ds = {
      id: "id",
      unit: "kg",
      values: [
        { timestamp: new Date("2020-01-01T00:00:00Z"), value: 1 },
        { timestamp: new Date("2021-01-01T00:00:00Z"), value: 2 },
      ],
    };

    const mapped = dataSeriesToDateValues(ds as never);
    expect(mapped.unit).toBe("kg");
    expect(mapped.dateValues[isoYear(2020)]).toBe(1);
    expect(mapped.dateValues[isoYear(2021)]).toBe(2);
  });

  test("dateValuesToDBDateRecord converts timestamps and validates keys", () => {
    const converted = dateValuesToDBDateRecord({
      [isoYear(2020)]: 5,
      [isoYear(2021)]: 9,
    }, "ds-1");

    expect(converted).toHaveLength(2);
    expect(converted[0].dataSeriesId).toBe("ds-1");
    expect(converted[0].timestamp).toBeInstanceOf(Date);

    expect(() => dateValuesToDBDateRecord({
      "not-an-iso": 1,
    } as unknown as DateValues)).toThrow("Invalid ISOIshDate key");
  });
});

test.describe("Sanity checks", () => {
  test("sanityCheckScalars warns for risky scalar values", () => {
    const warnings: string[] = [];

    sanityCheckScalars([
      { id: "huge", displayName: "Huge", value: 1e13 },
      { id: "near", displayName: "NearZero", value: 1e-13 },
      { id: "neg", displayName: "Negative", value: -1 },
      { id: "zero", displayName: "Zero", value: 0 },
    ], warnings);

    expect(warnings.join(" ")).toContain("huge scalar values");
    expect(warnings.join(" ")).toContain("close to zero");
    expect(warnings.join(" ")).toContain("negative scalar values");
    expect(warnings.join(" ")).toContain("scalar values that are zero");
  });

  test("sanityCheckDataSeries warns for scalar and series anomalies", () => {
    const warnings: string[] = [];

    const longSeries = Object.fromEntries(
      Array.from({ length: 60 }, (_, i) => [isoYear(2000 + i), i]),
    ) satisfies DateValues;

    sanityCheckDataSeries([
      { id: "s1", displayName: "HugeScalar", value: 1e14 },
      {
        id: "ds-long",
        displayName: "LongSeries",
        series: { dateValues: longSeries, unit: undefined },
      },
      {
        id: "ds-short",
        displayName: "ShortSeries",
        series: { dateValues: { [isoYear(2020)]: 1 }, unit: undefined },
      },
      {
        id: "ds-huge",
        displayName: "HugeSeriesValues",
        series: { dateValues: { [isoYear(2020)]: 1e13, [isoYear(2021)]: 2 }, unit: undefined },
      },
    ], warnings);

    const warningText = warnings.join(" ");
    expect(warningText).toContain("Data series extraction contains huge scalar values");
    expect(warningText).toContain("very long data series");
    expect(warningText).toContain("very short data series");
    expect(warningText).toContain("data series with huge values");
  });

  test("sanityCheckExternalDatasets warns for anomalies", () => {
    const warnings: string[] = [];
    const extLongDateValues = Object.fromEntries(
      Array.from({ length: 51 }, (_, i) => [isoYear(2000 + i), i]),
    ) satisfies DateValues;

    sanityCheckExternalDatasets([
      { id: "s1", displayName: "ExternalZero", value: 0 },
      {
        id: "ext-long",
        displayName: "ExternalLong",
        series: {
          dateValues: extLongDateValues,
          unit: undefined,
        },
      },
    ], warnings);

    const warningText = warnings.join(" ");
    expect(warningText).toContain("External dataset extraction contains scalar values that are zero");
    expect(warningText).toContain("very long data series");
  });
});
