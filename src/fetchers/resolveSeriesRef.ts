import "server-only";
import { getCuratedHistoricalEntries, getCuratedHistoricalEntry } from "@/fetchers/getCuratedHistoricalData";
import { findLocalSeries } from "@/fetchers/getNationalGoalMatches";
import { getRoadmaps } from "@/fetchers/getRoadmaps";
import { getUserAccessContext } from "@/fetchers/getUserAccessContext";
import accessChecker, { hasEditAccess } from "@/lib/accessChecker";
import { getNationalGoalMappings } from "@/lib/curatedHistoricalData";
import { getOneGoal } from "@/fetchers/getOneGoal";
import { getUserOrgs } from "@/fetchers/getUserOrgs";
import { goalDisplayName } from "@/functions/goalName";
import { localAnchor } from "@/functions/localScale";
import { RecipeDataTypes, VectorIndexPickerOptions } from "@/functions/recipe/types/enums";
import { parseSeriesRef, SeriesRefKind } from "@/lib/seriesRef";
import { parseUnit } from "@/functions/unit";
import { UnitFlags } from "@/types/enums";
import type { CuratedGeoArea, CuratedHistoricalEntryData, CuratedHistoricalSeriesData } from "@/fetchers/getCuratedHistoricalData";
import type { SeriesRef } from "@/lib/seriesRef";
import type { DateValues, GeoAreaRef, GoalPrefill, PrefilledSeries } from "@/types";
import { Recipe } from "@/functions/recipe/recipe";
import type { SerializedRecipe } from "@/functions/recipe/types";
import type { TFunction } from "i18next";

/**
 * Resolves a series reference (see `seriesRef`) into a series the goal form
 * can start from: the display name and unit, plus a recipe variable reading
 * the series from its source — the same variable the form's external data
 * input builds when the user picks that selection by hand.
 *
 * Curated refs are resolved for a geo area, since the catalog is localized
 * per area. Null when the ref doesn't resolve (unknown entry/series, or no data
 * for the area).
 */
export async function resolveSeriesRef(t: TFunction, ref: SeriesRef, geoArea: CuratedGeoArea): Promise<PrefilledSeries | null> {
  switch (ref.kind) {
    case SeriesRefKind.Curated: {
      const entry = await getCuratedHistoricalEntry(t, geoArea, ref.entryKey);
      const series = entry?.series.find(series => series.key === ref.seriesKey);
      if (!entry || !series) return null;
      return curatedPrefilledSeries(entry, series);
    }
    default: {
      return null;
    }
  }
}

/**
 * A curated series as something to start a goal from: an external variable
 * reading it from its source, the same one the form's external data input
 * builds when the user picks that selection by hand. The series' own values
 * come along for anything that wants them without re-fetching.
 */
export function curatedPrefilledSeries(entry: Pick<CuratedHistoricalEntryData, "name" | "unit"> & { series: { length: number } }, series: CuratedHistoricalSeriesData): PrefilledSeries {
  // A multi-series entry's series are only distinct together with the entry ("Passenger cars by fuel: Electric")
  const name = entry.series.length > 1 ? `${entry.name}: ${series.name}` : entry.name;
  return {
    name,
    unit: entry.unit,
    variable: {
      id: crypto.randomUUID(),
      name,
      type: RecipeDataTypes.External,
      pick: VectorIndexPickerOptions.Default,
      // The catalog's declared unit, since the table metadata carries no usable
      // one; lets evaluation convert and check it like any other unit
      unit: parseUnit(entry.unit),
      dataset: series.source.dataset,
      tableId: series.source.tableId,
      selection: series.selection,
    },
    dateValues: series.dateValues,
  };
}

/**
 * A goal's data series as the parent the suggested methods scale: a variable
 * linked to the series (read through the access-checked series fetcher at
 * evaluation time, so no values travel in a link).
 */
export function goalPrefilledSeries(goal: { name: string | null, indicatorParameter: string, unit: string | null, dataSeriesId: string, dateValues: DateValues }): PrefilledSeries {
  const name = goalDisplayName({ name: goal.name, indicator_parameter: goal.indicatorParameter });
  return {
    name,
    unit: goal.unit || null,
    variable: {
      id: crypto.randomUUID(),
      name,
      type: RecipeDataTypes.DataSeries,
      pick: VectorIndexPickerOptions.Default,
      unit: UnitFlags.Missing,
      dataSeriesId: goal.dataSeriesId,
      value: null,
    },
    dateValues: goal.dateValues,
  };
}

/**
 * Everything a copy of a goal starts from, given the goal and the local series
 * it is scaled to (see `GoalPrefill`). A goal that is zero in the anchor year
 * has no development to follow from the local level (nor has an empty series
 * an anchor); the copy then starts from the goal as is.
 */
export function copyPrefill(
  goal: Parameters<typeof goalPrefilledSeries>[0] & { description: string | null },
  entry: Parameters<typeof curatedPrefilledSeries>[0],
  series: CuratedHistoricalSeriesData,
): GoalPrefill {
  const parent = goalPrefilledSeries(goal);
  const historical = curatedPrefilledSeries(entry, series);
  // The local statistic once more, with its own variable id, for the scaling recipe
  const local = curatedPrefilledSeries(entry, series);
  const anchor = localAnchor(series.dateValues, goal.dateValues);
  return {
    historical,
    parent,
    copy: { name: goal.name, description: goal.description, indicatorParameter: goal.indicatorParameter },
    ...(anchor && anchor.goalValue !== 0 ? { localReference: { series: local, year: anchor.year, goalValue: anchor.goalValue } } : {}),
  };
}

/** The goal named by `from`, as visible to the user and with a data series to copy; null otherwise. */
async function resolveCopiedGoal(goalId: string): Promise<(Parameters<typeof copyPrefill>[0] & { geoArea: GeoAreaRef | null, storedSuggestions: SerializedRecipe[] }) | null> {
  const goal = await getOneGoal(goalId);
  if (!goal?.data_series) return null;
  return {
    name: goal.name,
    description: goal.description,
    indicatorParameter: goal.indicator_parameter,
    unit: goal.data_series.unit,
    dataSeriesId: goal.data_series.id,
    dateValues: Object.fromEntries(goal.data_series.values.map(record => [record.timestamp.toISOString(), record.value])) as DateValues,
    geoArea: goal.roadmap_iteration.roadmap.geo_area,
    storedSuggestions: goal.recipe_suggestions.map(row => Recipe.from(row.recipe).serialize()),
  };
}

/**
 * For a copied goal the curated catalog can measure locally: the local
 * statistic for every area the user could copy the goal into (the areas of
 * the roadmaps they can edit), keyed by area code, so the form can follow the
 * target roadmap. Empty for goals outside the mapping.
 */
async function localStatisticsByArea(t: TFunction, copied: Parameters<typeof copyPrefill>[0]): Promise<NonNullable<GoalPrefill["byArea"]>> {
  const byArea: NonNullable<GoalPrefill["byArea"]> = {};
  const mapping = getNationalGoalMappings().find(mapping => mapping.indicatorParameter === copied.indicatorParameter);
  if (!mapping) return byArea;

  const [roadmaps, accessContext] = await Promise.all([getRoadmaps(), getUserAccessContext()]);
  const areas = new Map<string, GeoAreaRef>();
  for (const roadmap of roadmaps) {
    if (roadmap.geo_area && hasEditAccess(accessChecker(roadmap, accessContext))) areas.set(roadmap.geo_area.code, roadmap.geo_area);
  }

  // One area at a time: the statistics APIs answer bursts with 429s
  for (const area of areas.values()) {
    const entries = await getCuratedHistoricalEntries(t, area, mapping.series.map(candidate => candidate.entryKey));
    const local = findLocalSeries(mapping, entries);
    if (!local) continue;
    const { historical, localReference } = copyPrefill(copied, local.entry, local.series);
    if (historical && localReference) byArea[area.code] = { historical, localReference };
  }
  return byArea;
}

/**
 * What the goal creation form should start from, from its link's search
 * params: `series` carries a ref (see `seriesRef`) resolved for the geo area of
 * the org named by `org`, and `from` names a goal to copy, whose data series
 * then becomes the parent the suggested methods scale, with the series (when
 * given) as the local level to scale it to. `failed` is true when a
 * param was given but could not be resolved (or the org isn't one of the
 * user's), so the page can say the link didn't work rather than silently
 * starting empty.
 */
export async function getGoalPrefill(
  t: TFunction,
  params: { org?: string | string[], series?: string | string[], from?: string | string[] },
): Promise<{ prefill: GoalPrefill | null, failed: boolean }> {
  if (typeof params.series !== "string") {
    if (typeof params.from !== "string") return { prefill: null, failed: false };
    // A goal copied as is: its series is what the suggested methods scale, and
    // its fields seed the form; the local statistic, if the catalog has one,
    // follows whichever roadmap the form is pointed at
    const copied = await resolveCopiedGoal(params.from);
    if (!copied) return { prefill: null, failed: true };
    return {
      prefill: {
        parent: goalPrefilledSeries(copied),
        copy: { name: copied.name, description: copied.description, indicatorParameter: copied.indicatorParameter },
        sourceGeoArea: copied.geoArea ?? undefined,
        storedSuggestions: copied.storedSuggestions,
        byArea: await localStatisticsByArea(t, copied),
      },
      failed: false,
    };
  }

  const ref = parseSeriesRef(params.series);
  const orgId = typeof params.org === "string" ? params.org : "";
  const geoArea = (await getUserOrgs()).find(org => org.id === orgId)?.geoArea ?? null;
  if (!ref || !geoArea) return { prefill: null, failed: true };

  const historical = await resolveSeriesRef(t, ref, geoArea);
  if (!historical) return { prefill: null, failed: true };
  if (typeof params.from !== "string") {
    return { prefill: { historical, parent: historical }, failed: false };
  }

  const [copied, entry] = await Promise.all([resolveCopiedGoal(params.from), getCuratedHistoricalEntry(t, geoArea, ref.entryKey)]);
  const series = entry?.series.find(series => series.key === ref.seriesKey);
  if (!copied || !entry || !series) return { prefill: null, failed: true };

  return {
    prefill: {
      ...copyPrefill(copied, entry, series),
      sourceGeoArea: copied.geoArea ?? undefined,
      storedSuggestions: copied.storedSuggestions,
      byArea: await localStatisticsByArea(t, copied),
    },
    failed: false,
  };
}
