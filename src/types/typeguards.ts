import type { DateValues, DateValuesWithUnit, ISOIshDate, JSONValue, UnitString, GoalCreateInput, GoalUpdateInput, MetaRoadmapCreateInput, MetaRoadmapUpdateInput } from "@/types";

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
  return /^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/.test(dateString);
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
export function isGoalCreate(goal: unknown): goal is GoalCreateInput {
  if (!isStandardObject(goal)) return false;

  // goalId?: never;
  if ("goalId" in goal && goal.goalId !== undefined) {
    console.log(`goal tries to define its own "goalId" during creation`);
    return false;
  }

  // timestamp?: never;
  // Should probably allow timestamps and silently drop them instead
  if ("timestamp" in goal && goal.timestamp !== undefined) {
    console.log(`goal sends "timestamp" during creation`);
    return false;
  }

  // roadmapId: string;
  if (!("roadmapId" in goal) || typeof goal.roadmapId !== 'string') {
    console.log(`goal missing required parameter "roadmapId" or "roadmapId" is not a string`);
    return false;
  }

  // indicatorParameter: string;
  if (!("indicatorParameter" in goal) || typeof goal.indicatorParameter !== 'string') {
    console.log(`goal missing required parameter "indicatorParameter" or "indicatorParameter" is not a string`);
    return false;
  }

  // name: string | null | undefined;
  if ("name" in goal && !(typeof goal.name === 'string' || goal.name === null || goal.name === undefined)) {
    console.log(`optional goal parameter "name" has wrong type: ${typeof goal.name}`);
    return false;
  }

  // description: string | null | undefined;
  if ("description" in goal && !(typeof goal.description === 'string' || goal.description === null || goal.description === undefined)) {
    console.log(`optional goal parameter "description" has wrong type: ${typeof goal.description}`);
    return false;
  }

  // isFeatured: boolean | undefined;
  if ("isFeatured" in goal && !(typeof goal.isFeatured === 'boolean' || goal.isFeatured === undefined)) {
    console.log(`optional goal parameter "isFeatured" has wrong type: ${typeof goal.isFeatured}`);
    return false;
  }

  // externalDataset: string | null | undefined;
  if ("externalDataset" in goal && !(typeof goal.externalDataset === 'string' || goal.externalDataset === null || goal.externalDataset === undefined)) {
    console.log(`optional goal parameter "externalDataset" has wrong type: ${typeof goal.externalDataset}`);
    return false;
  }

  // externalTableId: string | null | undefined;
  if ("externalTableId" in goal && !(typeof goal.externalTableId === 'string' || goal.externalTableId === null || goal.externalTableId === undefined)) {
    console.log(`optional goal parameter "externalTableId" has wrong type: ${typeof goal.externalTableId}`);
    return false;
  }

  // externalSelection: string | null | undefined;
  if ("externalSelection" in goal && !(typeof goal.externalSelection === 'string' || goal.externalSelection === null || goal.externalSelection === undefined)) {
    console.log(`optional goal parameter "externalSelection" has wrong type: ${typeof goal.externalSelection}`);
    return false;
  }

  // recipeSuggestions: SerializedRecipe[] | null | undefined;
  if ("recipeSuggestions" in goal && !(
    (
      Array.isArray(goal.recipeSuggestions)
      && goal.recipeSuggestions.every(recipe => typeof recipe === "string")
    )
    || goal.recipeSuggestions === null
    || goal.recipeSuggestions === undefined
  )) {
    console.log(`optional goal parameter "recipeSuggestions" has wrong type: ${typeof goal.recipeSuggestions}`);
    return false;
  }

  // dataSeries: DateValuesWithUnit;
  if (!("dataSeries" in goal)) {
    console.log(`goal missing required parameter "dataSeries"`);
    return false;
  }
  {
    const parsed = tryParseJSON(goal.dataSeries);
    if (!parsed.ok) {
      console.log(`failed to parse goal parameter "dataSeries" as JSON`);
      return false;
    }
    goal.dataSeries = parsed.value as GoalCreateInput["dataSeries"];
  }
  if (!(
    isStandardObject(goal.dataSeries)
    && isDateValuesWithUnit(goal.dataSeries)
  )) {
    console.log(`goal parameter "dataSeries" is not a valid DateValuesWithUnit`);
    return false;
  }

  // dataSeriesId: string | null | undefined;
  if ("dataSeriesId" in goal && !(typeof goal.dataSeriesId === 'string' || goal.dataSeriesId === null || goal.dataSeriesId === undefined)) {
    console.log(`optional goal parameter "dataSeriesId" has wrong type`);
    return false;
  }

  // dataSeriesRecipe: SerializedRecipe | null | undefined;
  if ("dataSeriesRecipe" in goal) {
    if (!(
      goal.dataSeriesRecipe === null
      || goal.dataSeriesRecipe === undefined
      || typeof goal.dataSeriesRecipe === "string"
    )) {
      console.log(`optional goal parameter "dataSeriesRecipe" is neither nullish nor a serialized recipe string`);
      return false;
    }
  }

  // dataSeriesRecipeId: string | null | undefined;
  if ("dataSeriesRecipeId" in goal && !(typeof goal.dataSeriesRecipeId === 'string' || goal.dataSeriesRecipeId === null || goal.dataSeriesRecipeId === undefined)) {
    console.log(`optional goal parameter "dataSeriesRecipeId" has wrong type: ${typeof goal.dataSeriesRecipeId}`);
    return false;
  }

  // baseline: DateValuesWithUnit | null | undefined;
  if ("baseline" in goal) {
    {
      const parsed = tryParseJSON(goal.baseline);
      if (!parsed.ok) {
        console.log(`failed to parse goal parameter "baseline" as JSON`);
        return false;
      }
      goal.baseline = parsed.value as GoalCreateInput["baseline"];
    }
    if (!(
      goal.baseline === null
      || goal.baseline === undefined
      || isStandardObject(goal.baseline)
      && isDateValuesWithUnit(goal.baseline)
    )) {
      console.log(`optional goal parameter "baseline" is neither nullish nor a valid DateValuesWithUnit`);
      return false;
    }
  }

  // baselineId: string | null | undefined;
  if ("baselineId" in goal && !(typeof goal.baselineId === 'string' || goal.baselineId === null || goal.baselineId === undefined)) {
    console.log(`optional goal parameter "baselineId" has wrong type: ${typeof goal.baselineId}`);
    return false;
  }

  // baselineRecipe: SerializedRecipe | null | undefined;
  if ("baselineRecipe" in goal) {
    if (!(
      goal.baselineRecipe === null
      || goal.baselineRecipe === undefined
      || typeof goal.baselineRecipe === "string"
    )) {
      console.log(`optional goal parameter "baselineRecipe" is neither nullish nor a serialized recipe string`);
      return false;
    }
  }

  // baselineRecipeId: string | null | undefined;
  if ("baselineRecipeId" in goal && !(typeof goal.baselineRecipeId === 'string' || goal.baselineRecipeId === null || goal.baselineRecipeId === undefined)) {
    console.log(`optional goal parameter "baselineRecipeId" has wrong type: ${typeof goal.baselineRecipeId}`);
    return false;
  }

  // rawTags: string[] | null | undefined;
  if ("rawTags" in goal && !(
    goal.rawTags === null
    || goal.rawTags === undefined
    || (
      Array.isArray(goal.rawTags)
      && goal.rawTags.every(tag => typeof tag === "string")
    )
  )) {
    console.log(`optional goal parameter "rawTags" has wrong type: ${typeof goal.rawTags}`);
    return false;
  }

  // links: { url: string, description?: string | null }[] | null | undefined;
  // deprecated
  // TODO: remove
  if ("links" in goal && !(
    goal.links === undefined
    || goal.links === null
    || (
      Array.isArray(goal.links)
      && goal.links.every(link =>
        isStandardObject(link)
        && "url" in link && typeof link.url === 'string'
        && (!("description" in link) || typeof link.description === 'string' || link.description === null)
      )
    )
  )) {
    console.log(`optional goal parameter "links" has wrong type`);
    return false;
  }

  return true;
}

/** 
 * WARNING! also mutates and deserializes the input goal object!
 */
export function isGoalUpdate(goal: unknown): goal is GoalUpdateInput {
  if (!isStandardObject(goal)) return false;

  // goalId: string;
  if (!("goalId" in goal) || typeof goal.goalId !== 'string') {
    console.log(`goal missing required parameter "goalId" or "goalId" is not a string`);
    return false;
  }

  // timestamp: number;
  if (!("timestamp" in goal) || typeof goal.timestamp !== 'number') {
    console.log(`goal missing required parameter "timestamp" or "timestamp" is not a number`);
    return false;
  }

  // roadmapId?: never;
  if ("roadmapId" in goal && goal.roadmapId !== undefined) {
    console.log(`goal tries to update "roadmapId", which is not allowed`);
    return false;
  }

  // indicatorParameter: string | undefined;
  if ("indicatorParameter" in goal && !(typeof goal.indicatorParameter === 'string' || goal.indicatorParameter === undefined)) {
    console.log(`goal parameter "indicatorParameter" has wrong type: ${typeof goal.indicatorParameter}`);
    return false;
  }

  // name: string | null | undefined;
  if ("name" in goal && !(typeof goal.name === 'string' || goal.name === null || goal.name === undefined)) {
    console.log(`optional goal parameter "name" has wrong type: ${typeof goal.name}`);
    return false;
  }

  // description: string | null | undefined;
  if ("description" in goal && !(typeof goal.description === 'string' || goal.description === null || goal.description === undefined)) {
    console.log(`optional goal parameter "description" has wrong type: ${typeof goal.description}`);
    return false;
  }

  // isFeatured: boolean | undefined;
  if ("isFeatured" in goal && !(typeof goal.isFeatured === 'boolean' || goal.isFeatured === undefined)) {
    console.log(`optional goal parameter "isFeatured" has wrong type: ${typeof goal.isFeatured}`);
    return false;
  }

  // externalDataset: string | null | undefined;
  if ("externalDataset" in goal && !(typeof goal.externalDataset === 'string' || goal.externalDataset === null || goal.externalDataset === undefined)) {
    console.log(`optional goal parameter "externalDataset" has wrong type: ${typeof goal.externalDataset}`);
    return false;
  }

  // externalTableId: string | null | undefined;
  if ("externalTableId" in goal && !(typeof goal.externalTableId === 'string' || goal.externalTableId === null || goal.externalTableId === undefined)) {
    console.log(`optional goal parameter "externalTableId" has wrong type: ${typeof goal.externalTableId}`);
    return false;
  }

  // externalSelection: string | null | undefined;
  if ("externalSelection" in goal && !(typeof goal.externalSelection === 'string' || goal.externalSelection === null || goal.externalSelection === undefined)) {
    console.log(`optional goal parameter "externalSelection" has wrong type: ${typeof goal.externalSelection}`);
    return false;
  }

  // recipeSuggestions: SerializedRecipe[] | null | undefined;
  if ("recipeSuggestions" in goal && !(
    (
      Array.isArray(goal.recipeSuggestions)
      && goal.recipeSuggestions.every(recipe => typeof recipe === "string")
    )
    || goal.recipeSuggestions === null
    || goal.recipeSuggestions === undefined
  )) {
    console.log(`optional goal parameter "recipeSuggestions" has wrong type: ${typeof goal.recipeSuggestions}`);
    return false;
  }

  // dataSeries: DateValuesWithUnit | null | undefined;
  if ("dataSeries" in goal) {
    const parsed = tryParseJSON(goal.dataSeries);
    if (!parsed.ok) {
      console.log(`failed to parse goal parameter "dataSeries" as JSON`);
      return false;
    }
    goal.dataSeries = parsed.value as GoalUpdateInput["dataSeries"];
    if (!(
      goal.dataSeries === null
      || goal.dataSeries === undefined
      || isStandardObject(goal.dataSeries)
      && isDateValuesWithUnit(goal.dataSeries)
    )) {
      console.log(`optional goal update parameter "dataSeries" is neither nullish nor a valid DateValuesWithUnit`);
      return false;
    }
  }

  // dataSeriesId: string | null | undefined;
  if ("dataSeriesId" in goal && !(typeof goal.dataSeriesId === 'string' || goal.dataSeriesId === null || goal.dataSeriesId === undefined)) {
    console.log(`optional goal update parameter "dataSeriesId" has wrong type: ${typeof goal.dataSeriesId}`);
    return false;
  }

  // dataSeriesRecipe: SerializedRecipe | null | undefined;
  if ("dataSeriesRecipe" in goal) {
    if (!(
      goal.dataSeriesRecipe === null
      || goal.dataSeriesRecipe === undefined
      || typeof goal.dataSeriesRecipe === "string"
    )) {
      console.log(`optional goal parameter "dataSeriesRecipe" is neither nullish nor a serialized recipe string`);
      return false;
    }
  }

  // dataSeriesRecipeId: string | null | undefined;
  if ("dataSeriesRecipeId" in goal && !(typeof goal.dataSeriesRecipeId === 'string' || goal.dataSeriesRecipeId === null || goal.dataSeriesRecipeId === undefined)) {
    console.log(`optional goal parameter "dataSeriesRecipeId" has wrong type: ${typeof goal.dataSeriesRecipeId}`);
    return false;
  }

  // baseline: DateValuesWithUnit | null | undefined;
  if ("baseline" in goal) {
    {
      const parsed = tryParseJSON(goal.baseline);
      if (!parsed.ok) {
        console.log(`failed to parse goal parameter "baseline" as JSON`);
        return false;
      }
      goal.baseline = parsed.value as GoalUpdateInput["baseline"];
    }
    if (!(
      goal.baseline === null
      || goal.baseline === undefined
      || isStandardObject(goal.baseline)
      && isDateValuesWithUnit(goal.baseline)
    )) {
      console.log(`optional goal parameter "baseline" is neither nullish nor a valid DateValuesWithUnit`);
      return false;
    }
  }

  // baselineId: string | null | undefined;
  if ("baselineId" in goal && !(typeof goal.baselineId === 'string' || goal.baselineId === null || goal.baselineId === undefined)) {
    console.log(`optional goal parameter "baselineId" has wrong type: ${typeof goal.baselineId}`);
    return false;
  }

  // baselineRecipe: SerializedRecipe | null | undefined;
  if ("baselineRecipe" in goal) {
    if (!(
      goal.baselineRecipe === null
      || goal.baselineRecipe === undefined
      || typeof goal.baselineRecipe === "string"
    )) {
      console.log(`optional goal parameter "baselineRecipe" is neither nullish nor a serialized recipe string`);
      return false;
    }
  }

  // baselineRecipeId: string | null | undefined;
  if ("baselineRecipeId" in goal && !(typeof goal.baselineRecipeId === 'string' || goal.baselineRecipeId === null || goal.baselineRecipeId === undefined)) {
    console.log(`optional goal parameter "baselineRecipeId" has wrong type: ${typeof goal.baselineRecipeId}`);
    return false;
  }

  // rawTags: string[] | null | undefined;
  if ("rawTags" in goal && !(
    goal.rawTags === null
    || goal.rawTags === undefined
    || (
      Array.isArray(goal.rawTags)
      && goal.rawTags.every(tag => typeof tag === "string")
    )
  )) {
    console.log(`optional goal parameter "rawTags" has wrong type: ${typeof goal.rawTags}`);
    return false;
  }

  // links: { url: string, description?: string | null }[] | null | undefined;
  // deprecated
  // TODO: remove
  if ("links" in goal && !(
    goal.links === undefined
    || goal.links === null
    || (
      Array.isArray(goal.links)
      && goal.links.every(link =>
        isStandardObject(link)
        && "url" in link && typeof link.url === 'string'
        && (!("description" in link) || typeof link.description === 'string' || link.description === null)
      )
    )
  )) {
    console.log(`optional goal parameter "links" has wrong type`);
    return false;
  }

  return true;
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
  )
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
      ("parentRoadmapId" in metaRoadmap) &&
      (
        typeof metaRoadmap.parentRoadmapId === 'string' ||
        metaRoadmap.parentRoadmapId === null ||
        metaRoadmap.parentRoadmapId === undefined
      )
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
  )
}
