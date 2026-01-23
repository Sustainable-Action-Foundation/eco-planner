import clientSafeGetOneDataSeries from "@/fetchers/clientSafeGetOneDataSeries";
import { isRecipeDataSeries, isRecipeExternalDataset, isRecipeExternalDatasetSelection, isRecipeScalar, RecipeDataSeries, RecipeDataTypes, RecipeError, RecipeExternalDataset, RecipeVariable, VectorIndexPickerOptions } from "@/functions/recipe/types";
import getTableContent from "@/lib/api/getTableContent";
import mathjs from "@/math";
import { DateValues, DateValuesWithUnit, isISOIshDate, MaskedVector, UnitString } from "@/types";
import { Unit } from "mathjs";
import { EvalTimeVariable } from "./types";
import { filterToInitialYearlyRecords, parsePeriod } from "@/lib/api/utility";

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
    const isValidUnit = isMathjsUnit(bestUnit);
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
  warnings: string[] = [],
): Promise<{ data: DateValuesWithUnit, variable: RecipeDataSeries, }[]> {

  const dataSeries: { data: DateValuesWithUnit, variable: RecipeDataSeries, }[] = [];

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
    const isValidUnit = isMathjsUnit(bestUnit);
    if (bestUnit && !isValidUnit) warnings.push(`Data series variable "${variableName}" has an invalid unit "${bestUnit}". Treating as unitless during evaluation.`);
    const unit = isValidUnit ? bestUnit : undefined;

    const dateValues: DateValues = Object.fromEntries(
      dbDataSeries.values.map(v => ([
        v.timestamp.toISOString(),
        v.value,
      ]))
    );

    if (Object.keys(dateValues).some(k => !isISOIshDate(k))) {
      throw new RecipeError(`Data series variable "${variableName}" contains invalid ISOIshDate keys.`);
    }

    dataSeries.push({
      variable,
      data: {
        dateValues,
        unit,
      },
    });
  }

  return dataSeries;
}

export async function extractExternalDatasets(
  variables: Record<string, RecipeVariable>,
  warnings: string[] = [],
): Promise<{ data: DateValuesWithUnit, variable: RecipeExternalDataset, }[]> {

  const externalDatasets: { data: DateValuesWithUnit, variable: RecipeExternalDataset, }[] = [];
  const fetchers: Array<() => Promise<void>> = [];

  for (const variableName in variables) {
    const variable = variables[variableName];
    if (variable.type !== RecipeDataTypes.External) continue;
    if (!isRecipeExternalDataset(variable)) {
      throw new RecipeError(`Variable '${variableName}', typed as '${(variable as { type: string }).type} ' is not a valid RecipeExternalDataset.`);
    }

    const { dataset, tableId, selection } = variable;

    if (!dataset || !tableId || !isRecipeExternalDatasetSelection(selection)) { // These props may all be null
      throw new RecipeError(`External dataset variable '${variableName}' is missing 'dataset', 'tableId' and/or 'selection' properties.`);
    }

    fetchers.push(async () => {
      const data = await getTableContent(tableId, dataset, selection);

      if (!data) {
        throw new RecipeError(`External dataset variable '${variableName}' has no data for tableId '${tableId}' and dataset '${dataset}' and selection '${JSON.stringify(selection)}'.`);
      }
      if (data.values.length === 0) {
        throw new RecipeError(`External dataset variable '${variableName}' has no values. Expected an array of values with 'period' and 'value' properties.`);
      }

      const timeline: DateValues = {};

      const fetchedValues = filterToInitialYearlyRecords(data.values);
      for (const valuePeriod of fetchedValues) {
        const parsedDate = parsePeriod(valuePeriod.period);
        const isoDateString = new Date(`${parsedDate.getUTCFullYear()}-01-01T00:00:00Z`).toISOString();
        if (!isISOIshDate(isoDateString)) {
          throw new RecipeError(`External dataset variable "${variableName}" contains invalid ISOIshDate keys after parsing period "${valuePeriod.period}".`);
        }
        timeline[isoDateString] = parseFloat(valuePeriod.value); // TODO: what is the preferred way to parse these values?
      }

      // TODO: how should units be derived here? I can't find anything in the API response that indicates units.
      const bestUnit = getPrevailingUnit(undefined, variable.unit);
      const isValidUnit = isMathjsUnit(bestUnit);
      if (bestUnit && !isValidUnit) warnings.push(`Data series variable "${variableName}" has an invalid unit "${bestUnit}". Treating as unitless.`);
      const unit = isValidUnit ? bestUnit : undefined;

      externalDatasets.push({
        variable,
        data: {
          dateValues: timeline,
          unit,
        },
      });
    });
  }

  await Promise.all(fetchers.map(fetcher => fetcher()));

  return externalDatasets;
}

/** Wrapper for the conversion functions in order to intercept YYYY pick values */
export function pickDataSeries(
  dataSeries: DateValuesWithUnit,
  pick: VectorIndexPickerOptions | number,
  commonStartDate: Date,
  commonLength: number,
): Unit | Unit[] | number {

  // Try to interpret as year YYYY
  if (
    typeof pick === "number"
    && Number.isFinite(pick)
    && Number.isInteger(pick)
  ) {
    const isoYearString = new Date(`${pick}-01-01T00:00:00Z`).toISOString();
    if (!isISOIshDate(isoYearString)) {
      throw new RecipeError(`PickDataSeries: Invalid year pick value '${pick}'.`);
    }
    const valueAtPickedYear = dataSeries.dateValues[isoYearString];
    if (typeof valueAtPickedYear !== "number") {
      throw new RecipeError(`PickDataSeries: Data series does not contain a valid number for year ${pick}.`);
    }
    return dataSeries.unit
      ? mathjs.unit(valueAtPickedYear, dataSeries.unit)
      : mathjs.unit(valueAtPickedYear);
  }
  // Else, must be VectorIndexPickerOptions 

  if (typeof pick === "number") {
    throw new RecipeError(`PickDataSeries: Invalid pick value '${pick}'. Expected a VectorIndexPickerOptions or an integer year.`);
  }

  const maskedVector = transformDateValuesToVector(
    dataSeries,
    commonStartDate,
    commonLength,
  );

  return pickVector(maskedVector, pick);
}

export function transformDateValuesToVector(
  dateValues: DateValuesWithUnit,
  commonStartDate: Date,
  commonLength: number,
): MaskedVector {

  const { dateValues: timeline, unit, } = dateValues;

  const vector: Unit[] = [];
  const mask: Record<string, boolean> = {};

  for (let i = 0; i < commonLength; i++) {
    const currentYear = commonStartDate.getUTCFullYear() + i;

    const isoYearString = new Date(`${currentYear}-01-01T00:00:00Z`).toISOString();
    if (!isISOIshDate(isoYearString)) {
      throw new RecipeError(`VectorConvert: Generated invalid ISO date string '${isoYearString}'.`);
    }

    if (isoYearString in timeline) {
      const value = timeline[isoYearString];
      vector.push(
        unit
          ? mathjs.unit(value, unit)
          : mathjs.unit(value)
      );
      mask[isoYearString] = false; // Defined value
    }
    else {
      vector.push(
        unit
          ? mathjs.unit(0, unit)
          : mathjs.unit(0)
      );
      mask[isoYearString] = true; // Masked, non defined value
    }
  }

  return { vector, mask };
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
  maskedVector: MaskedVector,
): DateValuesWithUnit {

  const { vector, mask } = maskedVector;

  if (vector.length !== Object.keys(mask).length) {
    throw new RecipeError("VectorConvert: Vector length does not match mask length.");
  }

  const timeline: DateValues = {};

  const keys = Object.keys(mask).sort();
  if (!keys.every(key => isISOIshDate(key))) {
    throw new RecipeError("VectorConvert: Mask contains invalid ISO date strings.");
  }

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
      dateValues: timeline,
    };
  }
  else {
    console.warn(`VectorConvert: Inconsistent units in result vector: ${units.join(", ")}. Setting unit to undefined.`);
    return {
      unit: undefined,
      dateValues: timeline,
    };
  }
}

function getPrevailingUnit(existingUnit: UnitString, newUnit: UnitString): UnitString {
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

function pickVector(
  maskedVector: MaskedVector,
  pick: VectorIndexPickerOptions,
): Unit[] | Unit | number {
  const vector = maskedVector.vector;

  // Whole
  if (pick === VectorIndexPickerOptions.Whole) {
    return vector satisfies Unit[];
  }

  // Reverse
  else if (pick === VectorIndexPickerOptions.Reverse) {
    const reversed = [...vector].reverse();
    return reversed satisfies Unit[];
  }

  // First
  else if (pick === VectorIndexPickerOptions.First) {
    const first = vector.at(0);
    if (first === undefined) {
      throw new RecipeError("VectorPicking: Vector is empty, cannot pick the first element.");
    }
    return first satisfies Unit;
  }

  // Last
  else if (pick === VectorIndexPickerOptions.Last) {
    const last = vector.at(-1);
    if (last === undefined) {
      throw new RecipeError("VectorPicking: Vector is empty, cannot pick the last element.");
    }
    return last satisfies Unit;
  }

  // Mean
  else if (pick === VectorIndexPickerOptions.Mean) {
    const sum = vector.reduce((acc, val) => acc + val.toNumber(), 0);
    const mean = sum / vector.length;
    return mean satisfies number;
  }

  // Median
  else if (pick === VectorIndexPickerOptions.Median) {
    const sorted = [...vector].sort((a, b) => a.toNumber() - b.toNumber());
    const middleIndex = Math.floor(sorted.length / 2);
    let median: number;
    if (sorted.length % 2 === 0) {
      const left = sorted[middleIndex - 1].toNumber();
      const right = sorted[middleIndex].toNumber();
      median = (left + right) / 2;
    }
    else {
      median = sorted[middleIndex].toNumber();
    }
    return median satisfies number;
  }

  else {
    throw new RecipeError(`pickVector: Unknown VectorIndexPickerOption '${(pick as string | number).toString()}'.`);
  }
}

export function isMathjsUnit(unit: UnitString): boolean {
  if (!unit) return false;
  try {
    mathjs.unit(1, unit);
    return true;
  }
  catch {
    return false;
  }
}

// TODO remove
// const warnings: string[] = [];
// const testRecipe: Record<string, RecipeVariable> = {
//   "a vari:)": {
//     type: RecipeDataTypes.DataSeries,
//     link: undefined,
//     value: {
//       "2021-01-01T00:00:00.000Z": 20,
//       "2024-01-01T00:00:00.000Z": 30,
//       "2026-01-01T00:00:00.000Z": 50,
//       "2022-01-01T00:00:00.000Z": 22,
//     },
//     pick: VectorIndexPickerOptions.Default,
//     unit: null,
//   },
//   "scalar test": {
//     type: RecipeDataTypes.Scalar,
//     value: 42,
//     unit: "kg",
//   },
//   "year pick test": {
//     type: RecipeDataTypes.DataSeries,
//     link: undefined,
//     value: {
//       "2020-01-01T00:00:00.000Z": 10,
//       "2021-01-01T00:00:00.000Z": 20,
//       "2022-01-01T00:00:00.000Z": 30,
//       "2023-01-01T00:00:00.000Z": 40,
//     },
//     pick: 2022,
//     unit: "m",
//   },
//   "another ds": {
//     type: RecipeDataTypes.DataSeries,
//     link: undefined,
//     value: {
//       "2023-01-01T00:00:00.000Z": 5,
//       "2025-01-01T00:00:00.000Z": 15,
//       "2028-01-01T00:00:00.000Z": 25,
//     },
//     pick: VectorIndexPickerOptions.Whole,
//     unit: "s",
//   },
//   "Rikets area": {
//     type: RecipeDataTypes.External,
//     pick: VectorIndexPickerOptions.Default,
//     unit: "km^2",
//     dataset: "SCB",
//     tableId: "TAB6420",
//     selection: [
//       // Selected area
//       { variableCode: "Region", valueCodes: ["00"], },
//       // Specifically land areas, not including water
//       { variableCode: "ArealTyp", valueCodes: ["01"] },
//       // Magic string to get area sizes in square kilometers (as opposed to hectares with "000007E1")
//       { variableCode: "ContentsCode", valueCodes: ["000007DY"] },
//     ],
//   },
// };
// const commonStartDate = new Date("2020-01-01T00:00:00Z");
// const commonLength = 20; // 2020-26 would be enough for this test, but the masking system should handle it :fingers_crossed:
// const extractedDataSeries = await extractDataSeries(
//   testRecipe,
//   warnings,
//   commonStartDate,
//   commonLength,
// );
// const extractedExternalDatasets = await extractExternalDatasets(
//   testRecipe,
//   warnings,
//   commonStartDate,
//   commonLength,
// );
// console.log(
//   "Extracted external datasets:", extractedExternalDatasets.map(v =>
//     typeof v.value === "number"
//       ? v.value // Not applicable
//       : Array.isArray(v.value)
//         ? v.value.map(u => u.format({ precision: 2 }))
//         : v.value.format({ precision: 2 })
//   )
// );

// console.log("Extracted data series:", extractedDataSeries.map(v =>
//   typeof v.value === "number"
//     ? v.value // Not applicable
//     : Array.isArray(v.value)
//       ? v.value.map(u => u.format({ precision: 2 }))
//       : v.value.format({ precision: 2 })
// ));
// console.log("Warnings:", warnings);
