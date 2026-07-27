import type { Unit as MathJSUnit } from "mathjs";
import type { ApiSelectionItem, DatasetKeys } from "@/lib/api/apiTypes";
import type { DateValues, DateValuesWithUnit, ISOIshDate, UnitString } from "@/types";
import type { BaselineType } from "@/types/enums";
import type { RecipeDataTypes, VectorIndexPickerOptions } from "@/functions/recipe/types/consts";

type BaseVariable = {
  id: string;
  name: string;
  unit: UnitString;
  template?: boolean | undefined;
};

/** Which index/value to pick out of a series-valued variable. */
export type PickOption = VectorIndexPickerOptions | number | ISOIshDate;

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
  selection: ApiSelectionItem[];
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
  value: MathJSUnit | MathJSUnit[] | number;
};
export type EvalTimeSeries = {
  id: string;
  displayName: string;
  series: DateValuesWithUnit;
}
export type RecipeExtractionOutput = (EvalTimeVariable | EvalTimeSeries)[];

/**
 * Per external variable, either freshly fetched data (selection is new or changed) or a reference to the already-stored series (selection unchanged).
 */
export type ResolvedExternals = Map<string, { source: ExternalSource } & (
  | { data: DateValuesWithUnit, reuseDataSeriesId?: undefined }
  | { reuseDataSeriesId: string, data?: undefined }
)>;

/**
 * # Notice
 * The in-memory (parsed) shape of a recipe. Do not use to type variables, only
 * use for type checking when serializing/deserializing recipes.
 */
export type RecipeShape = {
  name: string;
  equation: string;
  variables: RecipeVariable[];
  unit: UnitString;
  meta: {
    v?: 1; // Version of recipe format (current: 1)
    isSuggestedRecipe?: boolean; // If it was derived from a suggested recipe, needed when e.g. loading a goal form and knowing which method was used.
    isManual?: boolean; // If it wraps a single inline data series entered by hand (the "manual"/"static" data series input), so forms can tell it apart from real recipes.
    baselineDerivation?: typeof BaselineType.Initial | typeof BaselineType.InitialNonZero; // If it derives a baseline from a goal's data series (first or first non-zero value), so forms can restore the selected baseline type. Values match `BaselineType` in `@/types/enums`.
  };
};

declare const serializedRecipeBrand: unique symbol;
/**
 * A string produced by {@link Recipe.serialize}. Branded so arbitrary strings
 * are not assignable to it — pass recipes through `Recipe.serialize()` to obtain one.
 */
export type SerializedRecipe = string & { readonly [serializedRecipeBrand]: true };
