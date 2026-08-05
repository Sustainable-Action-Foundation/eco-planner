import "server-only";
import { goalInclusionSelection } from "@/fetchers/inclusionSelectors";
import { getUserAccessContext } from "@/fetchers/getUserAccessContext";
import { visibleRoadmapIterationsWHERE } from "@/lib/accessFilters";
import { effectSorter } from "@/lib/sorters";
import { prisma } from "@/lib/prisma";
import type { Goal, UserAccessContext } from "@/types";
import { cacheTag } from "next/cache";

/**
 * Gets specified goal and all effects for that goal.
 *
 * Returns null if goal is not found or user does not have access to it. Also returns null on error.
 * @param id ID of the goal to get
 * @returns Goal object with effects
 */
export async function getOneGoal(id: string): Promise<Goal | null> {
  const accessContext = await getUserAccessContext();
  return getCachedGoal(id, accessContext);
}

/**
 * Caches the specified goal and all effects for that goal.
 * Cache is invalidated when `revalidateTag()` is called on one of its tags `['database', 'goal', 'action', 'dataSeries']`, which is done in relevant API routes.
 * @param id ID of the goal to cache
 * @param accessContext Requesting user's access context (null for anonymous visitors); part of the cache key.
 */
async function getCachedGoal(id: string, accessContext: UserAccessContext | null): Promise<Goal | null> {
  'use cache';
  cacheTag('database', 'goal', 'action', 'dataSeries');

  let goal: Goal | null;
  try {
    goal = await prisma.goals.findUnique({
      where: {
        id,
        roadmap_iteration: visibleRoadmapIterationsWHERE(accessContext),
      },
      include: goalInclusionSelection,
    }) satisfies Goal | null;
  }
  catch (err) {
    console.error("Error fetching goal:", { err });
    return null;
  }

  goal?.effects.sort(effectSorter);

  return goal;
};
