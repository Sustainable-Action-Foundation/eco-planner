/**
 * Enum-ish constants for form input `name` attributes, shared so a form's inputs
 * and the `formData.get(...)` / `form.namedItem(...)` reads that consume them stay
 * in lockstep (a mismatch is otherwise a silent `null` at runtime, not a type
 * error). Fields that cross a component boundary — a section emitting a value the
 * parent form reads — must use the same constant on both sides.
 *
 * Only form-internal field names live here. Names that carry external meaning
 * (e.g. the PxWeb query-variable names in the historical section) are intentionally
 * left as literals.
 */

/**
 * Emitted by every recipe `FormSync` (form-agnostic, hence not part of a per-form
 * name set): "true" while the surrounding recipe context has a pending evaluation.
 * Submit handlers wait for all enabled instances to read "false" before consuming
 * the other FormSync outputs (see `waitForRecipeFormSyncs`).
 */
export const RecipeEvaluationPendingName = "RECIPE_EVALUATION_PENDING";

export const GoalFormName = {
  GoalName: "GOAL_NAME",
  Description: "DESCRIPTION",
  IndicatorParameter: "INDICATOR_PARAMETER",
  Visibility: "VISIBILITY",
  DataSeriesType: "DATA_SERIES_TYPE",
  BaselineType: "BASELINE_TYPE",
  DataUnit: "DATA_UNIT",
  ResultingRecipe: "RESULTING_RECIPE",
  ResultingDateValues: "RESULTING_DATE_VALUES",
  BaselineDataSeries: "BASELINE_DATA_SERIES",
  BaselineRecipe: "BASELINE_RECIPE",
  HistoricalDataSeries: "HISTORICAL_DATA_SERIES",
  HistoricalRecipe: "HISTORICAL_RECIPE",
  RecipeSuggestions: "RECIPE_SUGGESTIONS",
} as const;
export type GoalFormName = (typeof GoalFormName)[keyof typeof GoalFormName];

export const EffectFormName = {
  ActionId: "ACTION_ID",
  GoalId: "GOAL_ID",
  ImpactType: "IMPACT_TYPE",
  ResultingDateValues: "RESULTING_DATE_VALUES",
} as const;
export type EffectFormName = (typeof EffectFormName)[keyof typeof EffectFormName];

export const ActionFormName = {
  // The DOM name of the iteration select (kept for test stability)
  RoadmapId: "ROADMAP_ID",
  ActionName: "ACTION_NAME",
  ImpactType: "IMPACT_TYPE",
  ResultingDateValues: "RESULTING_DATE_VALUES",
  StartYear: "START_YEAR",
  EndYear: "END_YEAR",
  // The old fixed inputs (description, cost efficiency, expected outcome, project
  // manager, relevant actors, category booleans) are gone: actions now carry
  // free-form ActionFields rows instead (see functions/fields.ts)
} as const;
export type ActionFormName = (typeof ActionFormName)[keyof typeof ActionFormName];