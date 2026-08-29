/**
 * Object and type for the different access levels returned by the accessChecker function.
 * Admin means managing sharing settings and org groups on top of editing content;
 * it is reserved for super admins and managers of the owning org.
 * (The old AUTHOR level is gone: authorship is cosmetic and never grants access.)
 */
export const AccessLevel = {
  None: "",
  View: "VIEW",
  Edit: "EDIT",
  Admin: "ADMIN",
} as const;
export type AccessLevel = (typeof AccessLevel)[keyof typeof AccessLevel];

/**
 * Which part of a goal a create/update request targets. Sent by the client to
 * discriminate the request body so the goal API can validate and handle a single
 * focused shape instead of a bag of optionals.
 */
export const GoalDataTarget = {
  Full: "FULL",
  DataSeries: "DATA_SERIES",
  Baseline: "BASELINE",
  Historical: "HISTORICAL",
  RecipeSuggestions: "RECIPE_SUGGESTIONS",
} as const;
export type GoalDataTarget = (typeof GoalDataTarget)[keyof typeof GoalDataTarget];

/** Object containing the different view modes for the goal table. */
export const ViewMode = {
  Table: "TABLE",
  Tree: "TREE",
} as const;
export type ViewMode = (typeof ViewMode)[keyof typeof ViewMode];

/** Object and type with the different types of sorting available for goals */
export const GoalSortBy = {
  Default: "",
  Alpha: "ALPHA",
  AlphaReverse: "ALPHA_REVERSE",
  ActionsFalling: "HIGH_FIRST",
  ActionsRising: "LOW_FIRST",
  Interesting: "INTEREST",
} as const;
export type GoalSortBy = (typeof GoalSortBy)[keyof typeof GoalSortBy];

/** Object and type with the different types of sorting available for roadmaps */
export const RoadmapSortBy = {
  Default: "",
  Alpha: "ALPHA",
  AlphaReverse: "ALPHA_REVERSE",
  GoalsFalling: "HIGH_FIRST",
  GoalsRising: "LOW_FIRST",
} as const;
export type RoadmapSortBy = (typeof RoadmapSortBy)[keyof typeof RoadmapSortBy];

/** 
 * Used by form
 */
export const DataSeriesType = {
  Manual: "MANUAL",
  Suggested: "SUGGESTED",
  Custom: "CUSTOM",
} as const;
export type DataSeriesType = (typeof DataSeriesType)[keyof typeof DataSeriesType];

/** 
 * Used by form
 */
export const BaselineType = {
  Initial: "INITIAL",
  InitialNonZero: "INITIAL_NON_ZERO",
  Custom: "CUSTOM",
  Inherited: "INHERIT",
} as const;
export type BaselineType = (typeof BaselineType)[keyof typeof BaselineType];

/** 
 * Used by form
 */
export const HistoricalDataType = {
  None: "NONE",
  External: "EXTERNAL",
  Custom: "CUSTOM",
} as const;
export type HistoricalDataType = (typeof HistoricalDataType)[keyof typeof HistoricalDataType];


/** The graphs available for a goal. */
export const GraphType = {
  Main: "MAIN",
  Relative: "RELATIVE",
  Delta: "DELTA",
} as const;
export type GraphType = (typeof GraphType)[keyof typeof GraphType];

/** The graphs available for a goal's child goals. */
export const ChildGraphType = {
  Target: "TARGET",
  Prediction: "PREDICTION",
} as const;
export type ChildGraphType = (typeof ChildGraphType)[keyof typeof ChildGraphType];

export const UnitFlags = {
  Unitless: "UNITLESS",
  Missing: "MISSING_UNIT",
} as const;
export type UnitFlags = (typeof UnitFlags)[keyof typeof UnitFlags];

/**
 * The listing state of a goal as one setting: the admin panel exposes it as a
 * single select rather than the two underlying flags (`is_featured`,
 * `is_unlisted`), since an unlisted goal is never featured anyway.
 * See `functions/goalVisibility.ts` for the mapping.
 */
export const GoalVisibility = {
  Public: "PUBLIC",
  Unlisted: "UNLISTED",
  Featured: "FEATURED",
} as const;
export type GoalVisibility = (typeof GoalVisibility)[keyof typeof GoalVisibility];

/**
 * A roadmap iteration's publication state as one tiered setting, standing in
 * for the two underlying fields (`published_at`, `is_unlisted`) in the form.
 * See `functions/iterationVisibility.ts` for the mapping.
 */
export const IterationVisibility = {
  Draft: "DRAFT",
  Unlisted: "UNLISTED",
  Public: "PUBLIC",
} as const;
export type IterationVisibility = (typeof IterationVisibility)[keyof typeof IterationVisibility];
