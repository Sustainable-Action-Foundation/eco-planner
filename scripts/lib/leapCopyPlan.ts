/**
 * Planning half of seeding a place's copy of the national LEAP scenario (see
 * scripts/prisma/seed/seed-leap.ts). Pure apart from id generation: given a
 * national goal, the target area and the statistics snapshot, it decides how
 * the copy is scaled and what gets stored, the same way the goal form does
 * when a national goal is copied into a roadmap:
 *
 * - the goal's own methods first: the local-statistic method when the curated
 *   catalog measures the row in the area, then what the LEAP scaling rule says
 *   (per-year factors before a latest-value factor); a point source is zeroed,
 *   since a plant is there or it isn't;
 * - the population ratio as the fallback for rows without a rule, and for rows
 *   whose statistic has no data for the area (the form would leave that to the
 *   user; the seed notes it in its report instead);
 * - external variables materialized like `materializeRecipeExternals` does:
 *   a DataSeries holding the fetched values, produced by a single-variable
 *   fetch recipe that keeps the selection as `externalSource`. One such series
 *   per selection and org, shared by every copy that reads it.
 */

import { randomUUID } from "node:crypto";
import { DefaultSuggestedRecipeId, getDefaultSuggestedRecipes, getGoalSuggestedRecipes } from "@/components/recipe/suggestions/defaultSuggestedRecipes";
import { LeapSuggestedRecipeId } from "@/components/recipe/suggestions/leapSuggestedRecipes";
import { localAnchor } from "@/functions/localScale";
import { indicatorParameterLeaf } from "@/functions/goalName";
import { Recipe } from "@/functions/recipe/recipe";
import { externalSelectionKey } from "@/functions/recipe/extractors";
import { RecipeDataTypes, VectorIndexPickerOptions } from "@/functions/recipe/types/enums";
import { parseUnit, serializeUnit } from "@/functions/unit";
import { getCuratedHistoricalCatalog, getNationalGoalMappings } from "@/lib/curatedHistoricalData";
import { getLeapScalingRule, LeapScalingKind } from "@/lib/leapScaling";
import { UnitFlags } from "@/types/enums";
import type { SuggestedRecipeContext } from "@/components/recipe/suggestions/defaultSuggestedRecipes";
import type { DataSeriesVariable, ExternalVariable, RecipeVariable, SerializedRecipe } from "@/functions/recipe/types";
import type { GoalListing } from "@/lib/prisma/generated";
import type { DataSeries, DateValues, DateValuesWithUnit, GeoAreaRef, PrefilledSeries } from "@/types";
import type { TFunction } from "i18next";
import { curatedKey, NATION, snapshotDateValues } from "./statisticsSnapshot";
import type { SnapshotSeries, StatisticsSnapshot } from "./statisticsSnapshot";

/** A goal of the national scenario as the seed knows it before anything is written. */
export type NationalGoalSeed = {
  id: string;
  name: string | null;
  description: string | null;
  indicatorParameter: string;
  listing: GoalListing;
  /** The goal's series, stored with this unit */
  unit: string | null;
  dataSeriesId: string;
  dateValues: DateValues;
};

export const CopyMethod = {
  /** `local(latest) * goal / goal(anchor year)` over a curated local statistic */
  Local: "LOCAL",
  /** A LEAP rule with per-year factors */
  LeapYearly: "LEAP_YEARLY",
  /** A LEAP rule read at the latest value */
  LeapLatest: "LEAP_LATEST",
  /** Copied unchanged (rule 1) */
  Copy: "COPY",
  /** A point source, zeroed */
  Zero: "ZERO",
  /** The population ratio, the fallback */
  Population: "POPULATION",
} as const;
export type CopyMethod = (typeof CopyMethod)[keyof typeof CopyMethod];

/** A materialized external series of one org: created once, read by every recipe with the same selection. */
export type MaterializedExternal = {
  id: string;
  recipeId: string;
  key: string;
  dataset: SnapshotSeries["dataset"];
  tableId: string;
  selection: SnapshotSeries["selection"];
  /** The unit the variable declared, kept on the series like the app does */
  unit: string | null;
  dateValues: DateValues;
  /** What produces it: a fetch recipe with the values inlined and the selection as `externalSource` */
  recipe: SerializedRecipe;
};

/** The materialized externals of one org, keyed by selection. */
export class ExternalRegistry {
  private readonly byKey = new Map<string, MaterializedExternal>();
  private readonly byId = new Map<string, MaterializedExternal>();
  /** Curated series are keyed by entry and area, but a recipe reading one refers to it by its resolved selection */
  private readonly keyBySelection = new Map<string, string>();

  constructor(private readonly snapshot: StatisticsSnapshot) {
    for (const [key, series] of Object.entries(snapshot.series)) {
      if (series && key.startsWith("curated:")) this.keyBySelection.set(externalSelectionKey(series.dataset, series.tableId, series.selection), key);
    }
  }

  /** The org's series for a snapshot key (or the selection key of a curated series), creating it on first use; null when the snapshot lacks the series. */
  materialize(requested: string, variable: Pick<ExternalVariable, "name" | "unit" | "pick">): MaterializedExternal | null {
    const key = this.snapshot.series[requested] ? requested : this.keyBySelection.get(requested) ?? requested;
    const existing = this.byKey.get(key);
    if (existing) return existing;
    const series = this.snapshot.series[key];
    if (!series || Object.keys(series.values).length === 0) return null;

    const id = randomUUID();
    const variableId = randomUUID();
    const dateValues = snapshotDateValues(series);
    const externalSource = { dataset: series.dataset, tableId: series.tableId, selection: series.selection };
    // The values are inlined like a manual recipe; the meta keeps the selection re-editable (see materializeRecipeExternals)
    const fetchVariable: DataSeriesVariable = {
      id: variableId,
      name: variable.name,
      type: RecipeDataTypes.DataSeries,
      unit: variable.unit,
      pick: variable.pick,
      dataSeriesId: null,
      value: dateValues,
      externalSource,
    };
    const recipe = new Recipe({ name: variable.name, equation: `\${${variableId}}`, variables: [fetchVariable], unit: variable.unit });
    const materialized: MaterializedExternal = {
      id,
      recipeId: randomUUID(),
      key,
      dataset: series.dataset,
      tableId: series.tableId,
      selection: series.selection,
      unit: serializeUnit(variable.unit),
      dateValues,
      recipe: recipe.serialize(),
    };
    this.byKey.set(key, materialized);
    this.byId.set(id, materialized);
    return materialized;
  }

  get(id: string): MaterializedExternal | undefined {
    return this.byId.get(id);
  }

  all(): MaterializedExternal[] {
    return [...this.byKey.values()];
  }
}

/** The curated local statistic for a goal's row in an area, if the catalog measures it there and the snapshot has it. */
export type LocalStatistic = {
  key: string;
  name: string;
  unit: string | null;
  series: SnapshotSeries;
};

export function findLocalStatistic(t: TFunction, snapshot: StatisticsSnapshot, indicatorParameter: string, area: GeoAreaRef): LocalStatistic | null {
  const mapping = getNationalGoalMappings().find(mapping => mapping.indicatorParameter === indicatorParameter);
  if (!mapping) return null;
  const catalog = getCuratedHistoricalCatalog(t, area.name);
  for (const candidate of mapping.series) {
    const entry = catalog.entries.find(entry => entry.key === candidate.entryKey);
    const series = entry?.series.find(series => series.key === candidate.seriesKey);
    if (!entry || !series) continue;
    const snapshotSeries = snapshot.series[curatedKey(entry.key, series.key, area.code)];
    if (!snapshotSeries || Object.keys(snapshotSeries.values).length === 0) continue;
    // A multi-series entry's series are only distinct together with the entry (see curatedPrefilledSeries)
    const name = entry.series.length > 1 ? `${entry.name}: ${series.name}` : entry.name;
    return { key: curatedKey(entry.key, series.key, area.code), name, unit: entry.unit, series: snapshotSeries };
  }
  return null;
}

/** The national goal's series as the parent the methods scale (see `goalPrefilledSeries`). */
function parentSeries(goal: NationalGoalSeed): PrefilledSeries {
  const name = goal.name || indicatorParameterLeaf(goal.indicatorParameter);
  return {
    name,
    unit: goal.unit || null,
    variable: { id: randomUUID(), name, type: RecipeDataTypes.DataSeries, pick: VectorIndexPickerOptions.Default, unit: UnitFlags.Missing, dataSeriesId: goal.dataSeriesId, value: null },
    dateValues: goal.dateValues,
  };
}

/** The local statistic as a series to start from (see `curatedPrefilledSeries`). */
function localPrefilledSeries(local: LocalStatistic): PrefilledSeries {
  return {
    name: local.name,
    unit: local.unit,
    variable: {
      id: randomUUID(),
      name: local.name,
      type: RecipeDataTypes.External,
      pick: VectorIndexPickerOptions.Default,
      unit: parseUnit(local.unit),
      dataset: local.series.dataset,
      tableId: local.series.tableId,
      selection: local.series.selection,
    },
    dateValues: snapshotDateValues(local.series),
  };
}

export type CopyCandidate = { method: CopyMethod, recipe: SerializedRecipe };

/**
 * The methods for copying the goal into the area, in the order the seed tries
 * them. Mirrors what the form offers a copy of a national goal (see
 * `getGoalSuggestedRecipes` and `preferredSuggestedRecipeId`), with the
 * population ratio appended as the fallback.
 */
export function copyCandidates(t: TFunction, goal: NationalGoalSeed, area: GeoAreaRef, local: LocalStatistic | null): CopyCandidate[] {
  const parent = parentSeries(goal);
  const anchor = local ? localAnchor(snapshotDateValues(local.series), goal.dateValues) : null;
  const context: SuggestedRecipeContext = {
    parentSeries: parent,
    indicatorParameter: goal.indicatorParameter,
    nationalScenario: true,
    geo: { source: NATION, target: area },
    // A goal that is zero in the anchor year has no development to follow from the local level (see copyPrefill)
    ...(local && anchor && anchor.goalValue !== 0 ? { localReference: { series: localPrefilledSeries(local), year: anchor.year, goalValue: anchor.goalValue } } : {}),
  };

  const own = getGoalSuggestedRecipes(context, t).map(suggestion => ({ method: methodOf(suggestion.id), recipe: Recipe.from(suggestion.recipe).serialize() }));
  const rule = getLeapScalingRule(goal.indicatorParameter);
  if (rule?.kind === LeapScalingKind.Point) {
    // Zero before "as is": the national plant isn't in the area. A local statistic still comes first.
    const rank = (method: CopyMethod) => method === CopyMethod.Local ? 0 : method === CopyMethod.Zero ? 1 : 2;
    own.sort((a, b) => rank(a.method) - rank(b.method));
  }

  const population = getDefaultSuggestedRecipes(t, context).find(recipe => recipe.id === DefaultSuggestedRecipeId.Population);
  const fallback = population && !Recipe.from(population.recipe).isTemplate() ? [{ method: CopyMethod.Population, recipe: Recipe.from(population.recipe).serialize() }] : [];
  return [...own, ...fallback];
}

function methodOf(suggestionId: string): CopyMethod {
  switch (suggestionId) {
    case DefaultSuggestedRecipeId.LocalScale: {
      return CopyMethod.Local;
    }
    case LeapSuggestedRecipeId.Copy: {
      return CopyMethod.Copy;
    }
    case LeapSuggestedRecipeId.Zero: {
      return CopyMethod.Zero;
    }
    case LeapSuggestedRecipeId.PopulationYearly:
    case LeapSuggestedRecipeId.RatioYearly:
    case LeapSuggestedRecipeId.ShareYearly: {
      return CopyMethod.LeapYearly;
    }
    case LeapSuggestedRecipeId.PopulationLatest:
    case LeapSuggestedRecipeId.RatioLatest:
    case LeapSuggestedRecipeId.ShareLatest: {
      return CopyMethod.LeapLatest;
    }
    default: {
      throw new Error(`Unexpected suggested method "${suggestionId}" for a national goal copy`);
    }
  }
}

/**
 * The recipe with every external variable replaced by a data series variable
 * reading the org's materialized series for that selection (what the goal API
 * stores), plus the ids of every series it reads. Null when the snapshot lacks
 * one of the selections.
 */
export function materializeRecipe(serialized: SerializedRecipe, registry: ExternalRegistry): { recipe: SerializedRecipe, sourceIds: string[] } | null {
  const recipe = Recipe.from(serialized);
  const variables: RecipeVariable[] = [];
  for (const variable of recipe.variables) {
    if (variable.type !== RecipeDataTypes.External) {
      variables.push(variable);
      continue;
    }
    if (!variable.dataset || !variable.tableId) return null;
    const materialized = registry.materialize(externalSelectionKey(variable.dataset, variable.tableId, variable.selection), variable);
    if (!materialized) return null;
    variables.push({
      id: variable.id,
      name: variable.name,
      type: RecipeDataTypes.DataSeries,
      unit: variable.unit,
      template: variable.template,
      pick: variable.pick,
      dataSeriesId: materialized.id,
      value: undefined,
      externalSource: { dataset: materialized.dataset, tableId: materialized.tableId, selection: materialized.selection },
    });
  }
  recipe.variables = variables;
  const sourceIds = [...new Set(variables.flatMap(variable => variable.type === RecipeDataTypes.DataSeries && variable.dataSeriesId ? [variable.dataSeriesId] : []))];
  return { recipe: recipe.serialize(), sourceIds };
}

/** In-memory stand-in for the series fetcher the evaluator reads linked series through. */
export function seriesGetter(national: Map<string, NationalGoalSeed>, registry: ExternalRegistry): (id: string) => Promise<DataSeries | null> {
  const asDataSeries = (id: string, unit: string | null, dateValues: DateValues): DataSeries => ({
    id,
    unit,
    values: Object.entries(dateValues).map(([date, value]) => ({ timestamp: new Date(date), value, data_series_id: id })),
  });
  return (id) => {
    const goal = national.get(id);
    if (goal) return Promise.resolve(asDataSeries(id, goal.unit, goal.dateValues));
    const external = registry.get(id);
    if (external) return Promise.resolve(asDataSeries(id, external.unit, external.dateValues));
    return Promise.resolve(null);
  };
}

export type PlannedCopy = {
  goal: NationalGoalSeed;
  method: CopyMethod;
  /** The copy's series recipe, externals materialized */
  recipe: SerializedRecipe;
  /** Every series the recipe reads */
  sourceIds: string[];
  /** What the recipe evaluates to: the copy's series */
  series: DateValuesWithUnit;
  /** The local statistic as the copy's history, when the copy follows one */
  historical?: MaterializedExternal;
};

/**
 * The first method that evaluates for the goal in the area. `dateValues` of
 * the result are the copy's trajectory; an empty result (no overlapping years,
 * a zero denominator) moves on to the next method. Null when none works.
 */
export async function planCopy(
  t: TFunction,
  goal: NationalGoalSeed,
  area: GeoAreaRef,
  snapshot: StatisticsSnapshot,
  registry: ExternalRegistry,
  getSeries: (id: string) => Promise<DataSeries | null>,
): Promise<{ planned: PlannedCopy | null, failures: string[] }> {
  const local = findLocalStatistic(t, snapshot, goal.indicatorParameter, area);
  const failures: string[] = [];
  for (const candidate of copyCandidates(t, goal, area, local)) {
    const materialized = materializeRecipe(candidate.recipe, registry);
    if (!materialized) { failures.push(`${candidate.method}: statistik saknas i ögonblicksbilden`); continue; }
    try {
      const evaluated = await Recipe.from(materialized.recipe).evaluate([], { dataSeriesGetter: getSeries });
      if (!evaluated || Object.keys(evaluated.dateValues).length === 0) { failures.push(`${candidate.method}: tomt resultat`); continue; }
      if (Object.values(evaluated.dateValues).some(value => !Number.isFinite(value))) { failures.push(`${candidate.method}: oändligt eller odefinierat värde`); continue; }
      const historical = candidate.method === CopyMethod.Local && local
        ? registry.materialize(local.key, { name: local.name, unit: parseUnit(local.unit), pick: VectorIndexPickerOptions.Default }) ?? undefined
        : undefined;
      return { planned: { goal, method: candidate.method, recipe: materialized.recipe, sourceIds: materialized.sourceIds, series: evaluated, ...(historical ? { historical } : {}) }, failures };
    }
    catch (err) {
      failures.push(`${candidate.method}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return { planned: null, failures };
}
