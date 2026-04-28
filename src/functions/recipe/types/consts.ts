import type { DataSeriesVariable, ExternalVariable, ScalarVariable, RecipeVariable } from "./types";

export const VectorIndexPickerOptions = {
  Default: "whole",

  Whole: "whole",
  Reverse: "reverse",

  Last: "last",
  First: "first",
  Median: "median",
  Mean: "mean",
} as const;
export type VectorIndexPickerOptions = typeof VectorIndexPickerOptions[keyof typeof VectorIndexPickerOptions];

/*
 * Common types for recipes
 */
export const RecipeDataTypes = {
  Scalar: "scalar",
  DataSeries: "dataSeries",
  External: "external",
} as const;
export type RecipeDataTypes = typeof RecipeDataTypes[keyof typeof RecipeDataTypes];

export const emptyRecipeScalar: ScalarVariable = {
  id: "empty-scalar",
  name: "empty-scalar",
  type: RecipeDataTypes.Scalar,
  value: 0,
  unit: undefined,
} as const;
export const emptyRecipeDataSeries: DataSeriesVariable = {
  id: "empty-data-series",
  name: "empty-data-series",
  type: RecipeDataTypes.DataSeries,
  dataSeriesId: undefined,
  pick: VectorIndexPickerOptions.Default,
  unit: undefined,
  value: undefined,
} as const;
export const emptyRecipeExternal: ExternalVariable = {
  id: "empty-external",
  name: "empty-external",
  type: RecipeDataTypes.External,
  dataset: null,
  tableId: null,
  selection: [],
  pick: VectorIndexPickerOptions.Default,
  unit: undefined,
} as const;

/**
 * Defined here to usage before declaration.
 */
export const emptyRecipesByDataType: Record<RecipeDataTypes, RecipeVariable> = {
  scalar: emptyRecipeScalar,
  dataSeries: emptyRecipeDataSeries,
  external: emptyRecipeExternal,
} as const;
