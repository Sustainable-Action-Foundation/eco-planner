import clientSafeGetOneDataSeries from "@/fetchers/clientSafeGetOneDataSeries";
import { emptyRecipe, isRecipeDataSeries, isRecipeExternalDataset, isRecipeExternalDatasetSelection, isRecipeScalar, RecipeDataTypes, RecipeError, RecipeVariable, VectorIndexPickerOptions } from "@/functions/recipe/types";
import getTableContent from "@/lib/api/getTableContent";
import mathjs from "@/math";
import { DateValues, DateValuesWithUnit } from "@/types";
import { Unit } from "mathjs";
import { EvalTimeVariable } from "./types";
import { filterToInitialYearlyRecords, parsePeriod } from "@/lib/api/utility";

const intermediateNullValue = -Infinity; // Mathjs does not like undefined or NaN values so this is the intermediate representation

export function extractScalars(
  variables: Record<string, RecipeVariable>,
  warnings: string[] = [],
): EvalTimeVariable[] {
  const scalars: EvalTimeVariable[] = [];

  for (const variableName in variables) {
    const variable = variables[variableName];
    if (variable.type !== RecipeDataTypes.Scalar) continue;
    if (!isRecipeScalar(variable)) continue;

    const bestUnit = getPrevailingUnit(undefined, variable.unit);
    const isValidUnit = testIfValidUnit(bestUnit);
    if (bestUnit && !isValidUnit) warnings.push(`Scalar variable "${variableName}" has an invalid unit "${bestUnit}". Treating as unitless.`);
    const unit = isValidUnit ? bestUnit : undefined;

    scalars.push({
      name: variableName,
      value: unit
        ? mathjs.unit(variable.value, unit)
        : mathjs.unit(variable.value),
    });
  }

  return scalars;
}

export async function extractDataSeries(
  variables: Record<string, RecipeVariable>,
  warnings: string[] = []
): Promise<EvalTimeVariable[]> {
  const dataSeries: EvalTimeVariable[] = [];

  for (const variableName in variables) {
    const variable = variables[variableName];
    if (variable.type !== RecipeDataTypes.DataSeries) continue;
    if (!isRecipeDataSeries(variable)) continue;

    let dbDataSeries: Awaited<ReturnType<typeof clientSafeGetOneDataSeries>>;
    if (variable.link) {
      dbDataSeries = await clientSafeGetOneDataSeries(variable.link)
        .catch((e: Error) => {
          throw new RecipeError(`VariableExtractor: Error fetching data series for variable "${variableName}" with link "${variable.link}": ${e.message}`);
        });
    }
    else if (variable.value || Array.isArray(variable.value)) {
      // TODO: maybe remove this "exception" or at least make the id more robust
      const inlineId = "inline-" + Math.random().toString(36).substring(2, 15); // TODO: better unique id
      dbDataSeries = {
        id: inlineId,
        unit: variable.unit ?? null,
        values: Object.entries(variable.value).map(([key, val]) => ({
          dataSeriesId: inlineId,
          timestamp: new Date(key), // TODO, fix very naive parsing
          value: val,
        })),
      };
    }
    else {
      throw new RecipeError(`VariableExtractor: Variable "${variableName}" is not referencing a goal or data series.`);
    }

    if (!dbDataSeries) {
      throw new RecipeError(`VariableExtractor: Failed to fetch data series for variable "${variableName}" with link "${variable.link}".`);
    }

    const bestUnit = getPrevailingUnit(dbDataSeries.unit, variable.unit);
    const isValidUnit = testIfValidUnit(bestUnit);
    if (bestUnit && !isValidUnit) warnings.push(`Data series variable "${variableName}" has an invalid unit "${bestUnit}". Treating as unitless.`);
    const unit = isValidUnit ? bestUnit : undefined;

    const dateValues: DateValues = Object.fromEntries(
      dbDataSeries.values.map(v => ([
        v.timestamp.toISOString(),
        v.value,
      ]))
    );

    const vectorOrScalarForm = pickDataSeries(dateValues, variable.pick);
    dataSeries.push({
      name: variableName,
      value: Array.isArray(vectorOrScalarForm) ?
        vectorOrScalarForm.map(v => unit
          ? mathjs.unit(v, unit)
          : mathjs.unit(v))
        : unit
          ? mathjs.unit(vectorOrScalarForm, unit)
          : mathjs.unit(vectorOrScalarForm),
    });
  }

  return dataSeries;
}
const warnings: string[] = [];
console.dir(
  {
    result: await extractDataSeries({
      "varname": {
        type: RecipeDataTypes.DataSeries,
        link: undefined,
        value: {
          "2021-01-01T00:00:00.000Z": 20,
          "2024-01-01T00:00:00.000Z": 30,
          "2026-01-01T00:00:00.000Z": 50,
          "2022-01-01T00:00:00.000Z": 22,
        },
        pick: VectorIndexPickerOptions.Default,
        unit: null,
      }
    }, warnings),
    warnings,
  },
  { depth: null }
);

export async function extractExternalDatasets(
  variables: Record<string, RecipeVariable>,
  warnings: string[] = [],
): Promise<EvalTimeVariable[]> {
  throw new RecipeError("extractExternalDatasets: Not implemented.");
  return [];

  // const externalDatasets: EvalTimeVariable[] = [];

  // const fetchers: Array<() => Promise<void>> = [];

  // for (const variableName in variables) {
  //   const variable = variables[variableName];
  //   if (variable.type !== RecipeDataTypes.External) continue;
  //   if (!isRecipeExternalDataset(variable)) {
  //     throw new RecipeError(`Variable '${variableName}', typed as '${(variable as { type: string }).type} ' is not a valid RecipeExternalDataset.`);
  //   }

  //   const { dataset, tableId, selection } = variable;

  //   if (!dataset || !tableId || !isRecipeExternalDatasetSelection(selection)) { // These props may all be null
  //     throw new RecipeError(`External dataset variable '${variableName}' is missing 'dataset', 'tableId' and/or 'selection' properties.`);
  //   }

  //   fetchers.push(async () => {
  //     const data = await getTableContent(tableId, dataset, selection);

  //     if (!data) {
  //       throw new RecipeError(`External dataset variable '${variableName}' has no data for tableId '${tableId}' and dataset '${dataset}' and selection '${JSON.stringify(selection)}'.`);
  //     }
  //     if (data.values.length === 0) {
  //       throw new RecipeError(`External dataset variable '${variableName}' has no values. Expected an array of values with 'period' and 'value' properties.`);
  //     }

  //     const definedValues: DateValues = {};
  //     // This is done like this to avoid evil Regex
  //     const validCharsForYear = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
  //     for (const year of Years) {
  //       const found = filterToInitialYearlyRecords(data.values)
  //         .find(v => {
  //           // Assuming year strings are like "val2020" but just in case, only keep numbers
  //           const strippedYear = year.split("")
  //             .filter(c => validCharsForYear.includes(c))
  //             .join("");

  //           const parsedDate = parsePeriod(v.period);
  //           return parsedDate.getUTCFullYear().toString() === strippedYear;
  //         });
  //       if (found) {
  //         definedValues[year] = parseFloat(found.value);
  //       }
  //     }

  //     // TODO: how should units be derived here? I can't find anything in the API response that indicates units.
  //     const bestUnit = getPrevailingUnit(undefined, variable.unit);
  //     const isValidUnit = testIfValidUnit(bestUnit);
  //     if (bestUnit && !isValidUnit) warnings.push(`Data series variable "${variableName}" has an invalid unit "${bestUnit}". Treating as unitless.`);
  //     const unit = isValidUnit ? bestUnit : undefined;

  //     const vectorOrScalarForm = pickDataSeries(
  //       definedValues,
  //       variable.pick
  //     );
  //     // pickVector(convertYearValuePairToVector(definedValues), variable.pick);
  //     externalDatasets.push({
  //       name: variableName,
  //       value: Array.isArray(vectorOrScalarForm) ?
  //         vectorOrScalarForm.map(v => unit
  //           ? mathjs.unit(v, unit)
  //           : mathjs.unit(v))
  //         : unit
  //           ? mathjs.unit(vectorOrScalarForm, unit)
  //           : mathjs.unit(vectorOrScalarForm),
  //     });
  //   });
  // }

  // await Promise.all(fetchers.map(fetcher => fetcher()));

  // return externalDatasets;
}

/** Wrapper for the conversion function in order to intercept YYYY pick values */
function pickDataSeries(
  dataSeries: DateValues,
  pick: VectorIndexPickerOptions | number
): number | number[] {
  if (
    typeof pick === "number"
    && Number.isFinite(pick)
    && Number.isInteger(pick)
  ) {
    const isoYearString = new Date(`${pick}-01-01T00:00:00Z`).toISOString(); // TODO: better parsing
    const value = dataSeries[isoYearString];
    if (typeof value !== "number") {
      throw new RecipeError(`PickDataSeries: Data series does not contain a valid number for year ${pick}.`);
    }
    return value;
  }

  if (typeof pick === "number") {
    throw new RecipeError(`PickDataSeries: Invalid pick value '${pick}'. Expected a VectorIndexPickerOptions or an integer year.`);
  }

  return pickVector(transformDateValuesToVector(dataSeries, new Date("2020-01-01T00:00:00Z"), "years"), pick);
}

function transformDateValuesToVector(
  dataSeries: DateValues,
  commonStartDate: Date
): {
  vector: number[];
  mask: Record<string, boolean>;
} {
  const definedDates = Object.keys(dataSeries).sort().map(d => new Date(d));
  const lastDefinedDate = definedDates.reverse()[0];

  if (!lastDefinedDate) {
    throw new RecipeError("VectorConvert: Data series contains no defined dates.");
  }

  // Now the start, end, and increments are known, construct all the keys
  const yearDiff = lastDefinedDate.getUTCFullYear() - commonStartDate.getUTCFullYear();
  const years: string[] = new Array(yearDiff + 1).fill(null).map((_, i) => {
    const copyOfStart = new Date(commonStartDate.toISOString());
    copyOfStart.setUTCFullYear(commonStartDate.getUTCFullYear() + i);
    return copyOfStart.toISOString();
  });

  const vector: number[] = [];
  const mask: Record<string, boolean> = {};

  // Map to vector with special handling for missing and null values
  for (const year of years) {
    if (typeof dataSeries[year] === "number" && isFinite(dataSeries[year])) {
      mask[year] = false;
      vector.push(dataSeries[year])
    }
    else {
      mask[year] = true;
      vector.push(intermediateNullValue);
    }
  }

  return { vector, mask, };
}

/** 
 * Example of input -> parsed output
 * 
 * | i  | Value | Mask   | Date (defined value)  |
 * |----|-------|--------|-----------------------|
 * |  0 |     0 |  true  |  2021 (first in mask) |
 * |  1 |     0 |  true  |  2022                 |
 * |  2 |     0 |  false |  2023: 0              |
 * |  3 |     0 |  false |  2024: 0              |
 * |  4 |     1 |  false |  2025: 1              |
 * |  5 |     2 |  false |  2026: 2              |
 * |  6 |     0 |  true  |  2027                 |
 * |  7 |     3 |  false |  2028: 3              |
 * |  8 |     4 |  false |  2029: 4              |
 * |  9 |     5 |  false |  2030: 5              |
 * | 10 |     0 |  true  |  2031                 |
 * | 11 |     0 |  true  |  2032                 |
 * | 12 |     0 |  true  |  2033                 |
 * | 13 |     6 |  false |  2034: 6              |
 * | 14 |     0 |  true  |  2035                 |
 * | 15 |     0 |  true  |  2036                 |
 * | 16 |     0 |  true  |  2037                 |
 * | 17 |     0 |  true  |  2038                 |
 * | 18 |     0 |  true  |  2039                 |
 * 
 * 
 */
export function parseDateValuesFromVector(
  vector: Unit[],
  mask: Record<string, boolean>,
): DateValuesWithUnit {
  if (vector.length !== Object.keys(mask).length) {
    throw new RecipeError("VectorConvert: Vector length does not match mask length.");
  }

  const timeline: DateValues = {};

  const keys = Object.keys(mask).sort();
  for (let i = 0; i < vector.length; i++) {
    const dateKey = keys[i];
    if (mask[dateKey]) continue; // Skip masked, non defined, values
    timeline[dateKey] = vector[i].toNumber();
  }

  // If all units are the same, return that unit, else undefined
  const units = [...new Set(vector.map(v => v.formatUnits()))];
  if (units.length === 1) {
    return {
      unit: units[0],
      values: timeline,
    };
  }
  else {
    console.warn(`VectorConvert: Inconsistent units in result vector: ${units.join(", ")}. Setting unit to undefined.`);
    return {
      unit: undefined,
      values: timeline,
    };
  }
}

function getPrevailingUnit(existingUnit: string | null | undefined, newUnit: string | null | undefined): string | null | undefined {
  // If newUnit is explicitly provided (non-undefined) and non-empty, it takes precedence.
  if (typeof newUnit !== "undefined" && newUnit?.trim() !== "") {
    return newUnit;
  }
  // If newUnit is explicitly null (meaning "unitless"), return null.
  if (typeof newUnit !== "undefined" && newUnit === null) {
    return null;
  }
  // Otherwise, keep the existing unit
  return existingUnit;
}

function pickVector(vector: number[], pick: VectorIndexPickerOptions): number | number[] {
  switch (pick) {
    case VectorIndexPickerOptions.Whole:
      return vector;

    case VectorIndexPickerOptions.First:
      const first = vector.at(0);
      if (first === undefined) {
        throw new RecipeError("VectorPicking: Vector is empty, cannot pick the first element.");
      }
      return first;

    case VectorIndexPickerOptions.Last:
      const last = vector.at(-1);
      if (last === undefined) {
        throw new RecipeError("VectorPicking: Vector is empty, cannot pick the last element.");
      }
      return last;

    case VectorIndexPickerOptions.Mean:
      const sum = vector.reduce((acc, val) => acc + val, 0);
      return sum / vector.length;

    case VectorIndexPickerOptions.Median:
      const sorted = [...vector].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      if (sorted.length % 2 === 0) {
        return (sorted[mid - 1] + sorted[mid]) / 2;
      }
      else {
        return sorted[mid];
      }

    default:
      throw new RecipeError(`pickVector: Unknown VectorIndexPickerOption '${(pick as string | number).toString()}'.`);
  }
}

export function testIfValidUnit(unit: string | null | undefined): boolean {
  if (!unit) return false;
  try {
    mathjs.unit(1, unit);
    return true;
  }
  catch {
    return false;
  }
}