import { ActionImpactType, DataSeries, Prisma } from "@prisma/client";
import dataFieldArray from "./lib/dataSeriesDataFieldNames.json";

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

/** Different scaling methods used in scalingRecipie */
export enum ScaleMethod {
  Algebraic = "ALGEBRAIC",
  Geometric = "GEOMETRIC",
  Multiplicative = "MULTIPLICATIVE",
}

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

/** Recipie containing all information needed to calculate a scale for a goal. Saved stringified in Goal.combinationScale in the db */
export type ScalingRecipie = {
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

export function isScalingRecipie(object: unknown): object is ScalingRecipie {
  return (typeof object == "object" && (object as ScalingRecipie)?.values instanceof Array)
}

/** The format of the data needed to create new roadmap metadata. */
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

/** The format of the data needed to create a new goal. */
export type GoalInput = Omit<
  Prisma.GoalCreateInput,
  'id' | 'createdAt' | 'updatedAt' | 'roadmap' | 'author' | 'dataSeries' | 'baselineDataSeries' |
  'links' | 'comments' | 'actions' | 'combinationParents' | 'combinationChildren'
> & {
  // This will be turned into an actual dataSeries object by the API
  // The expected input is a stringified array of floats
  dataSeries: string[];
  baselineDataSeries?: string[] | undefined;
  // The unit of measurement for the data series
  dataUnit: string;
  // Scale of the data, for example "millions"
  // Deprecated, please bake the scale into the data series values or unit
  // For example {value: 10, scale: "thousands"} => {value: 10000}
  // or {scale: "millions", unit: "kW"} => {unit: "GW"}
  dataScale?: string | undefined;
  // Array of IDs of goals for combinationParents
  inheritFrom?: { id: string, isInverted?: boolean }[];
  links?: { url: string, description?: string }[] | undefined;
};

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