/** Object and type for the different access levels returned by the accessChecker function. */
export const AccessLevel = {
  None: "",
  View: "VIEW",
  Edit: "EDIT",
  Author: "AUTHOR",
  Admin: "ADMIN",
} as const;
export type AccessLevel = (typeof AccessLevel)[keyof typeof AccessLevel];

export const ClientError = {
  AccessDenied: "You either don't have access to this entry or are trying to edit an entry that doesn't exist",
  BadSession: "Bad session cookie; you have been logged out. Please log in and try again.",
  IllegalParent: "You are trying to connect this object to a parent you don't have access to or that doesn't exist",
  StaleData: "Stale data; please refresh and try again",
} as const;
export type ClientError = (typeof ClientError)[keyof typeof ClientError];

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
  AlphaReverse: "ALPHA REVERSE",
  ActionsFalling: "HIGH FIRST",
  ActionsRising: "LOW FIRST",
  Interesting: "INTEREST",
} as const;
export type GoalSortBy = (typeof GoalSortBy)[keyof typeof GoalSortBy];

/** Object and type with the different types of sorting available for roadmaps */
export const RoadmapSortBy = {
  Default: "",
  Alpha: "ALPHA",
  AlphaReverse: "ALPHA REVERSE",
  GoalsFalling: "HIGH FIRST",
  GoalsRising: "LOW FIRST",
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


/** What a recipe editor lets the user do. The object doubles as the permissive default that callers spread over. */
export const RecipeEditorPermissions = {
  allowAddVariables: true,
  allowDeleteVariables: true,
  allowNameEditing: true,
  allowValueEditing: true,
} as const;
export type RecipeEditorPermissions = Partial<Record<keyof typeof RecipeEditorPermissions, boolean>>;

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