import type { DataSeries, DateValues, DateValuesWithUnit, Goal, ISOIshDate, Unit } from "@/types";
import { UnitFlags } from "@/types/enums";
import { isISOIshDate } from "@/types/typeguards";
import { isUnitFlag, parseUnit } from "@/functions/unit";
import { VectorIndexPickerOptions } from "@/functions/recipe/types/enums";
import { RecipeError } from "@/functions/recipe/types/errors";
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
    return isUnitFlag(dataSeries.unit)
      ? mathjs.unit(valueAtPickedYear)
      : mathjs.unit(valueAtPickedYear, dataSeries.unit);
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
    return isUnitFlag(dataSeries.unit)
      ? mathjs.unit(valueAtPickedDate)
      : mathjs.unit(valueAtPickedDate, dataSeries.unit);
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
    return isUnitFlag(dataSeries.unit)
      ? mathjs.unit(firstValue)
      : mathjs.unit(firstValue, dataSeries.unit);
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
    return isUnitFlag(dataSeries.unit)
      ? mathjs.unit(lastValue)
      : mathjs.unit(lastValue, dataSeries.unit);
  }
  // Mean
  else if (pick === VectorIndexPickerOptions.Mean) {
    const values = Object.values(dataSeries.dateValues);
    const sum = values.reduce((acc, val) => acc + val, 0);
    const mean = sum / values.length;
    return isUnitFlag(dataSeries.unit)
      ? mathjs.unit(mean)
      : mathjs.unit(mean, dataSeries.unit);
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
    return isUnitFlag(dataSeries.unit)
      ? mathjs.unit(median)
      : mathjs.unit(median, dataSeries.unit);
  }

  throw new RecipeError(`pickDateValues: Unknown VectorIndexPickerOption '${(pick as string | number).toString()}'.`);
}

/** The ISO date the evaluator keys a year's value by. */
export function isoYearDate(year: number): ISOIshDate {
  const isoYearString = new Date(`${year}-01-01T00:00:00Z`).toISOString();
  if (!isISOIshDate(isoYearString)) {
    throw new RecipeError(`VectorConvert: Generated invalid ISO date string '${isoYearString}'.`);
  }
  return isoYearString;
}

/**
 * The series as a vector with one entry per year of `axis`. Years the series
 * has no value for are NaN: arithmetic carries a NaN along, so a year that any
 * elementwise operand lacks is left out of the result (see
 * `parseDateValuesFromVector`), while functions over the whole series
 * (`firstNonZero`, `trend`) skip them and may fill them in.
 */
export function transformDateValuesToVector(
  dateValues: DateValuesWithUnit,
  axis: number[],
): MathJSUnit[] {
  const { dateValues: timeline, unit } = dateValues;
  return axis.map(year => {
    const value = timeline[isoYearDate(year)] ?? NaN;
    return isUnitFlag(unit) ? mathjs.unit(value) : mathjs.unit(value, unit);
  });
}

/**
 * Reads a result vector back into date values, one entry per year of `axis`;
 * NaN entries are years without a value.
 */
export function parseDateValuesFromVector(
  vector: MathJSUnit[],
  axis: number[],
): DateValuesWithUnit {
  if (vector.length !== axis.length) {
    throw new RecipeError("VectorConvert: Vector length does not match the year axis.");
  }

  const timeline: DateValues = {};
  for (let i = 0; i < vector.length; i++) {
    const value = vector[i].toNumber();
    if (Number.isNaN(value)) continue;
    timeline[isoYearDate(axis[i])] = value;
  }

  // If all values agree on one unit, that's the resulting unit; an empty
  // formatUnits means the result is genuinely unitless.
  const units = [...new Set(vector.map(v => cancelMatchingUnits(v).formatUnits()))];
  if (units.length === 1) {
    return {
      unit: units[0].trim() === "" ? UnitFlags.Unitless : parseUnit(units[0]),
      dateValues: timeline,
    };
  }
  else {
    console.warn(`VectorConvert: Inconsistent units in result vector: ${units.join(", ")}. Marking the unit as missing.`);
    return {
      unit: UnitFlags.Missing,
      dateValues: timeline,
    };
  }
}

/**
 * Drops unit factors that cancel each other, e.g. `kWh antal / antal` becomes
 * `kWh` and `t CO2e person / capita` becomes `t CO2e`. mathjs only does that in
 * `simplify()`, which also rewrites anything it can into base units
 * (`GWh/year` → `W`), so this cancels solely factors of the same dimension that
 * are worth the same (aliases and identical prefixes); `kWh/Wh` or `km/m` stay.
 */
export function cancelMatchingUnits(unit: MathJSUnit): MathJSUnit {
  const factorKey = (factor: MathJSUnit["units"][number]) => {
    // The typings say `prefix` is a string, but at runtime it is the prefix object ({ name, value })
    const prefix = factor.prefix as unknown as { name: string, value: number };
    return `${factor.unit.base.key}|${prefix.value * factor.unit.value}`;
  };
  const netPowers = new Map<string, number>();
  for (const factor of unit.units) {
    netPowers.set(factorKey(factor), (netPowers.get(factorKey(factor)) ?? 0) + factor.power);
  }
  if (![...netPowers.values()].some(power => power === 0)) return unit;

  // The value is stored in base units, so removing factors that net to nothing
  // changes only how the unit is written, not what it is worth.
  const cancelled = unit.clone();
  cancelled.units = unit.units.filter(factor => netPowers.get(factorKey(factor)) !== 0);
  return cancelled;
}

export function getPrevailingUnit(existingUnit: Unit, newUnit: Unit): Unit {
  // A real unit or an explicit "unitless" takes precedence; only a missing
  // newUnit falls back to the existing one.
  return newUnit === UnitFlags.Missing ? existingUnit : newUnit;
}

export function isMathjsUnit(unit: Unit): boolean {
  if (isUnitFlag(unit)) return false;
  try {
    mathjs.unit(1, unit);
    return true;
  }
  catch {
    return false;
  }
}

export function dataSeriesToDateValues(dataSeries: DataSeries | Goal["data_series"]): DateValuesWithUnit {
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
    unit: parseUnit(dataSeries.unit), // The db keeps the legacy convention; parse at this boundary
  };
}

export function dateValuesToDBDateRecord(dateValues: DateValues, dataSeriesId?: string) {
  const dateRecord: {
    timestamp: Date;
    value: number;
    data_series_id?: string;
  }[] = [];

  for (const [key, val] of Object.entries(dateValues)) {
    if (!isISOIshDate(key)) {
      throw new RecipeError(`dateValuesToDBDateRecord: Invalid ISOIshDate key '${key}' in dateValues.`);
    }
    dateRecord.push({
      ...(dataSeriesId ? { data_series_id: dataSeriesId } : {}),
      timestamp: new Date(key),
      value: val,
    });
  }

  return dateRecord;
}