import { ActionImpactType, Prisma, RoadmapType } from "@prisma/client";
import { actionInclusionSelection, clientSafeGoalSelection, clientSafeMultiRoadmapSelection, clientSafeRoadmapSelection, dataSeriesInclusionSelection, effectInclusionSelection, goalInclusionSelection, metaRoadmapInclusionSelection, multiRoadmapInclusionSelection, nameSelector, roadmapInclusionSelection } from "./fetchers/inclusionSelectors";
import { Recipe } from "./functions/recipe/types";
import { Unit } from "mathjs";

/**
 * A utility function for helping with finding where something fails in a typeguard chain.
 * Meant to be used at the end of a chain of logical AND or OR operations, which would usually short-circuit, but call this function on failure.
 * 
 * Example:  
 *   `ShouldBeTruthy1 && ShouldBeTruthy2 || typeguardDebug("Failed AND check");`
 * 
 * or:  
 *   `ShouldBeTruthy1 || ShouldBeTruthy2 || typeguardDebug("Failed OR check");`
 * 
 * @returns `false`, so it can be used after an OR in logical operations without affecting the result.
 */
export function typeguardDebug(message: string): false {
  console.debug(message);
  return false;
}

/** An object that implements the AccessControlled interface can be checked with the accessChecker function. */
export interface AccessControlled {
  // Author is usually a single object, but allow for an array in case we need to check if the user is
  // an author of any parent in an entry's ancestry
  // For example, if a user is an author of a roadmap, they should be able to delete any goals in it, even if they didn't create them
  author: { id: string, username: string } | { id: string, username: string }[],
  editors: { id: string, username: string }[],
  viewers: { id: string, username: string }[],
  editGroups: { id: string, name: string, users: { id: string, username: string }[] }[],
  viewGroups: { id: string, name: string, users: { id: string, username: string }[] }[],
  isPublic: boolean,
};

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

/** Object and type with the different types of sorting available for roadmaps */
export const RoadmapSortBy = {
  Default: "",
  Alpha: "ALPHA",
  AlphaReverse: "ALPHA REVERSE",
  GoalsFalling: "HIGH FIRST",
  GoalsRising: "LOW FIRST",
} as const;
export type RoadmapSortBy = (typeof RoadmapSortBy)[keyof typeof RoadmapSortBy];

export function isStandardObject(object: unknown): object is object {
  return typeof object === "object" && object != null && !Array.isArray(object);
}

/** A regex to match UUIDs. Allows all UUIDs of all versions and variants, even non-standard ones, as specified by RFC 9562 */
export const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

/**
 * A type used by the breadcrumbs component to display the names of objects rather than their UUIDs.
 */
export type GenericEntry = (
  {
    // Action and MetaRoadmap
    id: string,
    name: string,
    indicatorParameter?: never,
    metaRoadmap?: never,
  } |
  {
    // Goal
    id: string,
    name?: string | null,
    indicatorParameter: string,
    metaRoadmap?: never,
  } |
  {
    // Roadmap
    id: string,
    name?: never,
    indicatorParameter?: never,
    metaRoadmap: { name: string },
  }
);

/** The return type of JSON.parse */
export type JSONValue = Partial<{ [key: string]: JSONValue }> | JSONValue[] | string | number | boolean | null;

// Usually part of an array with the type NameObject[]
export type NameObject = Prisma.MetaRoadmapGetPayload<{
  select: typeof nameSelector
}>;

export type MetaRoadmap = Prisma.MetaRoadmapGetPayload<{
  include: typeof metaRoadmapInclusionSelection
}>;

export type Roadmap = Prisma.RoadmapGetPayload<{
  include: typeof roadmapInclusionSelection
}>;

export type ClientRoadmap = Prisma.RoadmapGetPayload<{
  select: typeof clientSafeRoadmapSelection
}>;

// Will usually be part of an array with the type MultiRoadmapInstance[]
export type MultiRoadmapInstance = Prisma.RoadmapGetPayload<{
  include: typeof multiRoadmapInclusionSelection
}>;

// Will usually be part of an array with the type ClientMultiRoadmapInstance[]
export type ClientMultiRoadmapInstance = Prisma.RoadmapGetPayload<{
  select: typeof clientSafeMultiRoadmapSelection
}>;

export type Goal = Prisma.GoalGetPayload<{
  include: typeof goalInclusionSelection
}>;

export type ClientGoal = Prisma.GoalGetPayload<{
  select: typeof clientSafeGoalSelection
}>;

export type Action = Prisma.ActionGetPayload<{
  include: typeof actionInclusionSelection
}>;

export type Effect = Prisma.EffectGetPayload<{
  include: typeof effectInclusionSelection
}>;

export type DataSeries = Prisma.DataSeriesGetPayload<{
  include: typeof dataSeriesInclusionSelection
}>;

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

  /* Relational fields are handeled differently in our API */
  // roadmapVersions?: RoadmapCreateNestedManyWithoutMetaRoadmapInput,
  // parentRoadmap?: MetaRoadmapCreateNestedOneWithoutChildRoadmapsInput,
  // childRoadmaps?: MetaRoadmapCreateNestedManyWithoutParentRoadmapInput,
  // comments?: CommentCreateNestedManyWithoutMetaRoadmapInput,
  // links?: LinkCreateNestedManyWithoutMetaRoadmapInput,
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

  // TODO - DEPRECATED - Will be migrated to description
  links: { url: string, description?: string }[] | null | undefined;
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

  /* Relational fields are handeled differently in our API */
  // roadmapVersions?: RoadmapCreateNestedManyWithoutMetaRoadmapInput,
  // parentRoadmap?: MetaRoadmapCreateNestedOneWithoutChildRoadmapsInput,
  // childRoadmaps?: MetaRoadmapCreateNestedManyWithoutParentRoadmapInput,
  // comments?: CommentCreateNestedManyWithoutMetaRoadmapInput,
  // links?: LinkCreateNestedManyWithoutMetaRoadmapInput,
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

  // TODO - DEPRECATED - Will be migrated to description
  links: { url: string, description?: string }[] | null | undefined;
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
  goals: GoalCreateInput[] | null | undefined;
  // actions: Prisma.ActionCreateNestedManyWithoutRoadmapInput; // Cannot be created with a new roadmap

  // Access control
  // author: Prisma.UserCreateNestedOneWithoutAuthoredRoadmapsInput; // Derived from session in the API
  editors: string[] | null | undefined;
  editGroups: string[] | null | undefined;
  viewers: string[] | null | undefined;
  viewGroups: string[] | null | undefined;

  // TODO - DEPRECATED - Will be migrated to description
  links: { url: string, description?: string | null }[] | null | undefined;
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
  goals: GoalCreateInput[] | null | undefined;
  // actions: Prisma.ActionUpdateManyWithoutRoadmapNestedInput; // Cannot be updated from the roadmap

  // Access control
  // author: Prisma.UserUpdateOneRequiredWithoutAuthoredRoadmapsNestedInput;
  editors: string[] | null | undefined;
  editGroups: string[] | null | undefined;
  viewers: string[] | null | undefined;
  viewGroups: string[] | null | undefined;

  // TODO - DEPRECATED - Will be migrated to description
  links: { url: string, description?: string | null }[] | null | undefined;
};

/**
 * The format of the data needed to create a new goal.
 * 
 * This type is derived from @type {Prisma.GoalCreateInput} but with some fields omitted in clear text for better intellisense readability and maintainability.
 * 
 * That being said, if the schema changes, this type will need to be updated manually.
 */
export type GoalCreateInput = {
  goalId?: never; // Ignored when creating
  timestamp?: never; // Ignored when creating

  // id: string | undefined; // Gets created automatically // Created by the API
  // createdAt: string | Date | undefined; // Gets set automatically // Created by the API
  // updatedAt: string | Date | undefined; // Gets set automatically // Created by the API

  // Basic meta
  name: string | null | undefined;
  description: string | null | undefined;
  indicatorParameter: string;
  isFeatured: boolean | undefined;

  // External data source
  externalDataset: string | null | undefined;
  externalTableId: string | null | undefined;
  externalSelection: string | null | undefined;

  recipeSuggestions: Recipe[] | null | undefined;

  dataSeriesId: string | null | undefined;
  dataSeries: DateValuesWithUnit;
  dataSeriesRecipeId: string | null | undefined;
  dataSeriesRecipe: Recipe | null | undefined;

  baselineId: string | null | undefined;
  baseline: DateValuesWithUnit;
  baselineRecipeId: string | null | undefined;
  baselineRecipe: Recipe | null | undefined;

  // Relations
  // authorId: string; // Derived from session in the API
  // effects: Prisma.EffectCreateNestedManyWithoutGoalInput; // Cannot be created with a new goal
  roadmapId: string;
  // comments: Prisma.CommentCreateNestedManyWithoutGoalInput; // Cannot be created with a new goal
  rawTags: string[] | null | undefined; // Transform into tags relation in the server side API

  // TODO: Deprecated - will be moved to description
  links: { url: string, description?: string | null }[] | null | undefined;
};

/**
 * The format of the data allowed to update an existing goal.
 * 
 * This type is derived from @type {Prisma.GoalUpdateInput} but with some fields omitted in clear text for better intellisense readability and maintainability.
 * 
 * That being said, if the schema changes, this type will need to be updated manually.
 */
export type GoalUpdateInput = {
  // Required to find this goal
  goalId: string;

  // Stale data check
  timestamp: number; // From Date.now() i.e. milliseconds since epoch

  // id: string | undefined; // Gets created automatically
  // createdAt: string | Date | undefined; // Gets set automatically
  // updatedAt: string | Date | undefined; // Gets set automatically

  // Basic meta
  name: string | null | undefined;
  description: string | null | undefined;
  indicatorParameter: string | undefined;
  isFeatured: boolean | undefined;

  // External data source
  externalDataset: string | null | undefined;
  externalTableId: string | null | undefined;
  externalSelection: string | null | undefined;

  dataSeriesId: string | null | undefined;
  dataSeries: DateValuesWithUnit | null | undefined;
  dataSeriesRecipeId: string | null | undefined;
  dataSeriesRecipe: Recipe | null | undefined;

  baselineId: string | null | undefined;
  baseline: DateValuesWithUnit | null | undefined;
  baselineRecipeId: string | null | undefined;
  baselineRecipe: Recipe | null | undefined;

  recipeSuggestions: Recipe[] | null | undefined;

  // Relations
  // authorId: string; // Derived from session in the API
  // effects: Prisma.EffectCreateNestedManyWithoutGoalInput; // Cannot be updated from the goal
  roadmapId?: never; // Ignored when updating; Can't reassign the roadmap of an existing goal
  // comments: Prisma.CommentCreateNestedManyWithoutGoalInput; // Cannot be updated from the goal
  rawTags: string[] | null | undefined; // Transform into tags relation in the server side API

  // TODO: Deprecated - will be moved to description
  links: { url: string, description?: string | null }[] | null | undefined;
};

/** The format of the data needed to create a new action. */
export type ActionInput = {
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

  dataSeries: string[] | null | undefined;
  impactType: ActionImpactType | undefined;

  // TODO: Deprecated - will be moved to description
  links: { url: string, description?: string | null }[] | null | undefined;
};

export type EffectInput = {
  goalId: string;
  actionId: string;

  impactType: ActionImpactType | undefined;
  dataSeries: DateValuesWithUnit;
};

export type UnitString = string | null | undefined;
export type ISOIshDate = `${number}-${number}-${number}T00:00:00.000Z`;
/** True: missing value, False: defined value. It masks/"covers" the undefined values */
export type Mask = Record<ISOIshDate, boolean>;
export type DateValues = Record<ISOIshDate, number>;
export type DateValuesWithUnit = { dateValues: DateValues, unit: UnitString };
export type MaskedVector = { vector: Unit[], mask: Mask };
export function isDateValues(dateValues: JSONValue): dateValues is DateValues {
  return (
    isStandardObject(dateValues)
    && Object.values(dateValues).every(value => typeof value === 'number')
    && Object.keys(dateValues).every(key => isISOIshDate(key))
  );
}
export function isUnitString(unit: JSONValue | undefined): unit is UnitString {
  return typeof unit === 'string' || unit === null || unit === undefined;
}
/** This is not compliant with ISO-8601, it's a vary narrow format that's a subset of that standard */
export function isISOIshDate(dateString: string): dateString is ISOIshDate {
  return /^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/.test(dateString);
}
export function isDateValuesWithUnit(dateValues: JSONValue): dateValues is Partial<DateValuesWithUnit> {
  return (
    isStandardObject(dateValues)
    && 'values' in dateValues
    && typeof dateValues.values === 'object'
    && !Array.isArray(dateValues)
    && isDateValues(dateValues.values)
    && isUnitString(dateValues.unit)
  );
}

/* TODO INPUT_UPDATES */
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    underlineSpan: {
      toggleUnderline: () => ReturnType
    }
  }
}
