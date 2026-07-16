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

export const GoalFormName = {
  GoalName: "GOAL_NAME",
  Description: "DESCRIPTION",
  IndicatorParameter: "INDICATOR_PARAMETER",
  IsFeatured: "IS_FEATURED",
  DataSeriesType: "DATA_SERIES_TYPE",
  BaselineType: "BASELINE_TYPE",
  DataUnit: "DATA_UNIT",
  ResultingRecipe: "RESULTING_RECIPE",
  ResultingDateValues: "RESULTING_DATE_VALUES",
  BaselineDataSeries: "BASELINE_DATA_SERIES",
  BaselineRecipe: "BASELINE_RECIPE",
  HistoricalDataSeries: "HISTORICAL_DATA_SERIES",
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
  RoadmapId: "ROADMAP_ID",
  ActionName: "ACTION_NAME",
  Description: "DESCRIPTION",
  CostEfficiency: "COST_EFFICIENCY",
  ExpectedOutcome: "EXPECTED_OUTCOME",
  ImpactType: "IMPACT_TYPE",
  ResultingDateValues: "RESULTING_DATE_VALUES",
  StartYear: "START_YEAR",
  EndYear: "END_YEAR",
  ProjectManager: "PROJECT_MANAGER",
  RelevantActors: "RELEVANT_ACTORS",
  IsSufficiency: "IS_SUFFICIENCY",
  IsEfficiency: "IS_EFFICIENCY",
  IsRenewables: "IS_RENEWABLES",
} as const;
export type ActionFormName = (typeof ActionFormName)[keyof typeof ActionFormName];