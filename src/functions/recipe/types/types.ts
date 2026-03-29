import type { Unit } from "mathjs";
import type { DatasetKeys } from "@/lib/api/utility";
import type { DateValues, DateValuesWithUnit, UnitString } from "@/types";
import type { VectorIndexPickerOptions } from "./consts";
import type { RecipeDataTypes } from "./consts";

/**
 * Scalar variable types
*/
export type RecipeScalar = {
  type: typeof RecipeDataTypes.Scalar;
  value: number;
  unit: UnitString;
};

/*
 * Data series types
 */
export type RecipeDataSeries = {
  type: typeof RecipeDataTypes.DataSeries;
  link: string | null | undefined;
  value?: DateValues | null | undefined;
  pick: VectorIndexPickerOptions | number;
  unit: UnitString;

  goalName?: string;
  disabled?: boolean;
};

/*
 * External datasets types
 */
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
