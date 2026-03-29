import type { Unit } from "mathjs";
import type { DatasetKeys } from "@/lib/api/utility";
import type { DateValues, DateValuesWithUnit, JSONValue, UnitString } from "@/types";
import type { RecipeDataTypes, VectorIndexPickerOptions } from "@/functions/recipe/types/consts";

type BaseVariable = {
  name?: string | undefined;
  type: RecipeDataTypes;
  unit: UnitString;
  template?: boolean | undefined;
};

export type ScalarVariable = BaseVariable & {
  type: typeof RecipeDataTypes.Scalar;
  value: number;
};
export type DataSeriesVariable = BaseVariable & {
  type: typeof RecipeDataTypes.DataSeries;
  pick: VectorIndexPickerOptions | number;

  link: string | null | undefined;
  value: DateValues | null | undefined;

  goalName?: string;
  disabled?: boolean;
};
export type ExternalVariable = BaseVariable & {
  type: typeof RecipeDataTypes.External;
  pick: VectorIndexPickerOptions | number;

  // API stuff
  dataset: DatasetKeys | null;
  tableId: string | null;
  selection: {
    variableCode: string,
    valueCodes: string[]
  }[];
};
export type RecipeVariable = ScalarVariable | DataSeriesVariable | ExternalVariable;

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
