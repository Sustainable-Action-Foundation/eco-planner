import type { Unit } from "mathjs";
import type { DatasetKeys } from "@/lib/api/utility";
import type { DateValues, DateValuesWithUnit, ISOIshDate, JSONValue, UnitString } from "@/types";
import type { RecipeDataTypes, VectorIndexPickerOptions } from "@/functions/recipe/types/consts";

type BaseVariable = {
  id: string;
  name: string;
  type: RecipeDataTypes;
  unit: UnitString;
  template?: boolean | undefined;
};

export type ScalarVariable = BaseVariable & {
  type: typeof RecipeDataTypes.Scalar;
  value: number;
};
/**
 * Describes the external dataset a data series was derived from.
 *
 * `External` variables are edit-time only; on save they are fetched, stored as a
 * `DataSeries`, and rewritten into a `DataSeriesVariable` that keeps this meta so
 * the source can be re-fetched or edited later.
 */
export type ExternalSource = {
  dataset: DatasetKeys | null;
  tableId: string | null;
  selection: {
    variableCode: string,
    valueCodes: string[]
  }[];
};

export type DataSeriesVariable = BaseVariable & {
  type: typeof RecipeDataTypes.DataSeries;
  pick: VectorIndexPickerOptions | number | ISOIshDate;

  dataSeriesId: string | null | undefined;
  value: DateValues | null | undefined;

  // If derived from an external dataset (see ExternalSource), keep the original selection so it can be re-fetched or edited.
  externalSource?: ExternalSource | null;
};
export type ExternalVariable = BaseVariable & {
  type: typeof RecipeDataTypes.External;
  pick: VectorIndexPickerOptions | number | ISOIshDate;

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
  id: string;
  displayName: string;
  value: Unit | Unit[] | number;
};
export type EvalTimeSeries = {
  id: string;
  displayName: string;
  series: DateValuesWithUnit;
}
export type RecipeExtractionOutput = (EvalTimeVariable | EvalTimeSeries)[];

/** 
 * # Notice
 * Do not use to type variables, only use for type checking when serializing/deserializing recipes
 */
export type SerializedRecipeShape = {
  name: string;
  equation: string;
  variables: RecipeVariable[];
  meta: {
    v?: number; // Version of recipe format
    isSuggestedRecipe?: boolean; // If it was derived from a suggested recipe, needed when e.g. loading a goal form and knowing which method was used.
  }
  & {
    [key: string]: JSONValue;
  };
};
export type SerializedRecipe = string & {};
