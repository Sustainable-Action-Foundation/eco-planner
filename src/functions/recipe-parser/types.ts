import { VectorIndexPickerType as VectorIndexPick } from "@/components/recipe/variables";
import { DatasetKeys, ExternalDataset } from "@/lib/api/utility";
import { isStandardObject, uuidRegex } from "@/types";

/* 
 * Common types for recipes
 */
export const RecipeDataTypes = {
  Scalar: "scalar",
  DataSeries: "dataSeries",
  External: "external",
} as const;
export type RecipeDataTypes = typeof RecipeDataTypes[keyof typeof RecipeDataTypes];


/** 
 * Scalar variable types
 */
export type RecipeScalar = {
  type: typeof RecipeDataTypes.Scalar;
  value: number;
  unit: string | null | undefined; // String if given, null if removed, undefined if not specified
};
export function isRecipeScalar(variable: unknown): variable is RecipeScalar {
  const allowedProps = ["type", "value", "unit"];

  return (
    isStandardObject(variable)
    &&

    "type" in variable &&
    variable.type === RecipeDataTypes.Scalar
    &&

    "value" in variable &&
    typeof variable.value === "number"
    &&

    "unit" in variable &&
    (
      typeof variable.unit === "string" ||
      variable.unit === null ||
      variable.unit === undefined
    )
    &&

    // Ensure no other properties are present
    Object.keys(variable).filter(key => !allowedProps.includes(key)).length === 0
  );
}


/* 
 * Data series types
 */
export type RecipeDataSeries = {
  type: typeof RecipeDataTypes.DataSeries;
  link: string | null | undefined; // uuid of data series in the database
  pick: VectorIndexPick;
  unit: string | null | undefined; // String if given, null if removed, undefined if not specified
};
export function isRecipeDataSeries(variable: unknown): variable is RecipeDataSeries {
  const allowedProps = ["type", "link", "pick"];
  return (
    isStandardObject(variable)
    &&

    "type" in variable &&
    variable.type === RecipeDataTypes.DataSeries
    &&

    "link" in variable &&
    (
      (typeof variable.link === "string" && uuidRegex.test(variable.link)) ||
      variable.link === null
    )
    &&

    "pick" in variable &&
    (typeof variable.pick === "string" && VectorIndexPick[variable.pick as keyof typeof VectorIndexPick] !== undefined)
    &&

    Object.keys(variable).filter(key => !allowedProps.includes(key)).length === 0
  );
}


/* 
 * External datasets types
 */
export type RecipeExternalDataset = {
  type: typeof RecipeDataTypes.External;
  /** Datasets are defined in [`src/lib/api/utility.ts`](../../lib/api/utility.ts) */
  dataset: DatasetKeys; // One of the datasets specified in externalDatasets
  tableId: string; // The ID of the table in the dataset
  selection: {
    variableCode: string,
    valueCodes: string[]
  }[]; // The selection to be made on the table, e.g. [{ variableCode: "Tid", valueCodes: ["2020M01"] }]
  pick: VectorIndexPick;
  unit: string | null | undefined; // String if given, null if removed, undefined if not specified
};
export function isRecipeExternalDataset(variable: unknown): variable is RecipeExternalDataset {
  const allowedProps = ["type", "dataset", "tableId", "selection"];

  return (
    isStandardObject(variable)
    &&

    "type" in variable &&
    variable.type === RecipeDataTypes.External
    &&

    "dataset" in variable &&
    typeof variable.dataset === "string" &&
    ExternalDataset.knownDatasetKeys.includes(variable.dataset as DatasetKeys)
    &&

    "tableId" in variable &&
    typeof variable.tableId === "string" &&
    variable.tableId.trim() !== ""  // Ensure tableId is a non-empty string
    &&

    "selection" in variable &&
    Array.isArray(variable.selection) &&
    variable.selection.every(item => (
      isStandardObject(item)
      &&

      "variableCode" in item &&
      typeof item.variableCode === "string" &&
      item.variableCode.trim() !== ""
      &&

      "valueCodes" in item &&
      Array.isArray(item.valueCodes) &&
      item.valueCodes.every(code => typeof code === "string" && code.trim() !== "")
    ))
    &&

    "pick" in variable &&
    (typeof variable.pick === "string" && VectorIndexPick[variable.pick as keyof typeof VectorIndexPick] !== undefined)
    &&

    "unit" in variable &&
    (
      typeof variable.unit === "string" ||
      variable.unit === null ||
      variable.unit === undefined
    )
    &&

    // Ensure no other properties are present
    Object.keys(variable).filter(key => !allowedProps.includes(key)).length === 0
  );
}


/* 
 * Main recipe types
 */
export type RecipeVariables = RecipeScalar | RecipeDataSeries | RecipeExternalDataset;
export type Recipe = {
  name: string | null | undefined; // String if given, null if removed, undefined if not specified
  eq: string;
  variables: Record<string, RecipeVariables>;
};
export function isRecipe(variable: unknown): variable is Recipe {
  const allowedProps = ["name", "eq", "variables"];

  return (
    isStandardObject(variable)
    &&

    "name" in variable &&
    (typeof variable.name === "string" || variable.name === null || variable.name === undefined)
    &&

    "eq" in variable &&
    typeof variable.eq === "string" &&
    variable.eq.trim() !== "" // Ensure eq is a non-empty string
    &&

    "variables" in variable &&
    isStandardObject(variable.variables) &&
    Object.entries(variable.variables).every(([key, value]) => (
      typeof key === "string" &&
      key.trim() !== "" &&
      (
        isRecipeScalar(value) ||
        isRecipeDataSeries(value) ||
        isRecipeExternalDataset(value)
      )
    ))
    &&

    // Ensure no other properties are present
    Object.keys(variable).filter(key => !allowedProps.includes(key)).length === 0
  );
}


/*
 * Variable during evaluation of a recipe. Should not persist beyond that scope.
 */
export type EvalTimeScalar = {
  name: string; // Variable name
  value: number; // The actual value to be used
  unit: string | null | undefined; // Optional unit
};
export type EvalTimeDataSeries = {
  name: string; // Variable name
  link: string; // For reference sake
  vector: number[] | null;
  unit: string | null | undefined; // Optional unit
};
export type EvalTimeExternalDataset = {
  name: string; // Variable name
  scalar: number | null;
  vector: number[] | null;
  unit: string | null | undefined; // Optional unit
};


/*
 * Errors
 */
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