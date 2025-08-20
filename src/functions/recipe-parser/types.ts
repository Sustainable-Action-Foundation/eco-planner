import { vectorIndexPickerFunctions, VectorIndexPickerOptions } from "@/components/recipe/variables";
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
export function isRecipeDataType(variable: unknown): variable is RecipeDataTypes {
  return (
    typeof variable === "string" &&
    (
      variable === RecipeDataTypes.Scalar ||
      variable === RecipeDataTypes.DataSeries ||
      variable === RecipeDataTypes.External
    )
  );
}


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

    (
      ("unit" in variable && typeof variable.unit === "string") ||
      ("unit" in variable && variable.unit === null) ||
      !("unit" in variable) // May be undefined
    )
    &&

    // Ensure no other properties are present
    Object.keys(variable).filter(key => !allowedProps.includes(key)).length === 0
  );
}
export const emptyRecipeScalar: RecipeScalar = { type: RecipeDataTypes.Scalar, value: 0, unit: undefined } as const;


/* 
 * Data series types
 */
export type RecipeDataSeries = {
  type: typeof RecipeDataTypes.DataSeries;
  link: string | null | undefined; // uuid of data series in the database
  pick: VectorIndexPickerOptions;
  unit: string | null | undefined; // String if given, null if removed, undefined if not specified
};
export function isRecipeDataSeries(variable: unknown): variable is RecipeDataSeries {
  const allowedProps = ["type", "link", "pick", "unit"];

  return (
    isStandardObject(variable)
    &&

    "type" in variable &&
    variable.type === RecipeDataTypes.DataSeries
    &&

    // TODO: Make more of these debug logs in type guards
    ((
      ("link" in variable && typeof variable.link === "string" && uuidRegex.test(variable.link)) ||
      ("link" in variable && variable.link == null) ||
      !("link" in variable) // May be undefined
    ) || (() => { console.debug("Type guard: 'link' in data series variable"); return false; })())
    &&

    "pick" in variable &&
    (typeof variable.pick === "string" && vectorIndexPickerFunctions[variable.pick as VectorIndexPickerOptions] !== undefined)
    &&

    (
      ("unit" in variable && typeof variable.unit === "string") ||
      ("unit" in variable && variable.unit == null) ||
      !("unit" in variable) // May be undefined
    )
    &&

    Object.keys(variable).filter(key => !allowedProps.includes(key)).length === 0
  )
}
export const emptyRecipeDataSeries: RecipeDataSeries = { type: RecipeDataTypes.DataSeries, link: undefined, pick: "first", unit: undefined } as const;


/* 
 * External datasets types
 */
export type RecipeExternalDataset = {
  type: typeof RecipeDataTypes.External;
  /** Datasets are defined in [`src/lib/api/utility.ts`](../../lib/api/utility.ts) */
  dataset: DatasetKeys | null; // One of the datasets specified in externalDatasets
  tableId: string | null; // The ID of the table in the dataset
  selection: {
    variableCode: string,
    valueCodes: string[]
  }[]; // The selection to be made on the table, e.g. [{ variableCode: "Tid", valueCodes: ["2020M01"] }]
  pick: VectorIndexPickerOptions;
  unit: string | null | undefined; // String if given, null if removed, undefined if not specified
};
export function isRecipeExternalDataset(variable: unknown): variable is RecipeExternalDataset {
  const allowedProps = ["type", "dataset", "tableId", "selection", "pick", "unit"];

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
    isRecipeExternalDatasetSelection(variable.selection)
    &&

    "pick" in variable &&
    (typeof variable.pick === "string" && vectorIndexPickerFunctions[variable.pick as VectorIndexPickerOptions] !== undefined)
    &&

    (
      ("unit" in variable && typeof variable.unit === "string") ||
      ("unit" in variable && variable.unit == null) ||
      !("unit" in variable) // May be undefined
    )
    &&

    // Ensure no other properties are present
    Object.keys(variable).filter(key => !allowedProps.includes(key)).length === 0
  );
}
export function isRecipeExternalDatasetSelection(selection: unknown): selection is RecipeExternalDataset["selection"] {
  return (
    Array.isArray(selection) &&
    selection.every(item => (
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
  );
}
export const emptyRecipeExternalDataset: RecipeExternalDataset = { type: RecipeDataTypes.External, dataset: null, tableId: null, selection: [], pick: VectorIndexPickerOptions.Default, unit: undefined } as const;


/* 
 * Main recipe types
 */
export type RecipeVariables = RecipeScalar | RecipeDataSeries | RecipeExternalDataset;
export type Recipe = {
  name: string | null | undefined; // String if given, null if removed, undefined if not specified
  eq: string;
  variables: Record<string, RecipeVariables>;
};
export function isRecipe(recipe: unknown): recipe is Recipe {
  const allowedProps = ["name", "eq", "variables"];

  return (
    isStandardObject(recipe)
    &&

    "name" in recipe &&
    (typeof recipe.name === "string" || recipe.name === null || recipe.name === undefined)
    &&

    "eq" in recipe &&
    typeof recipe.eq === "string" &&
    recipe.eq.trim() !== "" // Ensure eq is a non-empty string
    &&

    "variables" in recipe &&
    isStandardObject(recipe.variables) &&
    Object.entries(recipe.variables).every(([key, value]) => (
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
    Object.keys(recipe).filter(key => !allowedProps.includes(key)).length === 0
  );
}
export const emptyRecipe: Recipe = { name: undefined, eq: "", variables: {} } as const;

// Here to be declared last
export const emptyRecipeDataTypes: Record<RecipeDataTypes, RecipeScalar | RecipeDataSeries | RecipeExternalDataset> = {
  "scalar": emptyRecipeScalar,
  "dataSeries": emptyRecipeDataSeries,
  "external": emptyRecipeExternalDataset,
} as const;

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
  value: number | number[] | null;
  unit: string | null | undefined; // Optional unit
};
export type EvalTimeExternalDataset = {
  name: string; // Variable name
  value: number | number[] | null;
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