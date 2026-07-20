import type { SerializedRecipe } from "@/functions/recipe";
import type { ActionImpactType, Prisma, RoadmapType } from "@/lib/prisma/generated";
import type { Action, DateValuesWithUnit } from "@/types";
// Imported as a value (not `import type`) because it's used in `typeof GoalDataTarget.*` queries below.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { GoalDataTarget } from "@/types/enums";

/** The format of data needed to create a new roadmap series */
export type MetaRoadmapCreateInput = {
  /**
   * This type is derived from @type {Prisma.MetaRoadmapCreateInput}, but with some fields omitted in clear text for better intellisense readability and maintainability.
   * 
   * That being said, if the schema changes, this type will need to be updated manually.
   */
  /* Automatically managed by Prisma */
  id?: never,
  // createdAt?: Date | string,
  // updatedAt?: Date | string,

  name: string,
  description: string,
  type: RoadmapType | undefined,
  actor: string | null | undefined,
  isPublic: boolean | undefined,

  /* Relational fields are handled differently in our API */
  // roadmapVersions?: RoadmapCreateNestedManyWithoutMetaRoadmapInput,
  // parentRoadmap?: MetaRoadmapCreateNestedOneWithoutChildRoadmapsInput,
  // childRoadmaps?: MetaRoadmapCreateNestedManyWithoutParentRoadmapInput,
  // comments?: CommentCreateNestedManyWithoutMetaRoadmapInput,
  // author: UserCreateNestedOneWithoutAuthoredMetaRoadmapsInput,
  // editors?: UserCreateNestedManyWithoutEditMetaRoadmapsInput,
  // editGroups?: UserGroupCreateNestedManyWithoutEditMetaRoadmapInput,
  // viewers?: UserCreateNestedManyWithoutViewMetaRoadmapsInput,
  // viewGroups?: UserGroupCreateNestedManyWithoutViewMetaRoadmapInput,

  /* 
   * Non-prisma fields
   * These are used to make the API more usable and nice to deal with due to formatting and types.
   */
  // Accepts lists of UUIDs for all of the following, to link them to the roadmap (optional)
  editors: string[] | null | undefined;
  viewers: string[] | null | undefined;
  editGroups: string[] | null | undefined;
  viewGroups: string[] | null | undefined;

  // UUID for the parent meta roadmap (if any)
  parentRoadmapId: string | null | undefined;
}

/** The format of data needed to update an existing data series. When compared to MetaRoadmapCreateInput, this type allows most fields to be undefined, indicating that they should not be changed. */
export type MetaRoadmapUpdateInput = {
  /**
   * This type is derived from @type {Prisma.MetaRoadmapCreateInput}, but with some fields omitted in clear text for better intellisense readability and maintainability.
   * 
   * That being said, if the schema changes, this type will need to be updated manually.
   */
  /* Automatically managed by Prisma */
  // createdAt?: Date | string,
  // updatedAt?: Date | string,

  id: string,
  name: string | undefined,
  description: string | undefined,
  type: RoadmapType | undefined,
  actor: string | null | undefined,
  isPublic: boolean | undefined,

  /* Relational fields are handled differently in our API */
  // roadmapVersions?: RoadmapCreateNestedManyWithoutMetaRoadmapInput,
  // parentRoadmap?: MetaRoadmapCreateNestedOneWithoutChildRoadmapsInput,
  // childRoadmaps?: MetaRoadmapCreateNestedManyWithoutParentRoadmapInput,
  // comments?: CommentCreateNestedManyWithoutMetaRoadmapInput,
  // author: UserCreateNestedOneWithoutAuthoredMetaRoadmapsInput,
  // editors?: UserCreateNestedManyWithoutEditMetaRoadmapsInput,
  // editGroups?: UserGroupCreateNestedManyWithoutEditMetaRoadmapInput,
  // viewers?: UserCreateNestedManyWithoutViewMetaRoadmapsInput,
  // viewGroups?: UserGroupCreateNestedManyWithoutViewMetaRoadmapInput,

  /* 
   * Non-prisma fields
   * These are used to make the API more usable and nice to deal with due to formatting and types.
   */
  // Accepts lists of UUIDs for all of the following, to link them to the roadmap (optional)
  editors: string[] | null | undefined;
  viewers: string[] | null | undefined;
  editGroups: string[] | null | undefined;
  viewGroups: string[] | null | undefined;

  // UUID for the parent meta roadmap (if any)
  parentRoadmapId: string | null | undefined;

  // Timestamp to check if the user is trying to update based on stale data
  timestamp: number;
}

/** The format of the data needed to create a new roadmap version. */
export type RoadmapInput = Omit<
  Prisma.RoadmapCreateInput,
  'id' | 'createdAt' | 'updatedAt' | 'goals' | 'author' | 'editors' |
  'viewers' | 'editGroups' | 'viewGroups' | 'comments' | 'metaRoadmap' | 'version'
> & {
  // Accepts lists of UUIDs for all of the following, to link them to the roadmap (optional)
  editors?: string[] | undefined;
  viewers?: string[] | undefined;
  editGroups?: string[] | undefined;
  viewGroups?: string[] | undefined;
  // UUID for the meta roadmap this roadmap belongs to
  metaRoadmapId: string;
  // Used in API to inherit the goals with the given IDs from other roadmaps
  // TODO: DEPRECATED - remove this prop since it should be recipe derived
  inheritFromIds?: string[] | null | undefined;
  // Version numbers are assigned by the API and therefore omitted
};

/** 
 * The format of the data needed to create a new roadmap version.
 * 
 * This type is derived from @type {Prisma.RoadmapCreateInput} but with some fields omitted in clear text for better intellisense readability and maintainability.
 * 
 * That being said, if the schema changes, this type will need to be updated manually.
 */
export type RoadmapCreateInput = {
  // To differentiate between create and update
  roadmapId?: never;
  timestamp?: never; // Not needed when creating

  // id: string | undefined; // Created by the API
  // createdAt: string | Date | undefined; // Created by the API
  // updatedAt: string | Date | undefined; // Created by the API
  // version: number;  // Created by the API

  // Basic meta
  targetVersion: number | null | undefined;
  description: string | null | undefined;
  isPublic: boolean | undefined;

  // Relations
  metaRoadmapId: string;
  // comments: Prisma.CommentCreateNestedManyWithoutRoadmapInput; // Cannot be created with a new roadmap
  // goals: Prisma.GoalCreateNestedManyWithoutRoadmapInput;
  // Nested goals are always created in full (a new goal needs its data series etc.)
  goals: GoalCreateFull[] | null | undefined;
  // actions: Prisma.ActionCreateNestedManyWithoutRoadmapInput; // Cannot be created with a new roadmap

  // Access control
  // author: Prisma.UserCreateNestedOneWithoutAuthoredRoadmapsInput; // Derived from session in the API
  editors: string[] | null | undefined;
  editGroups: string[] | null | undefined;
  viewers: string[] | null | undefined;
  viewGroups: string[] | null | undefined;
};

/**
 * The format of the data allowed to update an existing roadmap version.
 * 
 * This type is derived from @type {Prisma.RoadmapUpdateInput} but with some fields omitted in clear text for better intellisense readability and maintainability.
 * 
 * That being said, if the schema changes, this type will need to be updated manually.
 */
export type RoadmapUpdateInput = {
  // Required to find this roadmap
  roadmapId: string;

  // Stale data check
  timestamp: number; // From Date.now() i.e. milliseconds since epoch

  // createdAt: string | Date | undefined; // Handled by the API
  // updatedAt: string | Date | undefined; // Handled by the API
  // version: number; // Handled by the API

  // Basic meta
  description: string | null | undefined;
  targetVersion: number | null | undefined;
  isPublic: boolean | undefined;

  // Relations
  metaRoadmapId?: never; // Can't reassign the meta roadmap of an existing roadmap. IT WOULD BE MAYHEM.
  // comments: Prisma.CommentUpdateManyWithoutRoadmapNestedInput; // Cannot be updated from the roadmap
  // goals: Prisma.GoalUpdateManyWithoutRoadmapNestedInput;
  // Nested goals are always created in full (a new goal needs its data series etc.)
  goals: GoalCreateFull[] | null | undefined;
  // actions: Prisma.ActionUpdateManyWithoutRoadmapNestedInput; // Cannot be updated from the roadmap

  // Access control
  // author: Prisma.UserUpdateOneRequiredWithoutAuthoredRoadmapsNestedInput;
  editors: string[] | null | undefined;
  editGroups: string[] | null | undefined;
  viewers: string[] | null | undefined;
  viewGroups: string[] | null | undefined;
};

/**
 * ## Goal request field groups
 *
 * The goal API body is a discriminated union (see GoalCreateInput / GoalUpdateInput),
 * tagged by `target` (a GoalDataTarget). These reusable groups describe each
 * section's fields; the variants below compose them. Derived from
 * @type {Prisma.GoalCreateInput} / @type {Prisma.GoalUpdateInput} — if the schema
 * changes, these must be updated manually.
 */

/** Basic goal metadata. */
type GoalMetaFields = {
  name: string | null | undefined;
  description: string | null | undefined;
  indicatorParameter: string | undefined;
  isFeatured: boolean | undefined;
  rawTags: string[] | null | undefined; // Transform into tags relation in the server side API
};

/**
 * The recipe-suggestions section: recipes offered when inheriting from this goal
 * (the goal's `recipeSuggestions` relation). Accepts any serialized recipe, but is
 * mainly intended to carry template recipes. A full set replacing the current one;
 * `null`/`[]` clears it, `undefined` leaves it unchanged.
 */
export type RecipeSuggestionsFields = {
  recipeSuggestions?: SerializedRecipe[] | null | undefined;
};

// Section fields are key-optional: a sectional request only needs to send the
// fields it actually sets (e.g. clearing historical sends just the nulls it wants).
/** The main data series section. */
export type DataSeriesFields = {
  dataSeriesId?: string | null | undefined;
  dataSeries?: DateValuesWithUnit | null | undefined;
  dataSeriesRecipeId?: string | null | undefined;
  dataSeriesRecipe?: SerializedRecipe | null | undefined;
};

/** The baseline section. */
export type BaselineFields = {
  baselineId?: string | null | undefined;
  baseline?: DateValuesWithUnit | null | undefined;
  baselineRecipeId?: string | null | undefined;
  baselineRecipe?: SerializedRecipe | null | undefined;
};

/**
 * The historical section. The external API selection lives in the recipe; the
 * server fetches it into the `historical` DataSeries on save.
 */
export type HistoricalFields = {
  historicalId?: string | null | undefined;
  historical?: DateValuesWithUnit | null | undefined;
  historicalRecipeId?: string | null | undefined;
  historicalRecipe?: SerializedRecipe | null | undefined;
};

/** Identity for a request that writes a single section of an existing goal. */
type GoalSectionIdentity = {
  goalId: string; // The existing goal being written to
  timestamp: number; // Stale data check; from Date.now() i.e. milliseconds since epoch
  roadmapId?: never; // Sectional requests can't (re)assign a roadmap
};

// The three sectional variants are structurally identical between create and
// update (create = "add this section", update = "replace this section"); the
// distinction is the HTTP method, handled in the route.
type GoalDataSeriesSection = { target: typeof GoalDataTarget.DataSeries } & GoalSectionIdentity & DataSeriesFields;
type GoalBaselineSection = { target: typeof GoalDataTarget.Baseline } & GoalSectionIdentity & BaselineFields;
type GoalHistoricalSection = { target: typeof GoalDataTarget.Historical } & GoalSectionIdentity & HistoricalFields;
type GoalRecipeSuggestionsSection = { target: typeof GoalDataTarget.RecipeSuggestions } & GoalSectionIdentity & RecipeSuggestionsFields;

/** Create a brand-new goal with all sections at once. `dataSeries` and `indicatorParameter` are required. */
export type GoalCreateFull = {
  target: typeof GoalDataTarget.Full;
  goalId?: never; // Ignored when creating
  timestamp?: never; // Ignored when creating
  roadmapId: string;
  indicatorParameter: string; // Required on create
  dataSeries: DateValuesWithUnit; // Required on create
} & GoalMetaFields & DataSeriesFields & BaselineFields & HistoricalFields & RecipeSuggestionsFields;

/** Update every section of an existing goal at once. */
export type GoalUpdateFull = {
  target: typeof GoalDataTarget.Full;
  goalId: string;
  timestamp: number; // Stale data check; from Date.now() i.e. milliseconds since epoch
  roadmapId?: never; // Can't reassign the roadmap of an existing goal
} & GoalMetaFields & DataSeriesFields & BaselineFields & HistoricalFields & RecipeSuggestionsFields;

/**
 * The body accepted by `POST /api/goal`: either a full new goal, or one section
 * added to an existing goal. Discriminated by `target`.
 */
export type GoalCreateInput = GoalCreateFull | GoalDataSeriesSection | GoalBaselineSection | GoalHistoricalSection | GoalRecipeSuggestionsSection;

/**
 * The body accepted by `PUT /api/goal`: either a full goal update, or one section
 * replaced on an existing goal. Discriminated by `target`.
 */
export type GoalUpdateInput = GoalUpdateFull | GoalDataSeriesSection | GoalBaselineSection | GoalHistoricalSection | GoalRecipeSuggestionsSection;

/** The format of the data needed to create a new action. */
export type ActionInput = {
  actionId: string | null | undefined;
  roadmapId: string | undefined;
  goalId: string | undefined;

  description: string | null | undefined;
  name: string;
  startYear: number | null | undefined;
  endYear: number | null | undefined;

  costEfficiency: string | null | undefined;
  expectedOutcome: string | null | undefined;

  projectManager: string | null | undefined;
  relevantActors: string | null | undefined;

  isSufficiency: boolean | undefined;
  isEfficiency: boolean | undefined;
  isRenewables: boolean | undefined;

  parentAction: Action | null | undefined;
  childActions: Action[] | null | undefined;

  dataSeries: DateValuesWithUnit | undefined;
  impactType: ActionImpactType | undefined;

  timestamp: number | undefined;
};

export type EffectInput = {
  goalId: string;
  actionId: string;

  impactType: ActionImpactType | undefined;
  dataSeries: DateValuesWithUnit;

  timestamp: number | undefined;
};