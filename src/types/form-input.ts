import type { SerializedRecipe } from "@/functions/recipe";
import type { AccessLevel, ActionFieldType, ActionImpactType, GoalListing, IterationStatus, RoadmapType, Sharing } from "@/lib/prisma/generated";
import type { DateValuesWithUnit } from "@/types";
// Imported as a value (not `import type`) because it's used in `typeof GoalDataTarget.*` queries below.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { GoalDataTarget } from "@/types/enums";

/**
 * Sharing settings for an access control. On create this is the initial sharing set
 * by the creator; on update only org managers (and super admins) may send it.
 * `sharing: PUBLIC` is only honored for managers/super admins even on create.
 */
export type AccessControlInput = {
  /** Who may read; PUBLIC is only honored for managers/super admins (downgraded to ORG otherwise) */
  sharing: Sharing | undefined;
  /** Full replacement set of group grants; the groups must belong to the owning org. */
  grants: { groupId: string, accessLevel: AccessLevel }[] | null | undefined;
};

/** The format of data needed to create a new roadmap (the top level; iterations are created separately). */
export type RoadmapCreateInput = {
  // To differentiate between create and update
  id?: never,
  timestamp?: never,

  name: string,
  description: string,
  type: RoadmapType | undefined,
  /** Free-text display label for the target of the roadmap */
  actor: string | null | undefined,
  /** SCB region code from the GeoAreas table (structured geo marker) */
  geoAreaCode: string | null | undefined,

  /** The org that will own the roadmap; the user must be a non-guest member (or super admin) */
  orgId: string,

  /** Initial sharing settings */
  access: AccessControlInput | undefined,

  // UUID for the parent roadmap (if any)
  parentRoadmapId: string | null | undefined,
}

/** The format of data allowed to update an existing roadmap. Undefined fields are left unchanged. */
export type RoadmapUpdateInput = {
  id: string,
  name: string | undefined,
  description: string | undefined,
  type: RoadmapType | undefined,
  actor: string | null | undefined,
  geoAreaCode: string | null | undefined,

  /** The owning org cannot be changed */
  orgId?: never,

  /** Sharing settings; only org managers and super admins may send this */
  access: AccessControlInput | undefined,

  // UUID for the parent roadmap (if any)
  parentRoadmapId: string | null | undefined,

  // Timestamp to check if the user is trying to update based on stale data
  timestamp: number,
}

/**
 * The format of the data needed to create a new roadmap iteration.
 */
export type RoadmapIterationCreateInput = {
  // To differentiate between create and update
  iterationId?: never;
  timestamp?: never; // Not needed when creating

  // version: number;  // Assigned by the API

  // Basic meta
  targetVersion: number | null | undefined;
  description: string | null | undefined;
  /** Draft (editors only) / unlisted (by link) / published (listed); defaults to draft */
  status: IterationStatus | undefined;

  // Relations
  /** The roadmap this is an iteration of */
  roadmapId: string;
  // Nested goals are always created in full (a new goal needs its data series etc.)
  goals: GoalCreateFull[] | null | undefined;

  // Access control lives on the parent roadmap
};

/**
 * The format of the data allowed to update an existing roadmap iteration.
 */
export type RoadmapIterationUpdateInput = {
  // Required to find this iteration
  iterationId: string;

  // Stale data check
  timestamp: number; // From Date.now() i.e. milliseconds since epoch

  // Basic meta
  description: string | null | undefined;
  targetVersion: number | null | undefined;
  /** Draft / unlisted / published; undefined leaves it unchanged */
  status: IterationStatus | undefined;

  // Relations
  roadmapId?: never; // Can't reassign the roadmap of an existing iteration. IT WOULD BE MAYHEM.
  // Nested goals are always created in full (a new goal needs its data series etc.)
  goals: GoalCreateFull[] | null | undefined;

  // Access control lives on the parent roadmap
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
  /** Listed / unlisted / featured; undefined leaves it unchanged (defaults to listed on create) */
  listing: GoalListing | undefined;
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
  iterationId?: never; // Sectional requests can't (re)assign a roadmap iteration
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
  iterationId: string; // The roadmap iteration the goal belongs to
  indicatorParameter: string; // Required on create
  dataSeries: DateValuesWithUnit; // Required on create
} & GoalMetaFields & DataSeriesFields & BaselineFields & HistoricalFields & RecipeSuggestionsFields;

/** Update every section of an existing goal at once. */
export type GoalUpdateFull = {
  target: typeof GoalDataTarget.Full;
  goalId: string;
  timestamp: number; // Stale data check; from Date.now() i.e. milliseconds since epoch
  iterationId?: never; // Can't reassign the roadmap iteration of an existing goal
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
  /** The roadmap iteration the action belongs to; omitted for roadmapless actions (the public action database) */
  iterationId: string | undefined;
  /** The org that will own the action. Required when `iterationId` is omitted; otherwise derived from the iteration's roadmap. */
  orgId: string | undefined;
  goalId: string | undefined;

  name: string;
  /** Tree placement like "Some\Tree\Structure"; falls back to the name */
  indicatorParameter: string | undefined;
  startYear: number | null | undefined;
  endYear: number | null | undefined;

  /**
   * Free-form descriptive fields, replacing the old fixed columns
   * (description, cost efficiency, expected outcome, project manager, relevant actors...).
   * A full set replacing the current one; `null`/`[]` clears it, `undefined` leaves it unchanged.
   */
  fields: { header: string, value: string, type: ActionFieldType }[] | null | undefined;

  /** Action to inherit from, if any */
  parentActionId: string | null | undefined;

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