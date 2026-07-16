import type { DateValues, DateValuesWithUnit, ISOIshDate, JSONValue, UnitString, GoalCreateInput, GoalUpdateInput, MetaRoadmapCreateInput, MetaRoadmapUpdateInput } from "@/types";
import { GoalDataTarget } from "./enums";

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

export function isStandardObject(object: unknown): object is object {
  return typeof object === "object" && object != null && !Array.isArray(object);
}

export function tryParseJSON(value: unknown): { ok: true; value: unknown } | { ok: false } {
  if (typeof value !== "string") return { ok: true, value };
  try {
    return { ok: true, value: JSON.parse(value) };
  } catch {
    return { ok: false };
  }
}

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
  return /^\d{4}-\d{2}-\d{2}T00:00:00(?:\.000)?Z$/.test(dateString);
}

export function isDateValuesWithUnit(dateValues: JSONValue): dateValues is DateValuesWithUnit {
  return (
    isStandardObject(dateValues)
    && 'dateValues' in dateValues
    && typeof dateValues.dateValues === 'object'
    && !Array.isArray(dateValues)
    && isDateValues(dateValues.dateValues)
    && isUnitString(dateValues.unit)
  );
}

/** 
 * WARNING! also mutates and deserializes the input goal object!
 */
// ── Goal request validators ──────────────────────────────────────────────────
// The goal API body is a discriminated union tagged by `target`. We trust the
// tag only to decide which validation to run — each validator still checks every
// field of its section. Validators mutate `goal` in place (JSON-parsing the
// DateValuesWithUnit fields), matching the legacy behaviour the route relies on.

/** True for `string | null | undefined`. */
function isStringOrNullish(value: unknown): boolean {
  return typeof value === 'string' || value === null || value === undefined;
}

/** True for `string[] | null | undefined`. */
function isStringArrayOrNullish(value: unknown): boolean {
  return value === null || value === undefined || (Array.isArray(value) && value.every(item => typeof item === "string"));
}

/** Validates an optional serialized-recipe field (`string | null | undefined`). */
function validateRecipeField(goal: Record<string, unknown>, key: string): boolean {
  if (key in goal && !isStringOrNullish(goal[key])) {
    console.debug(`optional goal parameter "${key}" is neither nullish nor a serialized recipe string`);
    return false;
  }
  return true;
}

/** Validates and JSON-parses (mutating `goal[key]`) a DateValuesWithUnit field. */
function validateDateValuesField(goal: Record<string, unknown>, key: string, required: boolean): boolean {
  if (!(key in goal)) {
    if (required) {
      console.debug(`goal missing required parameter "${key}"`);
      return false;
    }
    return true;
  }
  const parsed = tryParseJSON(goal[key]);
  if (!parsed.ok) {
    console.debug(`failed to parse goal parameter "${key}" as JSON`);
    return false;
  }
  goal[key] = parsed.value;
  const value = goal[key];
  if (value === null || value === undefined) {
    if (required) {
      console.debug(`goal parameter "${key}" is required and cannot be null`);
      return false;
    }
    return true;
  }
  if (!(isStandardObject(value) && isDateValuesWithUnit(value as JSONValue))) {
    console.debug(`goal parameter "${key}" is not a valid DateValuesWithUnit`);
    return false;
  }
  return true;
}

/** Validates the shared goal metadata (all optional; `indicatorParameter` is validated per-variant). */
function validateGoalMetaFields(goal: Record<string, unknown>): boolean {
  if ("name" in goal && !isStringOrNullish(goal.name)) {
    console.debug(`optional goal parameter "name" has wrong type: ${typeof goal.name}`);
    return false;
  }
  if ("description" in goal && !isStringOrNullish(goal.description)) {
    console.debug(`optional goal parameter "description" has wrong type: ${typeof goal.description}`);
    return false;
  }
  if ("isFeatured" in goal && !(typeof goal.isFeatured === 'boolean' || goal.isFeatured === undefined)) {
    console.debug(`optional goal parameter "isFeatured" has wrong type: ${typeof goal.isFeatured}`);
    return false;
  }
  if ("rawTags" in goal && !isStringArrayOrNullish(goal.rawTags)) {
    console.debug(`optional goal parameter "rawTags" has wrong type: ${typeof goal.rawTags}`);
    return false;
  }
  // links: { url: string, description?: string | null }[] | null | undefined; (deprecated, TODO remove)
  if ("links" in goal && !(
    goal.links === undefined
    || goal.links === null
    || (
      Array.isArray(goal.links)
      && goal.links.every(link =>
        isStandardObject(link)
        && "url" in link && typeof link.url === 'string'
        && (!("description" in link) || typeof link.description === 'string' || link.description === null),
      )
    )
  )) {
    console.debug(`optional goal parameter "links" has wrong type`);
    return false;
  }
  return true;
}

/** Validates the data series section. `dataSeries` is required only on full create. */
function validateDataSeriesFields(goal: Record<string, unknown>, dataSeriesRequired: boolean): boolean {
  if (!validateDateValuesField(goal, "dataSeries", dataSeriesRequired)) return false;
  if ("dataSeriesId" in goal && !isStringOrNullish(goal.dataSeriesId)) {
    console.debug(`optional goal parameter "dataSeriesId" has wrong type`);
    return false;
  }
  if (!validateRecipeField(goal, "dataSeriesRecipe")) return false;
  if ("dataSeriesRecipeId" in goal && !isStringOrNullish(goal.dataSeriesRecipeId)) {
    console.debug(`optional goal parameter "dataSeriesRecipeId" has wrong type`);
    return false;
  }
  return true;
}

/** Validates the baseline section. */
function validateBaselineFields(goal: Record<string, unknown>): boolean {
  if (!validateDateValuesField(goal, "baseline", false)) return false;
  if ("baselineId" in goal && !isStringOrNullish(goal.baselineId)) {
    console.debug(`optional goal parameter "baselineId" has wrong type`);
    return false;
  }
  if (!validateRecipeField(goal, "baselineRecipe")) return false;
  if ("baselineRecipeId" in goal && !isStringOrNullish(goal.baselineRecipeId)) {
    console.debug(`optional goal parameter "baselineRecipeId" has wrong type`);
    return false;
  }
  return true;
}

/** Validates the historical section. */
function validateHistoricalFields(goal: Record<string, unknown>): boolean {
  if (!validateDateValuesField(goal, "historical", false)) return false;
  if ("historicalId" in goal && !isStringOrNullish(goal.historicalId)) {
    console.debug(`optional goal parameter "historicalId" has wrong type`);
    return false;
  }
  if (!validateRecipeField(goal, "historicalRecipe")) return false;
  if ("historicalRecipeId" in goal && !isStringOrNullish(goal.historicalRecipeId)) {
    console.debug(`optional goal parameter "historicalRecipeId" has wrong type`);
    return false;
  }
  return true;
}

/** Validates the recipe-suggestions section (an array of serialized recipe strings). */
function validateRecipeSuggestionsFields(goal: Record<string, unknown>): boolean {
  if ("recipeSuggestions" in goal && !isStringArrayOrNullish(goal.recipeSuggestions)) {
    console.debug(`optional goal parameter "recipeSuggestions" has wrong type: ${typeof goal.recipeSuggestions}`);
    return false;
  }
  return true;
}

/** Identity for a request targeting a single section of an existing goal. */
function validateSectionIdentity(goal: Record<string, unknown>): boolean {
  if (typeof goal.goalId !== 'string') {
    console.debug(`goal section request missing required "goalId" or it is not a string`);
    return false;
  }
  if (typeof goal.timestamp !== 'number') {
    console.debug(`goal section request missing required "timestamp" or it is not a number`);
    return false;
  }
  if ("roadmapId" in goal && goal.roadmapId !== undefined) {
    console.debug(`goal section request tries to set "roadmapId", which is not allowed`);
    return false;
  }
  return true;
}

/** True if `value` is one of the GoalDataTarget discriminator values. */
function isGoalDataTarget(value: unknown): value is GoalDataTarget {
  return typeof value === 'string' && (Object.values(GoalDataTarget) as string[]).includes(value);
}

/**
 * WARNING! Also mutates and deserializes the input goal object (JSON-parses the
 * DateValuesWithUnit fields in place).
 */
export function isGoalCreate(goal: unknown): goal is GoalCreateInput {
  if (!isStandardObject(goal)) return false;
  const g = goal as Record<string, unknown>;

  if (!isGoalDataTarget(g.target)) {
    console.debug(`goal create missing/invalid discriminator "target"`);
    return false;
  }

  switch (g.target) {
    case GoalDataTarget.Full: {
      // goalId?: never; timestamp?: never;
      if ("goalId" in g && g.goalId !== undefined) {
        console.debug(`goal tries to define its own "goalId" during creation`);
        return false;
      }
      if ("timestamp" in g && g.timestamp !== undefined) {
        console.debug(`goal sends "timestamp" during creation`);
        return false;
      }
      // roadmapId: string;
      if (typeof g.roadmapId !== 'string') {
        console.debug(`goal missing required parameter "roadmapId" or it is not a string`);
        return false;
      }
      // indicatorParameter: string; (required on create)
      if (typeof g.indicatorParameter !== 'string') {
        console.debug(`goal missing required parameter "indicatorParameter" or it is not a string`);
        return false;
      }
      return validateGoalMetaFields(g)
        && validateDataSeriesFields(g, true)
        && validateBaselineFields(g)
        && validateHistoricalFields(g)
        && validateRecipeSuggestionsFields(g);
    }
    case GoalDataTarget.DataSeries: {
      return validateSectionIdentity(g) && validateDataSeriesFields(g, false);
    }
    case GoalDataTarget.Baseline: {
      return validateSectionIdentity(g) && validateBaselineFields(g);
    }
    case GoalDataTarget.Historical: {
      return validateSectionIdentity(g) && validateHistoricalFields(g);
    }
    case GoalDataTarget.RecipeSuggestions: {
      return validateSectionIdentity(g) && validateRecipeSuggestionsFields(g);
    }
    default: {
      const _exhaustive: never = g.target;
      return _exhaustive;
    }
  }
}

/** 
 * WARNING! also mutates and deserializes the input goal object!
 */
export function isGoalUpdate(goal: unknown): goal is GoalUpdateInput {
  if (!isStandardObject(goal)) return false;
  const g = goal as Record<string, unknown>;

  if (!isGoalDataTarget(g.target)) {
    console.debug(`goal update missing/invalid discriminator "target"`);
    return false;
  }

  switch (g.target) {
    case GoalDataTarget.Full: {
      // goalId + timestamp + no roadmapId
      if (!validateSectionIdentity(g)) return false;
      // indicatorParameter: string | undefined;
      if ("indicatorParameter" in g && !(typeof g.indicatorParameter === 'string' || g.indicatorParameter === undefined)) {
        console.debug(`goal parameter "indicatorParameter" has wrong type: ${typeof g.indicatorParameter}`);
        return false;
      }
      return validateGoalMetaFields(g)
        && validateDataSeriesFields(g, false)
        && validateBaselineFields(g)
        && validateHistoricalFields(g)
        && validateRecipeSuggestionsFields(g);
    }
    case GoalDataTarget.DataSeries: {
      return validateSectionIdentity(g) && validateDataSeriesFields(g, false);
    }
    case GoalDataTarget.Baseline: {
      return validateSectionIdentity(g) && validateBaselineFields(g);
    }
    case GoalDataTarget.Historical: {
      return validateSectionIdentity(g) && validateHistoricalFields(g);
    }
    case GoalDataTarget.RecipeSuggestions: {
      return validateSectionIdentity(g) && validateRecipeSuggestionsFields(g);
    }
    default: {
      const _exhaustive: never = g.target;
      return _exhaustive;
    }
  }
}

export function isMetaRoadmapCreate(metaRoadmap: JSONValue): metaRoadmap is MetaRoadmapCreateInput {
  return (
    (
      typeof metaRoadmap === 'object' &&
      metaRoadmap !== null &&
      !Array.isArray(metaRoadmap)
    ) &&

    // name: string;
    (
      typeof metaRoadmap.name === 'string'
    ) &&

    // description: string;
    (
      typeof metaRoadmap.description === 'string'
    ) &&

    // type: RoadmapType | undefined;
    // We cast an unchecked string to RoadmapType, so it has to be validated later
    (
      typeof metaRoadmap.type === 'string' ||
      metaRoadmap.type === undefined
    ) &&

    // actor: string | null | undefined;
    (
      typeof metaRoadmap.actor === 'string' ||
      metaRoadmap.actor === null ||
      metaRoadmap.actor === undefined
    ) &&

    // isPublic: boolean | undefined;
    (
      typeof metaRoadmap.isPublic === 'boolean' ||
      metaRoadmap.isPublic === undefined
    ) &&

    // editors: string[] | null | undefined;
    (
      metaRoadmap.editors === null ||
      metaRoadmap.editors === undefined ||
      (
        Array.isArray(metaRoadmap.editors) &&
        metaRoadmap.editors.every(name => typeof name === 'string')
      )
    ) &&

    // viewers: string[] | null | undefined;
    (
      metaRoadmap.viewers === null ||
      metaRoadmap.viewers === undefined ||
      (
        Array.isArray(metaRoadmap.viewers) &&
        metaRoadmap.viewers.every(name => typeof name === 'string')
      )
    ) &&

    // editGroups: string[] | null | undefined;

    (
      metaRoadmap.editGroups === null ||
      metaRoadmap.editGroups === undefined ||
      (
        Array.isArray(metaRoadmap.editGroups) &&
        metaRoadmap.editGroups.every(group => typeof group === 'string')
      )
    ) &&

    // viewGroups: string[] | null | undefined;
    (
      metaRoadmap.viewGroups === null ||
      metaRoadmap.viewGroups === undefined ||
      (
        Array.isArray(metaRoadmap.viewGroups) &&
        metaRoadmap.viewGroups.every(group => typeof group === 'string')
      )
    ) &&

    // parentRoadmapId: string | null | undefined;
    (
      typeof metaRoadmap.parentRoadmapId === 'string' ||
      metaRoadmap.parentRoadmapId === null ||
      metaRoadmap.parentRoadmapId === undefined
    ) &&

    // TODO: Deprecated - will be moved to description
    // links: { url: string, description?: string | null }[] | null | undefined;
    (
      metaRoadmap.links === undefined ||
      metaRoadmap.links === null ||
      (
        Array.isArray(metaRoadmap.links) &&
        metaRoadmap.links.every((entry: JSONValue) => (
          (
            typeof entry === 'object' &&
            entry !== null &&
            !Array.isArray(entry)
          ) &&

          typeof entry.url === 'string' &&
          (
            typeof entry.description === 'string' ||
            entry.description === undefined
          )
        ))
      )
    )
  );
}

export function isMetaRoadmapUpdate(metaRoadmap: JSONValue): metaRoadmap is MetaRoadmapUpdateInput {
  return (
    (
      typeof metaRoadmap === 'object' &&
      metaRoadmap !== null &&
      !Array.isArray(metaRoadmap)
    ) &&

    // id: string;
    (
      typeof metaRoadmap.id === 'string'
    ) &&

    // name: string | undefined;
    (
      typeof metaRoadmap.name === 'string' ||
      metaRoadmap.name === undefined
    ) &&

    // description: string | undefined;
    (
      typeof metaRoadmap.description === 'string' ||
      metaRoadmap.description === undefined
    ) &&

    // type: RoadmapType | undefined;
    // We cast an unchecked string to RoadmapType, so it has to be validated later
    (
      typeof metaRoadmap.type === 'string' ||
      metaRoadmap.type === undefined
    ) &&

    // actor: string | null | undefined;
    (
      typeof metaRoadmap.actor === 'string' ||
      metaRoadmap.actor === null ||
      metaRoadmap.actor === undefined
    ) &&

    // isPublic: boolean | undefined;
    (
      typeof metaRoadmap.isPublic === 'boolean' ||
      metaRoadmap.isPublic === undefined
    ) &&

    // editors: string[] | null | undefined;
    (
      metaRoadmap.editors === null ||
      metaRoadmap.editors === undefined ||
      (
        Array.isArray(metaRoadmap.editors) &&
        metaRoadmap.editors.every(name => typeof name === 'string')
      )
    ) &&

    // viewers: string[] | null | undefined;
    (
      metaRoadmap.viewers === null ||
      metaRoadmap.viewers === undefined ||
      (
        Array.isArray(metaRoadmap.viewers) &&
        metaRoadmap.viewers.every(name => typeof name === 'string')
      )
    ) &&

    // editGroups: string[] | null | undefined;
    (
      metaRoadmap.editGroups === null ||
      metaRoadmap.editGroups === undefined ||
      (
        Array.isArray(metaRoadmap.editGroups) &&
        metaRoadmap.editGroups.every(group => typeof group === 'string')
      )
    ) &&

    // viewGroups: string[] | null | undefined;
    (
      metaRoadmap.viewGroups === null ||
      metaRoadmap.viewGroups === undefined ||
      (
        Array.isArray(metaRoadmap.viewGroups) &&
        metaRoadmap.viewGroups.every(group => typeof group === 'string')
      )
    ) &&

    // parentRoadmapId: string | null | undefined;
    (
      typeof metaRoadmap.parentRoadmapId === 'string' ||
      metaRoadmap.parentRoadmapId === null ||
      metaRoadmap.parentRoadmapId === undefined
    ) &&

    // timestamp: number;
    (
      ("timestamp" in metaRoadmap) &&
      typeof metaRoadmap.timestamp === 'number'
    ) &&

    // TODO: Deprecated - will be moved to description
    // links: { url: string, description?: string | null }[] | null | undefined;
    (
      metaRoadmap.links === undefined ||
      metaRoadmap.links === null ||
      (
        Array.isArray(metaRoadmap.links) &&
        metaRoadmap.links.every((entry: JSONValue) => (
          (
            typeof entry === 'object' &&
            entry !== null &&
            !Array.isArray(entry)
          ) &&

          typeof entry.url === 'string' &&
          (
            typeof entry.description === 'string' ||
            entry.description === undefined
          )
        ))
      )
    )
  );
}
