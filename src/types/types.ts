import type { IterationStatus, OrgRole, Prisma } from "@/lib/prisma/generated";
import type { accessControlSelection, actionInclusionSelection, clientSafeDataSeriesSelection, clientSafeGoalSelection, clientSafeMultiRoadmapSelection, clientSafeRoadmapIterationSelection, effectInclusionSelection, goalInclusionSelection, multiRoadmapInclusionSelection, nameSelector, recipeSelector, roadmapInclusionSelection, roadmapIterationInclusionSelection, userInfoSelector } from "@/fetchers/inclusionSelectors";
import type { Unit as MathJSUnit } from "mathjs";
import type { UnitFlags } from "@/types/enums";
import type { DataSeriesVariable, ExternalVariable } from "@/functions/recipe/types";

/** The access control record shape consumed by accessChecker, as selected by `accessControlSelection`. */
export type AccessControlInfo = Prisma.AccessControlsGetPayload<{
  select: typeof accessControlSelection
}>;

/** An object that implements the AccessControlled interface can be checked with the accessChecker function. */
export type AccessControlled = {
  access_control: AccessControlInfo,
  /**
   * Present when checking a roadmap version (or something inheriting from one):
   * DRAFT requires edit access to see at all. Omitted (a roadmap itself) means no such gate.
   */
  status?: IterationStatus,
};

/**
 * A type used by the breadcrumbs component to display the names of objects rather than their UUIDs.
 */
export type GenericEntry = (
  {
    // Actions and Roadmaps
    id: string,
    name: string,
    indicator_parameter?: never,
    roadmap?: never,
  } |
  {
    // Goals
    id: string,
    name?: string | null,
    indicator_parameter: string,
    roadmap?: never,
  } |
  {
    // RoadmapIterations
    id: string,
    name?: never,
    indicator_parameter?: never,
    roadmap: { name: string },
  }
);

/** The return type of JSON.parse */
export type JSONValue = Partial<{ [key: string]: JSONValue }> | JSONValue[] | string | number | boolean | null;

// Usually part of an array with the type NameObject[]
export type NameObject = Prisma.RoadmapsGetPayload<{
  select: typeof nameSelector
}>;

export type Roadmap = Prisma.RoadmapsGetPayload<{
  include: typeof roadmapInclusionSelection
}>;

export type RoadmapIteration = Prisma.RoadmapIterationsGetPayload<{
  include: typeof roadmapIterationInclusionSelection
}>;

export type ClientRoadmapIteration = Prisma.RoadmapIterationsGetPayload<{
  select: typeof clientSafeRoadmapIterationSelection
}>;

// Will usually be part of an array with the type MultiRoadmapInstance[]
export type MultiRoadmapInstance = Prisma.RoadmapIterationsGetPayload<{
  include: typeof multiRoadmapInclusionSelection
}>;

// Will usually be part of an array with the type ClientMultiRoadmapInstance[]
export type ClientMultiRoadmapInstance = Prisma.RoadmapIterationsGetPayload<{
  select: typeof clientSafeMultiRoadmapSelection
}>;

export type Goal = Prisma.GoalsGetPayload<{
  include: typeof goalInclusionSelection
}>;

export type ClientGoal = Prisma.GoalsGetPayload<{
  select: typeof clientSafeGoalSelection
}>;

export type Action = Prisma.ActionsGetPayload<{
  include: typeof actionInclusionSelection
}>;

export type Effect = Prisma.EffectsGetPayload<{
  include: typeof effectInclusionSelection
}>;

export type UserInfo = Prisma.UsersGetPayload<{
  select: typeof userInfoSelector
}>;

export type DataSeries = Prisma.DataSeriesGetPayload<{
  select: typeof clientSafeDataSeriesSelection
}>;

export type DBRecipe = Prisma.RecipesGetPayload<{
  select: typeof recipeSelector,
}>;

/** The goal fields `goalsToTree` needs, and that its consumers render. */
export type GoalTreeEntry = Pick<Goal, "id" | "name" | "indicator_parameter" | "data_series">;

/** A nested tree of goals keyed by the segments of their indicator parameters. */
export type GoalTree = { [key: string]: GoalTree | GoalTreeEntry };

/**
 * The information we store in our session cookie.
 * Org/group memberships are deliberately NOT stored here: managers can edit groups
 * and grants at any time, so memberships are fetched fresh per request (as a
 * `UserAccessContext`) instead of being frozen into the cookie until re-login.
 */
export type LoginData = {
  user?: {
    id: string;
    username: string;
    isLoggedIn?: boolean;
    isSuperAdmin?: boolean;
  };
};

/**
 * A user's org and group memberships, fetched per request and consumed by
 * accessChecker together with an `AccessControlled` item.
 */
export type UserAccessContext = {
  id: string;
  username: string;
  isSuperAdmin: boolean;
  memberships: {
    orgId: string;
    role: OrgRole;
    groupIds: string[];
  }[];
};

/**
 * `"" -> MISSING_UNIT`
 * `null -> UNITLESS`
 * `string -> the string itself`
 */
export type Unit = string & { __unitStringBrand: never } | typeof UnitFlags[keyof typeof UnitFlags];
export type ISOIshDate = `${number}-${number}-${number}T00:00:00${`.000` | ``}Z`;
/** True: missing value, False: defined value. It masks/"covers" the undefined values */
export type Mask = Record<ISOIshDate, boolean>;
export type DateValues = Record<ISOIshDate, number>;
export type DateValuesWithUnit = { dateValues: DateValues, unit: Unit };
export type MaskedVector = { vector: MathJSUnit[], mask: Mask };

/**
 * A series handed to the goal form to start a goal from, e.g. a browsable
 * historical series resolved from a link (see `resolveSeriesRef`). The
 * variable reads the series the way a recipe would (an external source today;
 * a stored data series once a data lab publishes its own), so the form can seed
 * both the historical data and the goal's recipe with it.
 */
export type PrefilledSeries = {
  name: string;
  /** Display unit as declared by the source, if it has one. */
  unit: string | null;
  variable: ExternalVariable | DataSeriesVariable;
};
