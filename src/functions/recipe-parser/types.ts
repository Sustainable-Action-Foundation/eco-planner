import { externalDatasets } from "@/lib/api/utility";
import { isStandardObject, uuidRegex } from "@/types";

export enum RecipeVariableType {
  Scalar = "scalar",
  DataSeries = "dataSeries",
  External = "external",
};

export type DataSeriesArray = Partial<{
  "val2020": number | null;
  "val2021": number | null;
  "val2022": number | null;
  "val2023": number | null;
  "val2024": number | null;
  "val2025": number | null;
  "val2026": number | null;
  "val2027": number | null;
  "val2028": number | null;
  "val2029": number | null;
  "val2030": number | null;
  "val2031": number | null;
  "val2032": number | null;
  "val2033": number | null;
  "val2034": number | null;
  "val2035": number | null;
  "val2036": number | null;
  "val2037": number | null;
  "val2038": number | null;
  "val2039": number | null;
  "val2040": number | null;
  "val2041": number | null;
  "val2042": number | null;
  "val2043": number | null;
  "val2044": number | null;
  "val2045": number | null;
  "val2046": number | null;
  "val2047": number | null;
  "val2048": number | null;
  "val2049": number | null;
  "val2050": number | null;
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
};

export type RawDataSeriesByLink = {
  type: RecipeVariableType.DataSeries;
  link: string; // uuid of data series in the database
};
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
};
export function isRawDataSeriesByLink(variable: unknown): variable is RawDataSeriesByLink {
  return (
    lenientIsRawDataSeriesByLink(variable) &&
    // Ensure no other properties are present
    Object.keys(variable).filter(key => !["link", "type"].includes(key)).length === 0
  );
};

export type RawDataSeriesByValue = {
  type: RecipeVariableType.DataSeries;
  value: DataSeriesArray;
  unit?: string;
};
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
      Number.isFinite(parseInt(key.replace("val", ""))) &&
      (typeof val === "number" || val === null)
    )) &&
    ( // unit is optional, but if it exists, it must be a string
      !("unit" in variable) ||
      typeof variable.unit === "string"
    ) &&
    // Ensure no other properties are present
    Object.keys(variable).filter(key => !["type", "value", "unit"].includes(key)).length === 0
  );
};

/** A data series might be defined in the inheritance form or it might be imported and it might have a unit */
export type RecipeVariableRawDataSeries = RawDataSeriesByLink | RawDataSeriesByValue;
export type RecipeVariableDataSeries = {
  type: RecipeVariableType.DataSeries;
  link: string; // uuid of data series in the database
};

export type ExternalDataset = {
  type: RecipeVariableType.External;
  dataset: string; // One of the datasets specified in externalDatasets
  tableId: string; // The ID of the table in the dataset
  selection: {
    variableCode: string,
    valueCodes: string[]
  }[]; // The selection to be made on the table, e.g. [{ variableCode: "Tid", valueCodes: ["2020M01"] }]
};

export function isExternalDatasetVariable(variable: unknown): variable is ExternalDataset {
  return (
    isStandardObject(variable) &&
    "type" in variable &&
    variable.type === RecipeVariableType.External &&
    "dataset" in variable &&
    typeof variable.dataset === "string" &&
    Object.keys(externalDatasets).includes(variable.dataset) && // Ensure the dataset is one of the known datasets
    "tableId" in variable &&
    typeof variable.tableId === "string" &&
    "selection" in variable &&
    Array.isArray(variable.selection) &&
    variable.selection.every(item => (
      isStandardObject(item) &&
      "variableCode" in item &&
      typeof item.variableCode === "string" &&
      "valueCodes" in item &&
      Array.isArray(item.valueCodes) &&
      item.valueCodes.every(code => typeof code === "string")
    )) &&
    // Ensure no other properties are present
    Object.keys(variable).filter(key => !["type", "dataset", "tableId", "selection"].includes(key)).length === 0
  );
};

export type RecipeVariables = RecipeVariableScalar | RecipeVariableDataSeries | ExternalDataset;
export type Recipe = {
  name?: string;
  eq: string;
  variables: Record<string, RecipeVariables>;
};

export type RawRecipeVariables = RecipeVariableScalar | RecipeVariableRawDataSeries | ExternalDataset;
/** Considered unsafe as it is. Comes from the client */
export type RawRecipe = {
  name?: string;
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
};

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