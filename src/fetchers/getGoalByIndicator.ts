import { GoalListing } from "@/lib/prisma/generated";
import "server-only";
import { relatedGoalSelection } from "@/fetchers/inclusionSelectors";
import { getUserAccessContext } from "@/fetchers/getUserAccessContext";
import { boundedFill, uncachedFallback } from "@/fetchers/cacheFallback";
import { visibleRoadmapIterationsWHERE } from "@/lib/accessFilters";
import { effectSorter } from "@/lib/sorters";
import { prisma } from "@/lib/prisma";
import type { RelatedGoal, UserAccessContext } from "@/types";
import { cacheTag } from "next/cache";

// TODO: Check if we need to include data series unit as a key to make sure we don't get the wrong goal

/**
 * Gets the goal matching an indicator parameter within a specific roadmap iteration.
 *
 * Returns null if goal is not found or user does not have access to it. Also returns null on error.
 * @param iterationId ID of the roadmap iteration to search for the goal in
 * @param indicatorParameter Indicator parameter of the goal to get
 * @param unit If not undefined, the goal must have this unit in its data series (even if unit is null)
 * @returns The goal with what the goal page's parent/child graphs need (see `relatedGoalSelection`)
 */
export async function getGoalByIndicator(iterationId: string, indicatorParameter: string, unit?: string | null): Promise<RelatedGoal | null> {
  const accessContext = await getUserAccessContext();
  return uncachedFallback(() => getCachedGoalByIndicator(iterationId, indicatorParameter, unit, accessContext), null, `Error fetching goal with indicator parameter ${indicatorParameter} and unit ${unit} for iteration ${iterationId}`);
}

/**
 * Caches the matching goal's graph data.
 * Cache is invalidated when `revalidateTag()` is called on one of its tags `['database', 'goal', 'action', 'dataSeries', 'roadmap', 'roadmapIteration']`, which is done in relevant API routes.
 * @param iterationId ID of the roadmap iteration to search for the goal in
 * @param indicatorParameter Indicator parameter of the goal to cache
 * @param accessContext Requesting user's access context (null for anonymous visitors); part of the cache key.
 */
async function getCachedGoalByIndicator(iterationId: string, indicatorParameter: string, unit: string | undefined | null, accessContext: UserAccessContext | null): Promise<RelatedGoal | null> {
  'use cache';
  cacheTag('database', 'goal', 'action', 'dataSeries', 'roadmap', 'roadmapIteration');

  return boundedFill("getCachedGoalByIndicator", async () => {
    const goal: RelatedGoal | null = await prisma.goals.findFirst({
      where: {
        indicator_parameter: indicatorParameter,
        // Unlisted goals are excluded from other goals' parent/child listings
        listing: { not: GoalListing.UNLISTED },
        // If unit is specified, get a goal with the specified unit
        ...(unit !== undefined ? { data_series: { unit: unit } } : {}),
        roadmap_iteration: {
          id: iterationId,
          ...visibleRoadmapIterationsWHERE(accessContext),
        },
      },
      select: relatedGoalSelection,
    });

    goal?.effects.sort(effectSorter);

    return goal;
  });
};
