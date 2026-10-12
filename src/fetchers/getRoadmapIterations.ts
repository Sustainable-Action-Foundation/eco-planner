import "server-only";
import { multiRoadmapInclusionSelection } from "@/fetchers/inclusionSelectors";
import { getUserAccessContext } from "@/fetchers/getUserAccessContext";
import { uncachedFallback } from "@/fetchers/cacheFallback";
import { visibleRoadmapIterationsWHERE } from "@/lib/accessFilters";
import { roadmapIterationSorter } from "@/lib/sorters";
import { prisma } from "@/lib/prisma";
import type { MultiRoadmapInstance, UserAccessContext } from "@/types";
import { cacheTag } from "next/cache";

/**
 * Gets all roadmap iterations the user has access to, as well as the count of goals for each iteration.
 *
 * Returns an empty array if no iterations are found or user does not have access to any. Also returns an empty array on error.
 * @param iterationIds If provided, only iterations with these ids are returned
 * @returns Array of roadmap iterations
 */
export async function getRoadmapIterations(iterationIds?: string[]): Promise<MultiRoadmapInstance[]> {
  const accessContext = await getUserAccessContext();
  return uncachedFallback(() => getCachedRoadmapIterations(accessContext, iterationIds), [], "Error fetching roadmap iterations");
}

/**
 * Caches all roadmap iterations the user has access to.
 * Cache is invalidated when `revalidateTag()` is called on one of the tags in its `cacheTag()` call, which is done in relevant API routes.
 * @param accessContext Requesting user's access context (null for anonymous visitors); part of the cache key.
 */
async function getCachedRoadmapIterations(accessContext: UserAccessContext | null, iterationIds?: string[]): Promise<MultiRoadmapInstance[]> {
  'use cache';
  // goal/action are included because the returned iterations carry goal and action counts
  cacheTag('database', 'roadmap', 'roadmapIteration', 'goal', 'action', 'org');

  const iterations: MultiRoadmapInstance[] = await prisma.roadmapIterations.findMany({
    where: {
      ...(iterationIds ? { id: { in: iterationIds } } : {}), // If iterationIds is provided, filter by it
      ...visibleRoadmapIterationsWHERE(accessContext),
    },
    include: multiRoadmapInclusionSelection,
  }) satisfies MultiRoadmapInstance[];

  // Prisma loads the roadmaps in a second query, so a roadmap deleted in between leaves
  // its iteration without one (despite the type); drop those instead of crashing the sort
  iterations = iterations.filter(iteration => (iteration.roadmap as typeof iteration.roadmap | null) !== null);
  iterations.sort(roadmapIterationSorter);

  return iterations;
};
