import { DatasetKeys, ExternalDataset } from "@/lib/api/utility";
import { isStandardObject, JSONValue, typeguardDebug, uuidRegex } from "@/types";

export const VectorIndexPickerOptions = {
  Default: "whole",

  Whole: "whole",
  Last: "last",
  First: "first",
  Median: "median",
  Mean: "mean",
} as const;
export type VectorIndexPickerOptions = typeof VectorIndexPickerOptions[keyof typeof VectorIndexPickerOptions];

export const vectorIndexPickerFunctions = {
  [VectorIndexPickerOptions.Whole]: (vector: number[]) => vector,
  [VectorIndexPickerOptions.Last]: (vector: number[]) => vector.at(-1),
  [VectorIndexPickerOptions.First]: (vector: number[]) => vector.at(0),
  [VectorIndexPickerOptions.Median]: (vector: number[]) => {
    if (vector.length === 0) return null;
    const sorted = [...vector].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  },
  [VectorIndexPickerOptions.Mean]: (vector: number[]) => {
    if (vector.length === 0) return null;
    const sum = vector.reduce((acc, val) => acc + val, 0);
    return sum / vector.length;
  },
} as const;

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
export function isRecipeScalar(variable: JSONValue): variable is RecipeScalar {
  const allowedProps = ["type", "value", "unit"];

  return (
    (
      variable instanceof Object &&
      !Array.isArray(variable) &&
      variable != null ||
      typeguardDebug("Type guard: scalar variable should be an object") && false
    ) &&

    (
      variable.type === RecipeDataTypes.Scalar
      // No log since we tend to call isRecipeScalar(...) || isRecipeDataSeries(...) || isRecipeExternalDataset(...) in a chain, which will trigger up to two false positives
      // typeguardDebug("Type guard: 'type' in scalar variable") && false
    ) &&

    (
      typeof variable.value === "number" ||
      typeguardDebug("Type guard: 'value' in scalar variable") && false
    ) &&

    (
      typeof variable.unit === "string" ||
      variable.unit == null || // May be null or undefined
      typeguardDebug("Type guard: 'unit' in scalar variable") && false
    ) &&

    // Ensure no other properties are present
    (
      Object.keys(variable).filter(key => !allowedProps.includes(key)).length === 0 ||
      typeguardDebug("Type guard: unknown properties in scalar variable") && false
    )
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
export function isRecipeDataSeries(variable: JSONValue): variable is RecipeDataSeries {
  const allowedProps = ["type", "link", "pick", "unit"];

  return (
    (
      variable instanceof Object &&
      !Array.isArray(variable) &&
      variable != null ||
      typeguardDebug("Type guard: data series variable should be an object") && false
    ) &&

    (
      variable.type === RecipeDataTypes.DataSeries
      // No log since we tend to call isRecipeScalar(...) || isRecipeDataSeries(...) || isRecipeExternalDataset(...) in a chain, which will trigger up to two false positives
      // typeguardDebug("Type guard: 'type' in data series variable") && false
    ) &&

    (
      (typeof variable.link === "string" && uuidRegex.test(variable.link)) ||
      variable.link == null || // May be undefined
      typeguardDebug("Type guard: 'link' in data series variable") && false
    ) &&

    (
      typeof variable.pick === "string" &&
      vectorIndexPickerFunctions[variable.pick as VectorIndexPickerOptions] !== undefined ||
      typeguardDebug("Type guard: 'pick' in data series variable") && false
    ) &&

    (
      typeof variable.unit === "string" ||
      variable.unit == null || // May be null or undefined
      typeguardDebug("Type guard: 'unit' in data series variable") && false
    ) &&

    (
      Object.keys(variable).filter(key => !allowedProps.includes(key)).length === 0 ||
      typeguardDebug("Type guard: unknown properties in data series variable") && false
    )
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
export function isRecipeExternalDataset(variable: JSONValue): variable is RecipeExternalDataset {
  const allowedProps = ["type", "dataset", "tableId", "selection", "pick", "unit"];

  return (
    (
      variable instanceof Object &&
      !Array.isArray(variable) &&
      variable != null ||
      typeguardDebug("Type guard: external dataset variable should be an object") && false
    ) &&

    (
      variable.type === RecipeDataTypes.External
      // No log since we tend to call isRecipeScalar(...) || isRecipeDataSeries(...) || isRecipeExternalDataset(...) in a chain, which will trigger up to two false positives
      // typeguardDebug("Type guard: 'type' in external dataset variable") && false
    ) &&

    (
      typeof variable.dataset === "string" &&
      ExternalDataset.knownDatasetKeys.includes(variable.dataset as DatasetKeys) ||
      variable.dataset == null || // May be null if not specified
      typeguardDebug("Type guard: 'dataset' in external dataset variable") && false
    ) &&

    (
      typeof variable.tableId === "string" &&
      variable.tableId.trim() !== "" ||  // Ensure tableId is a non-empty string
      variable.tableId == null || // May be null if not specified
      typeguardDebug("Type guard: 'tableId' in external dataset variable") && false
    ) &&

    (
      isRecipeExternalDatasetSelection(variable.selection ?? null) ||
      typeguardDebug("Type guard: 'selection' in external dataset variable") && false
    ) &&

    (
      typeof variable.pick === "string" &&
      vectorIndexPickerFunctions[variable.pick as VectorIndexPickerOptions] !== undefined ||
      typeguardDebug("Type guard: 'pick' in external dataset variable") && false
    ) &&

    (
      typeof variable.unit === "string" ||
      variable.unit == null || // May be null or undefined
      typeguardDebug("Type guard: 'unit' in external dataset variable") && false
    ) &&

    // Ensure no other properties are present
    (
      Object.keys(variable).filter(key => !allowedProps.includes(key)).length === 0 ||
      typeguardDebug("Type guard: unknown properties in external dataset variable") && false
    )
  );
}
export function isRecipeExternalDatasetSelection(selection: JSONValue): selection is RecipeExternalDataset["selection"] {
  return (
    Array.isArray(selection) &&
    selection.every(item => (
      (
        item instanceof Object &&
        !Array.isArray(item) &&
        item != null ||
        typeguardDebug("Type guard: selection items should be objects") && false
      ) &&

      (
        "variableCode" in item &&
        typeof item.variableCode === "string" &&
        item.variableCode.trim() !== "" ||
        typeguardDebug("Type guard: 'variableCode' in selection item") && false
      ) &&

      (
        "valueCodes" in item &&
        Array.isArray(item.valueCodes) &&
        item.valueCodes.every(code => typeof code === "string" && code.trim() !== "") ||
        typeguardDebug("Type guard: 'valueCodes' in selection item") && false
      )
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
export function isRecipe(recipe: JSONValue): recipe is Recipe {
  const allowedProps = ["name", "eq", "variables"];

  return (
    (
      recipe instanceof Object &&
      !Array.isArray(recipe) &&
      recipe != null ||
      typeguardDebug("Type guard: recipe should be an object") && false
    ) &&

    (
      typeof recipe.name === "string" ||
      recipe.name == null ||
      typeguardDebug("Type guard: 'name' in recipe") && false
    ) &&

    (
      typeof recipe.eq === "string" &&
      recipe.eq.trim() !== "" || // Ensure eq is a non-empty string
      typeguardDebug("Type guard: 'eq' in recipe") && false
    ) &&

    (
      isStandardObject(recipe.variables) &&
      Object.entries(recipe.variables).every(([key, value]) => (
        typeof key === "string" &&
        key.trim() !== "" &&
        (
          isRecipeScalar(value ?? null) ||
          isRecipeDataSeries(value ?? null) ||
          isRecipeExternalDataset(value ?? null)
        )
      )) ||
      typeguardDebug("Type guard: 'variables' in recipe") && false
    ) &&

    // Ensure no other properties are present
    (
      Object.keys(recipe).filter(key => !allowedProps.includes(key)).length === 0 ||
      typeguardDebug("Type guard: unknown properties in recipe") && false
    )
  );
}
export const emptyRecipe: Recipe = { name: undefined, eq: "", variables: {} } as const;


/** 
 * Defined here to usage before declaration.
 */
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