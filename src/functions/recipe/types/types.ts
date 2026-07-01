import type { Unit } from "mathjs";
import type { DatasetKeys } from "@/lib/api/utility";
import type { DateValues, DateValuesWithUnit, ISOIshDate, UnitString } from "@/types";
import type { RecipeDataTypes, VectorIndexPickerOptions } from "@/functions/recipe/types/consts";

type BaseVariable = {
  id: string;
  name: string;
  unit: UnitString;
  template?: boolean | undefined;
};

/** Which index/value to pick out of a series-valued variable. */
export type PickOption = VectorIndexPickerOptions | number | ISOIshDate;

/** A single external API selection constraint. */
export type ExternalSelectionItem = {
  variableCode: string;
  valueCodes: string[];
};
export type ExternalSelection = ExternalSelectionItem[];

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
  selection: ExternalSelection;
};

export type DataSeriesVariable = BaseVariable & {
  type: typeof RecipeDataTypes.DataSeries;
  pick: PickOption;

  dataSeriesId: string | null | undefined;
  value: DateValues | null | undefined;

  // If derived from an external dataset (see ExternalSource), keep the original selection so it can be re-fetched or edited.
  externalSource?: ExternalSource | null;
};
export type ExternalVariable = BaseVariable & {
  type: typeof RecipeDataTypes.External;
  pick: PickOption;

  // The materialized DataSeries for the current selection (set when an
  // already-saved external variable is loaded for editing). While present and the
  // selection is unchanged, this series is canon and is read instead of fetching
  // the upstream API; it is cleared when the selection is explicitly modified.
  dataSeriesId?: string | null;
} & ExternalSource;
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
 * The in-memory (parsed) shape of a recipe. Do not use to type variables, only
 * use for type checking when serializing/deserializing recipes.
 */
export type RecipeShape = {
  name: string;
  equation: string;
  variables: RecipeVariable[];
  meta: {
    v?: 1; // Version of recipe format (current: 1)
    isSuggestedRecipe?: boolean; // If it was derived from a suggested recipe, needed when e.g. loading a goal form and knowing which method was used.
    isManual?: boolean; // If it wraps a single inline data series entered by hand (the "manual"/"static" data series input), so forms can tell it apart from real recipes.
  };
};

declare const serializedRecipeBrand: unique symbol;
/**
 * A string produced by {@link Recipe.serialize}. Branded so arbitrary strings
 * are not assignable to it — pass recipes through `Recipe.serialize()` to obtain one.
 */
export type SerializedRecipe = string & { readonly [serializedRecipeBrand]: true };
