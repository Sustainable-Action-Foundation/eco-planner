import { SmartRecipe } from "@/functions/recipe/recipe";
import type { RecipeDataSeries, RecipeExternalDataset, RecipeScalar, RecipeVariable } from "./types";

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

export const emptyRecipeScalar: RecipeScalar = { type: RecipeDataTypes.Scalar, value: 0, unit: undefined } as const;
export const emptyRecipeDataSeries: RecipeDataSeries = { type: RecipeDataTypes.DataSeries, link: undefined, pick: VectorIndexPickerOptions.Default, unit: undefined } as const;
export const emptyRecipeExternalDataset: RecipeExternalDataset = { type: RecipeDataTypes.External, dataset: null, tableId: null, selection: [], pick: VectorIndexPickerOptions.Default, unit: undefined } as const;

export const emptyRecipe: SmartRecipe = SmartRecipe.getEmpty();

/**
 * Defined here to usage before declaration.
 */
export const emptyRecipesByDataType: Record<RecipeDataTypes, RecipeVariable> = {
  scalar: emptyRecipeScalar,
  dataSeries: emptyRecipeDataSeries,
  external: emptyRecipeExternalDataset,
} as const;
