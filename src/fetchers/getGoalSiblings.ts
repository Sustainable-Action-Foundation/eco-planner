import "server-only";
import { siblingGoalSelection } from "@/fetchers/inclusionSelectors";
import { getUserAccessContext } from "@/fetchers/getUserAccessContext";
import { uncachedFallback } from "@/fetchers/cacheFallback";
import { visibleRoadmapIterationsWHERE } from "@/lib/accessFilters";
import { GoalListing } from "@/lib/prisma/generated";
import { prisma } from "@/lib/prisma";
import { goalSorter } from "@/lib/sorters";
import { siblingIndicatorPrefixes } from "@/functions/findSiblings";
import type { SiblingGoal, UserAccessContext } from "@/types";
import { cacheTag } from "next/cache";

/**
 * Sibling candidates of a goal: the listed goals in its roadmap version under the same indicator
 * parent path, with only the fields the sibling graph plots. Pass the result to `findSiblings`,
 * which makes the exact match (level, unit, the goal itself).
 *
 * Returns an empty array if the iteration is not visible to the user, and on error.
 */
export async function getGoalSiblings(iterationId: string, indicatorParameter: string): Promise<SiblingGoal[]> {
  const accessContext = await getUserAccessContext();
  const prefixes = siblingIndicatorPrefixes(indicatorParameter);
  return uncachedFallback(() => getCachedGoalSiblings(iterationId, prefixes, accessContext), [], "Error fetching goal siblings", { iterationId, indicatorParameter });
}

/**
 * Keyed on the parent path's prefixes (not the goal), so all siblings share one entry.
 *
 * The prefix narrowing runs in JS over a scalar-only pass instead of a SQL `LIKE`: indicator
 * parameters are backslash-separated, and backslash is MariaDB's LIKE escape character, which
 * Prisma's `startsWith` does not escape. Only the narrowed goals' values are loaded.
 * @param prefixes Indicator parameter prefixes to narrow by, null for no narrowing (top-level goals)
 * @param accessContext Requesting user's access context (null for anonymous visitors); part of the cache key.
 */
async function getCachedGoalSiblings(iterationId: string, prefixes: string[] | null, accessContext: UserAccessContext | null): Promise<SiblingGoal[]> {
  'use cache';
  cacheTag('database', 'roadmap', 'roadmapIteration', 'goal', 'dataSeries');

  const listed = await prisma.goals.findMany({
    where: {
      roadmap_iteration_id: iterationId,
      roadmap_iteration: visibleRoadmapIterationsWHERE(accessContext),
      // Unlisted goals are excluded from other goals' sibling listings
      listing: { not: GoalListing.UNLISTED },
    },
    select: { id: true, indicator_parameter: true },
  });
  const candidateIds = listed
    .filter(goal => !prefixes || prefixes.some(prefix => goal.indicator_parameter.startsWith(prefix)))
    .map(goal => goal.id);
  if (candidateIds.length === 0) return [];

  const siblings = await prisma.goals.findMany({
    where: { id: { in: candidateIds } },
    select: siblingGoalSelection,
    orderBy: { id: "asc" },
  }) satisfies SiblingGoal[];

  // Same order as the iteration's goal list the siblings used to be picked from
  return siblings.sort(goalSorter);
}
