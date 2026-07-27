import type { DataSeries, DateValues, DateValuesWithUnit, Goal, ISOIshDate, Mask, MaskedVector, UnitString } from "@/types";
import { isISOIshDate } from "@/types/typeguards";
import { RecipeError, VectorIndexPickerOptions } from "@/functions/recipe/types";
import type { Unit as MathJSUnit } from "mathjs";
import mathjs from "@/math";

export function pickDateValues(
  dataSeries: DateValuesWithUnit,
  pick: VectorIndexPickerOptions | number | ISOIshDate,
): DateValuesWithUnit | MathJSUnit {
  // Try to interpret as year YYYY
  if (
    typeof pick === "number"
    && Number.isFinite(pick)
    && Number.isInteger(pick)
  ) {
    const yearString = typeof pick === "number" ? pick.toString() : pick;
    const isoYearString = new Date(`${yearString}-01-01T00:00:00Z`).toISOString();
    if (!isISOIshDate(isoYearString)) {
      throw new RecipeError(`PickDataSeries: Invalid year pick value '${pick as string | number}'.`);
    }
    const valueAtPickedYear = dataSeries.dateValues[isoYearString];
    if (typeof valueAtPickedYear !== "number") {
      throw new RecipeError(`PickDataSeries: Data series does not contain a valid number for year ${yearString}.`);
    }
    return dataSeries.unit
      ? mathjs.unit(valueAtPickedYear, dataSeries.unit)
      : mathjs.unit(valueAtPickedYear);
  }
  // Try to interpret as ISOIshDate
  else if (
    typeof pick === "string"
    && isISOIshDate(pick)
  ) {
    const valueAtPickedDate = dataSeries.dateValues[pick];
    if (typeof valueAtPickedDate !== "number") {
      throw new RecipeError(`PickDataSeries: Data series does not contain a valid number for date ${pick}.`);
    }
    return dataSeries.unit
      ? mathjs.unit(valueAtPickedDate, dataSeries.unit)
      : mathjs.unit(valueAtPickedDate);
  }
  // Else, must be VectorIndexPickerOptions 

  if (typeof pick === "number") {
    throw new RecipeError(`PickDataSeries: Invalid pick value '${pick}'. Expected a VectorIndexPickerOptions, an integer year, or an ISOIshDate.`);
  }

  /* 
   * Pick options 
   */
  // Whole
  if (pick === VectorIndexPickerOptions.Whole) {
    return dataSeries;
  }
  // Reverse
  else if (pick === VectorIndexPickerOptions.Reverse) {
    const entries = Object.entries(dataSeries.dateValues).reverse();
    const reversedDateValues: DateValues = Object.fromEntries(entries);
    return {
      dateValues: reversedDateValues,
      unit: dataSeries.unit,
    };
  }
  // First
  else if (pick === VectorIndexPickerOptions.First) {
    const firstKey = Object.keys(dataSeries.dateValues).at(0);
    if (!firstKey) {
      throw new RecipeError("VectorPicking: DateValues is empty, cannot pick the first element.");
    }
    if (!isISOIshDate(firstKey)) {
      throw new RecipeError("VectorPicking: DateValues contains invalid ISOIshDate keys.");
    }
    const firstValue = dataSeries.dateValues[firstKey];
    return dataSeries.unit
      ? mathjs.unit(firstValue, dataSeries.unit)
      : mathjs.unit(firstValue);
  }
  // Last
  else if (pick === VectorIndexPickerOptions.Last) {
    const keys = Object.keys(dataSeries.dateValues);
    const lastKey = keys.at(-1);
    if (!lastKey) {
      throw new RecipeError("VectorPicking: DateValues is empty, cannot pick the last element.");
    }
    if (!isISOIshDate(lastKey)) {
      throw new RecipeError("VectorPicking: DateValues contains invalid ISOIshDate keys.");
    }
    const lastValue = dataSeries.dateValues[lastKey];
    return dataSeries.unit
      ? mathjs.unit(lastValue, dataSeries.unit)
      : mathjs.unit(lastValue);
  }
  // Mean
  else if (pick === VectorIndexPickerOptions.Mean) {
    const values = Object.values(dataSeries.dateValues);
    const sum = values.reduce((acc, val) => acc + val, 0);
    const mean = sum / values.length;
    return dataSeries.unit
      ? mathjs.unit(mean, dataSeries.unit)
      : mathjs.unit(mean);
  }
  // Median
  else if (pick === VectorIndexPickerOptions.Median) {
    const values = Object.values(dataSeries.dateValues).sort((a, b) => a - b);
    const middleIndex = Math.floor(values.length / 2);
    let median: number;
    if (values.length % 2 === 0) {
      const left = values[middleIndex - 1];
      const right = values[middleIndex];
      median = (left + right) / 2;
    }
    else {
      median = values[middleIndex];
    }
    return dataSeries.unit
      ? mathjs.unit(median, dataSeries.unit)
      : mathjs.unit(median);
  }

  throw new RecipeError(`pickDateValues: Unknown VectorIndexPickerOption '${(pick as string | number).toString()}'.`);
}

export function transformDateValuesToVector(
  dateValues: DateValuesWithUnit,
  commonStartDate: Date,
  maxTimeSpan: number,
): MaskedVector {

  const { dateValues: timeline, unit } = dateValues;

  const vector: MathJSUnit[] = [];
  const mask: Record<string, boolean> = {};

  for (let i = 0; i < maxTimeSpan; i++) {
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
          : mathjs.unit(value),
      );
      mask[isoYearString] = false; // Defined value
    }
    else {
      vector.push(
        unit
          ? mathjs.unit(0, unit)
          : mathjs.unit(0),
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

export function getPrevailingUnit(existingUnit: UnitString, newUnit: UnitString): UnitString {
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

export function ANDMasks(masks: Mask[]): Mask {
  const isoDates = [...new Set(masks.flatMap(mask => Object.keys(mask)))];
  if (!isoDates.every(key => isISOIshDate(key))) {
    throw new RecipeError("MaskCombine: Masks contain invalid ISOIshDate keys.");
  }
  const combinedMask: Mask = {};
  for (const isoDate of isoDates) {
    combinedMask[isoDate] = masks.some(mask => mask[isoDate] === true);
  }
  return combinedMask;
}

export function dataSeriesToDateValues(dataSeries: DataSeries | Goal["dataSeries"]): DateValuesWithUnit {
  if (!dataSeries?.values) {
    throw new RecipeError("DataSeriesToDateValues: Goal data series is missing or does not contain values.");
  }

  const dateValues: DateValues = Object.fromEntries(
    dataSeries.values.map(v => ([
      new Date(v.timestamp).toISOString(),
      v.value,
    ])),
  );
  if (Object.keys(dateValues).some(k => !isISOIshDate(k))) {
    throw new RecipeError(`Data series contains invalid ISOIshDate keys.`);
  }
  return {
    dateValues,
    unit: dataSeries.unit ?? undefined, // TODO: unit handling
  };
}

export function dateValuesToDBDateRecord(dateValues: DateValues, dataSeriesId?: string) {
  const dateRecord: {
    timestamp: Date;
    value: number;
    dataSeriesId?: string;
  }[] = [];

  for (const [key, val] of Object.entries(dateValues)) {
    if (!isISOIshDate(key)) {
      throw new RecipeError(`dateValuesToDBDateRecord: Invalid ISOIshDate key '${key}' in dateValues.`);
    }
    dateRecord.push({
      ...(dataSeriesId ? { dataSeriesId } : {}),
      timestamp: new Date(key),
      value: val,
    });
  }

  return dateRecord;
}