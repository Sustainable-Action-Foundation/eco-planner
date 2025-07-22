import { isStandardObject, uuidRegex } from "@/types";

export enum RecipeVariableType {
  Scalar = "scalar",
  DataSeries = "dataSeries",
}

export type DataSeriesArray = Partial<{
  "2020": number | null;
  "2021": number | null;
  "2022": number | null;
  "2023": number | null;
  "2024": number | null;
  "2025": number | null;
  "2026": number | null;
  "2027": number | null;
  "2028": number | null;
  "2029": number | null;
  "2030": number | null;
  "2031": number | null;
  "2032": number | null;
  "2033": number | null;
  "2034": number | null;
  "2035": number | null;
  "2036": number | null;
  "2037": number | null;
  "2038": number | null;
  "2039": number | null;
  "2040": number | null;
  "2041": number | null;
  "2042": number | null;
  "2043": number | null;
  "2044": number | null;
  "2045": number | null;
  "2046": number | null;
  "2047": number | null;
  "2048": number | null;
  "2049": number | null;
  "2050": number | null;
}>;

export type RecipeVariableScalar = {
  type: RecipeVariableType.Scalar;
  value: number;
  unit?: string;
};
export function isRecipeVariableScalar(variable: unknown): variable is RecipeVariableScalar {
  return (
    isStandardObject(variable) &&
    "type" in variable &&
    variable.type === RecipeVariableType.Scalar &&
    "value" in variable &&
    typeof variable.value === "number" &&
    ( // unit is optional, but if it exists, it must be a string
      !("unit" in variable) ||
      typeof variable.unit === "string"
    ) &&
    // Ensure no other properties are present
    Object.keys(variable).filter(key => key !== "type" && key !== "value" && key !== "unit").length === 0
  );
}

export type RawDataSeriesByLink = {
  type: RecipeVariableType.DataSeries;
  link: string; // uuid of data series in the database
}
export function lenientIsRawDataSeriesByLink(variable: unknown): variable is RawDataSeriesByLink {
  return (
    isStandardObject(variable) &&
    "type" in variable &&
    variable.type === RecipeVariableType.DataSeries &&
    "link" in variable &&
    typeof variable.link === "string" &&
    // Ensure the link is a valid UUID
    uuidRegex.test(variable.link) &&
    // The properties unit and value are allowed but should be dropped, either silently or with a warning
    Object.keys(variable).filter(key => !["link", "type", "value", "unit"].includes(key)).length === 0
  );
}
export function isRawDataSeriesByLink(variable: unknown): variable is RawDataSeriesByLink {
  return (
    lenientIsRawDataSeriesByLink(variable) &&
    // Ensure no other properties are present
    Object.keys(variable).filter(key => key !== "type" && key !== "link").length === 0
  );
}

export type RawDataSeriesByValue = {
  type: RecipeVariableType.DataSeries;
  value: DataSeriesArray;
  unit?: string;
}
export function isRawDataSeriesByValue(variable: unknown): variable is RawDataSeriesByValue {
  return (
    isStandardObject(variable) &&
    "type" in variable &&
    variable.type === RecipeVariableType.DataSeries &&
    "value" in variable &&
    isStandardObject(variable.value) &&
    Object.entries(variable.value).every(([key, val]: [string, unknown]) => (
      // Each key should be a stringified year and value should be a number or null
      typeof key === "string" &&
      Number.isFinite(parseInt(key)) &&
      (typeof val === "number" || val === null)
    )) &&
    ( // unit is optional, but if it exists, it must be a string
      !("unit" in variable) ||
      typeof variable.unit === "string"
    ) &&
    // Ensure no other properties are present
    Object.keys(variable).filter(key => key !== "type" && key !== "value" && key !== "unit").length === 0
  );
}

/** A data series might be defined in the inheritance form or it might be imported and it might have a unit */
export type RecipeVariableRawDataSeries = RawDataSeriesByLink | RawDataSeriesByValue;
export type RecipeVariableDataSeries = {
  type: RecipeVariableType.DataSeries;
  link: string; // uuid of data series in the database
};

export type RecipeVariables = RecipeVariableScalar | RecipeVariableDataSeries;
export type Recipe = {
  eq: string;
  variables: Record<string, RecipeVariables>;
};

export type RawRecipeVariables = RecipeVariableScalar | RecipeVariableRawDataSeries;
/** Considered unsafe as it is. Comes from the client */
export type RawRecipe = {
  eq: string;
  variables: Record<string, RawRecipeVariables>;
};
export class RecipeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RecipeError";
  }
};
export class MathjsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MathjsError";
  }
}

export type EvalTimeScalar = {
  name: string; // Variable name
  value: number; // The actual value to be used
  unit?: string; // Optional unit
};
export type EvalTimeDataSeries = {
  name: string; // Variable name
  link: string; // For reference sake
  data: DataSeriesArray; // The actual data to be used
  unit?: string; // Optional unit
};