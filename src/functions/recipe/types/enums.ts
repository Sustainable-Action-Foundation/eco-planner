/*
 * Enum-ish consts for recipes. Values are kebab-case since they end up in the DOM.
 */
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

export const RecipeDataTypes = {
  Scalar: "scalar",
  DataSeries: "data-series",
  External: "external",
} as const;
export type RecipeDataTypes = typeof RecipeDataTypes[keyof typeof RecipeDataTypes];
