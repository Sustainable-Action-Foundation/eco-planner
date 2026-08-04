import "server-only";
import { goalInclusionSelection } from "@/fetchers/inclusionSelectors";
import { getUserAccessContext } from "@/fetchers/getUserAccessContext";
import { visibleRoadmapIterationsWhere } from "@/lib/accessFilters";
import { effectSorter } from "@/lib/sorters";
import { prisma } from "@/lib/prisma";
import type { Goal, UserAccessContext } from "@/types";
import { cacheTag } from "next/cache";

// TODO: Check if we need to include data series unit as a key to make sure we don't get the wrong goal

/**
 * Gets the goal matching an indicator parameter within a specific roadmap iteration.
 *
 * Returns null if goal is not found or user does not have access to it. Also returns null on error.
 * @param iterationId ID of the roadmap iteration to search for the goal in
 * @param indicatorParameter Indicator parameter of the goal to get
 * @param unit If not undefined, the goal must have this unit in its data series (even if unit is null)
 * @returns Goal object with effects
 */
export async function getGoalByIndicator(iterationId: string, indicatorParameter: string, unit?: string | null) {
  const accessContext = await getUserAccessContext();
  return getCachedGoalByIndicator(iterationId, indicatorParameter, unit, accessContext);
}

/**
 * Caches the specified goal and all effects for that goal.
 * Cache is invalidated when `revalidateTag()` is called on one of its tags `['database', 'goal', 'action', 'dataSeries']`, which is done in relevant API routes.
 * @param iterationId ID of the roadmap iteration to search for the goal in
 * @param indicatorParameter Indicator parameter of the goal to cache
 * @param accessContext Requesting user's access context (null for anonymous visitors); part of the cache key.
 */
async function getCachedGoalByIndicator(iterationId: string, indicatorParameter: string, unit: string | undefined | null, accessContext: UserAccessContext | null) {
  'use cache';
  cacheTag('database', 'goal', 'action', 'dataSeries');

  let goal: Goal | null;
  try {
    goal = await prisma.goals.findFirst({
      where: {
        indicator_parameter: indicatorParameter,
        // If unit is specified, get a goal with the specified unit
        ...(unit !== undefined ? { data_series: { unit: unit } } : {}),
        roadmap_iteration: {
          id: iterationId,
          ...visibleRoadmapIterationsWhere(accessContext),
        },
      },
      include: goalInclusionSelection,
    });
  }
  catch (err) {
    console.error(`Error fetching goal with indicator parameter ${indicatorParameter} and unit ${unit} for iteration ${iterationId}`, { err });
    return null;
  }

  goal?.effects.sort(effectSorter);

  return goal;
};
