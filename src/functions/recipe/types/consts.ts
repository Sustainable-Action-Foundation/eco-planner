import type { DataSeriesVariable, ExternalVariable, ScalarVariable, RecipeVariable } from "./types";
import { RecipeDataTypes, VectorIndexPickerOptions } from "./enums";
import { UnitFlags } from "@/types/enums";

export const emptyRecipeScalar: ScalarVariable = {
  id: "empty-scalar",
  name: "empty-scalar",
  type: RecipeDataTypes.Scalar,
  value: 0,
  unit: UnitFlags.Missing,
} as const;
export const emptyRecipeDataSeries: DataSeriesVariable = {
  id: "empty-data-series",
  name: "empty-data-series",
  type: RecipeDataTypes.DataSeries,
  dataSeriesId: undefined,
  pick: VectorIndexPickerOptions.Default,
  unit: UnitFlags.Missing,
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
  unit: UnitFlags.Missing,
} as const;

/**
 * Defined here to usage before declaration.
 */
export const emptyRecipesByDataType: Record<RecipeDataTypes, RecipeVariable> = {
  [RecipeDataTypes.Scalar]: emptyRecipeScalar,
  [RecipeDataTypes.DataSeries]: emptyRecipeDataSeries,
  [RecipeDataTypes.External]: emptyRecipeExternal,
} as const;
