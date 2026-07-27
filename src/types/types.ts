import type { actionInclusionSelection, clientSafeDataSeriesSelection, clientSafeGoalSelection, clientSafeMultiRoadmapSelection, clientSafeRoadmapSelection, effectInclusionSelection, goalInclusionSelection, metaRoadmapInclusionSelection, multiRoadmapInclusionSelection, nameSelector, recipeSelector, roadmapInclusionSelection, userInfoSelector } from "@/fetchers/inclusionSelectors";
import type { Unit as MathJSUnit } from "mathjs";
import type { Prisma } from "@/lib/prisma/generated";

/** An object that implements the AccessControlled interface can be checked with the accessChecker function. */
export type AccessControlled = {
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

export type UserInfo = Prisma.UserGetPayload<{
  select: typeof userInfoSelector
}>;

export type DataSeries = Prisma.DataSeriesGetPayload<{
  select: typeof clientSafeDataSeriesSelection
}>;

export type DBRecipe = Prisma.RecipeGetPayload<{
  select: typeof recipeSelector,
}>;

/** The goal fields `goalsToTree` needs, and that its consumers render. */
export type GoalTreeEntry = Pick<Goal, "id" | "name" | "indicatorParameter" | "dataSeries">;

/** A nested tree of goals keyed by the segments of their indicator parameters. */
export type GoalTree = { [key: string]: GoalTree | GoalTreeEntry };

/** The information we store in our session cookie. */
export type LoginData = {
  user?: {
    id: string;
    username: string;
    isLoggedIn?: boolean;
    isAdmin?: boolean;
    userGroups: string[];
  };
};

export type UnitString = string | null | undefined;
export type ISOIshDate = `${number}-${number}-${number}T00:00:00${`.000` | ``}Z`;
/** True: missing value, False: defined value. It masks/"covers" the undefined values */
export type Mask = Record<ISOIshDate, boolean>;
export type DateValues = Record<ISOIshDate, number>;
export type DateValuesWithUnit = { dateValues: DateValues, unit: UnitString };
export type MaskedVector = { vector: MathJSUnit[], mask: Mask };