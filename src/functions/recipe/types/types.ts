import type { Unit } from "mathjs";
import type { DatasetKeys } from "@/lib/api/utility";
import type { DateValues, DateValuesWithUnit, JSONValue, UnitString } from "@/types";
import type { RecipeDataTypes, VectorIndexPickerOptions } from "@/functions/recipe/types/consts";

export type RecipeScalar = {
  type: typeof RecipeDataTypes.Scalar;
  value: number;
  unit: UnitString;
};
export type RecipeDataSeries = {
  type: typeof RecipeDataTypes.DataSeries;
  link: string | null | undefined;
  value?: DateValues | null | undefined;
  pick: VectorIndexPickerOptions | number;
  unit: UnitString;

  goalName?: string;
  disabled?: boolean;
};
export type RecipeExternalDataset = {
  type: typeof RecipeDataTypes.External;
  dataset: DatasetKeys | null;
  tableId: string | null;
  selection: {
    variableCode: string,
    valueCodes: string[]
  }[];
  pick: VectorIndexPickerOptions | number;
  unit: UnitString;
};
export type RecipeVariable = RecipeScalar | RecipeDataSeries | RecipeExternalDataset;

/*
 * Variable during evaluation of a recipe. Should not persist beyond that scope.
 */
export type EvalTimeVariable = {
  name: string;
  value: Unit | Unit[] | number;
};

export type RecipeExtractionOutput = (
  EvalTimeVariable
  | { series: DateValuesWithUnit, name: string, }
)[];

/** 
 * # Notice
 * Do not use to type variables, only use for type checking when serializing/deserializing recipes
 */
export type SerializedRecipeShape = {
  name: string | null | undefined;
  equation: string;
  variables: Record<string, RecipeVariable>;
  meta: {
    [key: string]: JSONValue;
  };
};
export type SerializedRecipe = string;
