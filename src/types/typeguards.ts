import type { DateValues, DateValuesWithUnit, ISOIshDate, JSONValue, UnitString } from "./types";

/**
 * A utility function for helping with finding where something fails in a typeguard chain.
 * Meant to be used at the end of a chain of logical AND or OR operations, which would usually short-circuit, but call this function on failure.
 * 
 * Example:  
 *   `ShouldBeTruthy1 && ShouldBeTruthy2 || typeguardDebug("Failed AND check");`
 * 
 * or:  
 *   `ShouldBeTruthy1 || ShouldBeTruthy2 || typeguardDebug("Failed OR check");`
 * 
 * @returns `false`, so it can be used after an OR in logical operations without affecting the result.
 */
export function typeguardDebug(message: string): false {
  console.debug(message);
  return false;
}

export function isStandardObject(object: unknown): object is object {
  return typeof object === "object" && object != null && !Array.isArray(object);
}

export function isDateValues(dateValues: JSONValue): dateValues is DateValues {
  return (
    isStandardObject(dateValues)
    && Object.values(dateValues).every(value => typeof value === 'number')
    && Object.keys(dateValues).every(key => isISOIshDate(key))
  );
}

export function isUnitString(unit: JSONValue | undefined): unit is UnitString {
  return typeof unit === 'string' || unit === null || unit === undefined;
}

/** This is not compliant with ISO-8601, it's a vary narrow format that's a subset of that standard */
export function isISOIshDate(dateString: string): dateString is ISOIshDate {
  return /^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/.test(dateString);
}

export function isDateValuesWithUnit(dateValues: JSONValue): dateValues is Partial<DateValuesWithUnit> {
  return (
    isStandardObject(dateValues)
    && 'dateValues' in dateValues
    && typeof dateValues.dateValues === 'object'
    && !Array.isArray(dateValues)
    && isDateValues(dateValues.dateValues)
    && isUnitString(dateValues.unit)
  );
}