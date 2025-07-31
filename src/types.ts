import { ActionImpactType, DataSeries, Prisma, RoadmapType } from "@prisma/client";
import dataFieldArray from "./lib/dataSeriesDataFieldNames.json" with { type: "json" };
import { actionInclusionSelection, clientSafeGoalSelection, clientSafeMultiRoadmapSelection, clientSafeRoadmapSelection, effectInclusionSelection, goalInclusionSelection, metaRoadmapInclusionSelection, multiRoadmapInclusionSelection, nameSelector, roadmapInclusionSelection } from "./fetchers/inclusionSelectors";

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

/** Enum for the different access levels returned by the accessChecker function. */
export enum AccessLevel {
  None = "",
  View = "VIEW",
  Edit = "EDIT",
  Author = "AUTHOR",
  Admin = "ADMIN",
};

export enum ClientError {
  AccessDenied = "You either don't have access to this entry or are trying to edit an entry that doesn't exist",
  BadSession = "Bad session cookie; you have been logged out. Please log in and try again.",
  IllegalParent = "You are trying to connect this object to a parent you don't have access to or that doesn't exist",
  StaleData = "Stale data; please refresh and try again",
};

/** Enum for different ways to get scalars for repeatableScaling and similar */
export enum ScaleBy {
  Custom = "CUSTOM",
  Inhabitants = "INHABITANTS",
  Area = "AREA",
}

/** Enum with the different types of sorting available for roadmaps */
export enum RoadmapSortBy {
  Default = "",
  Alpha = "ALPHA",
  AlphaReverse = "ALPHA REVERSE",
  GoalsFalling = "HIGH FIRST",
  GoalsRising = "LOW FIRST",
}

/** Different scaling methods used in scalingRecipe */
export enum ScaleMethod {
  Algebraic = "ALGEBRAIC",
  Geometric = "GEOMETRIC",
  Multiplicative = "MULTIPLICATIVE",
}

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

/** Recipe containing all information needed to calculate a scale for a goal. Saved stringified in Goal.combinationScale in the db */
export type ScalingRecipe = {
  method?: ScaleMethod,
  values: (SimpleScalingValue | AdvancedScalingValue)[]
}

export type SimpleScalingValue = {
  type?: ScaleBy.Custom,
  value: number,
  weight?: number,
}

export type AdvancedScalingValue = {
  type: ScaleBy.Area | ScaleBy.Inhabitants,
  parentArea: string,
  childArea: string,
  weight?: number,
}

/** The return type of JSON.parse */
export type JSONValue = Partial<{ [key: string]: JSONValue }> | JSONValue[] | string | number | boolean | null;

export function isScalingRecipe(object: unknown): object is ScalingRecipe {
  return (typeof object == "object" && (object as ScalingRecipe)?.values instanceof Array)
}

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

/** The format of data needed to create a new roadmap series */
export type MetaRoadmapCreateInput = {
  /**
   * This type is derived from @type {Prisma.MetaRoadmapCreateInput}, but with some fields omitted in clear text for better intellisense readability and maintainability.
   * 
   * That being said, if the schema changes, this type will need to be updated manually.
   */
  /* Automatically managed by Prisma */
  // id?: string,
  // createdAt?: Date | string,
  // updatedAt?: Date | string,

  name: string,
  description: string,
  type?: RoadmapType,
  actor?: string | null,
  isPublic?: boolean,

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
  editors?: string[] | null;
  viewers?: string[] | null;
  editGroups?: string[] | null;
  viewGroups?: string[] | null;

  // UUID for the parent meta roadmap (if any)
  parentRoadmapId?: string | null;

  // TODO - DEPRECATED - Will be migrated to description
  links?: { url: string, description?: string }[] | null;
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
  name?: string | undefined,
  description?: string | undefined,
  type?: RoadmapType | undefined,
  actor?: string | null | undefined,
  isPublic?: boolean | undefined,

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
  editors?: string[] | null | undefined;
  viewers?: string[] | null | undefined;
  editGroups?: string[] | null | undefined;
  viewGroups?: string[] | null | undefined;

  // UUID for the parent meta roadmap (if any)
  parentRoadmapId?: string | null | undefined;

  // Timestamp to check if the user is trying to update based on stale data
  timestamp: number;

  // TODO - DEPRECATED - Will be migrated to description
  links?: { url: string, description?: string }[] | null | undefined;
}

export type MetaRoadmapInput = Omit<
  Prisma.MetaRoadmapCreateInput,
  'id' | 'createdAt' | 'updatedAt' | 'author' | 'editors' |
  'viewers' | 'editGroups' | 'viewGroups' | 'comments' | 'links' |
  'roadmapVersions' | 'parentRoadmap' | 'childRoadmaps'
> & {
  links?: { url: string, description?: string }[] | undefined;
  // Accepts lists of UUIDs for all of the following, to link them to the roadmap (optional)
  editors?: string[] | undefined;
  viewers?: string[] | undefined;
  editGroups?: string[] | undefined;
  viewGroups?: string[] | undefined;
  // UUID for the parent meta roadmap (if any)
  parentRoadmapId?: string | undefined;
};

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
  inheritFromIds?: string[] | null | undefined;
  // Version numbers are assigned by the API
};

/** The format of t he data needed to create a new goal. */
export type GoalCreateInput = {
  /**
   * This type is derived from @type {Prisma.GoalCreateInput}, but with some fields omitted in clear text for better intellisense readability and maintainability.
   * 
   * That being said, if the schema changes, this type will need to be updated manually.
   */

  name?: string | null,
  description?: string | null,
  indicatorParameter: string,
  dataUnit?: string | null,
  dataSeriesArray?: (number | null)[],
  rawDataSeries?: string[],
  rawBaselineDataSeries?: string[],
  inheritFrom?: { id: string, isInverted?: boolean }[],
  roadmapId: string,
  goalId?: string | null,
  links?: { url: string, description?: string | null }[],
  timestamp?: number,
  isFeatured?: boolean,
  externalDataset?: string | null,
  externalTableId?: string | null,
  externalSelection?: string | null,
  recipeHash?: string | null,
}

export type GoalUpdateInput = {
  name?: string | null,
  description?: string | null,
  indicatorParameter?: string,
  dataUnit?: string | null,
  dataSeriesArray?: (number | null)[],
  rawDataSeries?: string[],
  rawBaselineDataSeries?: string[],
  inheritFrom?: { id: string, isInverted?: boolean }[],
  goalId: string,
  links?: { url: string, description?: string | null }[],
  timestamp?: number,
  isFeatured?: boolean,
  externalDataset?: string | null,
  externalTableId?: string | null,
  externalSelection?: string | null,
  recipeHash?: string | null,
}

/** The format of the data needed to create a new action. */
export type ActionInput = Omit<
  Prisma.ActionCreateInput,
  'id' | 'createdAt' | 'updatedAt' | 'roadmap' | 'dataSeries' |
  'author' | 'notes' | 'links' | 'comments' | 'effects'
> & {
  // UUID of the roadmap this action belongs to
  roadmapId?: string;
  dataSeries?: string[] | null | undefined;
  // UUID for the goal the dataSeries (effect) affects, if any
  goalId?: string | undefined;
  // The type of impact the effect has, if an effect is included
  impactType?: ActionImpactType | undefined;
  links?: { url: string, description?: string }[] | undefined;
};

export type EffectInput = Omit<
  Prisma.EffectCreateInput,
  'action' | 'goal' | 'dataSeries' | 'createdAt' | 'updatedAt'
> & {
  actionId: string;
  goalId: string;
  // dataSeries may be undefined when editing, to avoid changing it, but it's required when creating
  dataSeries: string[] | undefined;
};

/** A type with only the data fields of the data series object. Not dynamic, so might need to be updated if the data series object changes. */
export type DataSeriesDataFields = Omit<
  DataSeries,
  'author' | 'unit' | 'scale' | 'id' | 'createdAt' | 'updatedAt' |
  'editors' | 'viewers' | 'editGroups' | 'viewGroups' | 'authorId' |
  'goalId' | 'baselineGoalId' | 'effectActionId' | 'effectGoalId'
>;

/** An array containing the keys of the actual data fields in the data series object. Generated by the getDataSeriesValueFieldNames script at build time. */
export const dataSeriesDataFieldNames = dataFieldArray as (keyof DataSeriesDataFields)[];