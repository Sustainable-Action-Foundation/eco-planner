import "server-only";
import { getCuratedHistoricalEntries } from "@/fetchers/getCuratedHistoricalData";
import { getUserAccessContext } from "@/fetchers/getUserAccessContext";
import { visibleRoadmapIterationsWHERE } from "@/lib/accessFilters";
import { getNationalGoalMappings } from "@/lib/curatedHistoricalData";
import { prisma } from "@/lib/prisma";
import { GoalListing, IterationStatus, RoadmapType } from "@/lib/prisma/generated";
import type { CuratedGeoArea, CuratedHistoricalEntryData, CuratedHistoricalSeriesData } from "@/fetchers/getCuratedHistoricalData";
import type { NationalGoalMapping } from "@/lib/curatedHistoricalData";
import type { DateValues, UserAccessContext } from "@/types";
import type { TFunction } from "i18next";
import { cacheTag } from "next/cache";

/**
 * A goal in a national scenario together with the curated series that measures
 * the same thing in an org's own area, i.e. a goal the org can copy with local
 * historical data (see `getNationalGoalMatches`).
 */
export type NationalGoalMatch = {
  goal: {
    id: string;
    name: string | null;
    indicatorParameter: string;
    unit: string | null;
    dateValues: DateValues;
  };
  roadmap: { id: string, name: string, version: number, iterationId: string };
  entry: Omit<CuratedHistoricalEntryData, "series">;
  series: CuratedHistoricalSeriesData;
};

/**
 * The goals of the readable national scenarios (latest published version of
 * each roadmap of type NATIONAL) that have a local counterpart in the curated
 * catalog with data for the geo area, paired with that series. Grouped by
 * roadmap in roadmap order; empty when nothing matches, so callers can render
 * unconditionally.
 */
export async function getNationalGoalMatches(t: TFunction, geoArea: CuratedGeoArea): Promise<NationalGoalMatch[]> {
  const mappings = getNationalGoalMappings();
  const goals = await getCachedNationalGoals(mappings.map(mapping => mapping.indicatorParameter), await getUserAccessContext());
  if (goals.length === 0) return [];

  const mappingByIndicator = new Map(mappings.map(mapping => [mapping.indicatorParameter, mapping]));
  const entryKeys = new Set(goals.flatMap(goal => mappingByIndicator.get(goal.indicator_parameter)?.series.map(series => series.entryKey) ?? []));
  const entries = await getCuratedHistoricalEntries(t, geoArea, entryKeys);

  return goals.flatMap(goal => {
    const mapping = mappingByIndicator.get(goal.indicator_parameter);
    const local = mapping ? findLocalSeries(mapping, entries) : null;
    if (!local || !goal.data_series) return [];

    const { series: _localSeries, ...entry } = local.entry;
    return [{
      goal: {
        id: goal.id,
        name: goal.name,
        indicatorParameter: goal.indicator_parameter,
        unit: goal.data_series.unit || null,
        dateValues: Object.fromEntries(goal.data_series.values.map(record => [record.timestamp.toISOString(), record.value])) as DateValues,
      },
      roadmap: {
        id: goal.roadmap_iteration.roadmap.id,
        name: goal.roadmap_iteration.roadmap.name,
        version: goal.roadmap_iteration.version,
        iterationId: goal.roadmap_iteration.id,
      },
      entry,
      series: local.series,
    }];
  });
}

/** The first of the mapping's candidate series that has data for the area. */
export function findLocalSeries(mapping: NationalGoalMapping, entries: CuratedHistoricalEntryData[]): { entry: CuratedHistoricalEntryData, series: CuratedHistoricalSeriesData } | null {
  for (const candidate of mapping.series) {
    const entry = entries.find(entry => entry.key === candidate.entryKey);
    const series = entry?.series.find(series => series.key === candidate.seriesKey);
    if (entry && series) return { entry, series };
  }
  return null;
}

/**
 * Listed goals with one of the indicator parameters, in the latest published
 * version of each readable national roadmap. Cached per access context like the
 * other goal fetchers; invalidated with the `goal` and `dataSeries` tags.
 */
async function getCachedNationalGoals(indicatorParameters: string[], accessContext: UserAccessContext | null) {
  'use cache';
  cacheTag('database', 'goal', 'roadmap', 'roadmapIteration', 'dataSeries');

  try {
    const goals = await prisma.goals.findMany({
      where: {
        indicator_parameter: { in: indicatorParameters },
        listing: { not: GoalListing.UNLISTED },
        data_series: { isNot: null },
        roadmap_iteration: {
          ...visibleRoadmapIterationsWHERE(accessContext),
          status: IterationStatus.PUBLISHED,
          roadmap: { type: RoadmapType.NATIONAL },
        },
      },
      select: {
        id: true,
        name: true,
        indicator_parameter: true,
        data_series: { select: { unit: true, values: { select: { timestamp: true, value: true } } } },
        roadmap_iteration: { select: { id: true, version: true, roadmap: { select: { id: true, name: true } } } },
      },
      orderBy: [{ roadmap_iteration: { roadmap: { name: "asc" } } }, { indicator_parameter: "asc" }],
    });

    // Only the latest published version of each roadmap
    const latestVersion = new Map<string, number>();
    for (const goal of goals) {
      const { roadmap, version } = goal.roadmap_iteration;
      latestVersion.set(roadmap.id, Math.max(latestVersion.get(roadmap.id) ?? -Infinity, version));
    }
    return goals.filter(goal => goal.roadmap_iteration.version === latestVersion.get(goal.roadmap_iteration.roadmap.id));
  }
  catch (err) {
    console.error("Error fetching national goals", { err });
    return [];
  }
}
