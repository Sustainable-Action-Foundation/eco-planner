import "server-only";
import { multiRoadmapInclusionSelection } from "@/fetchers/inclusionSelectors";
import { getUserAccessContext } from "@/fetchers/getUserAccessContext";
import { boundedFill, uncachedFallback } from "@/fetchers/cacheFallback";
import { visibleRoadmapIterationsWHERE } from "@/lib/accessFilters";
import { roadmapIterationSorter } from "@/lib/sorters";
import type { Prisma } from "@/lib/prisma/generated";
import { prisma } from "@/lib/prisma";
import type { UserAccessContext } from "@/types";
import { cacheTag } from "next/cache";

/**
 * Gets a subset of roadmap iterations the user has access to, based on the parameters passed to the function.
 *
 * Returns an empty array if no iterations are found or user does not have access to any. Also returns an empty array on error.
 * @param actor Actor to filter by (matched against the parent roadmap's free-text actor; TODO: filter by geo_area_code instead)
 * @returns Array of roadmap iterations
 */
export async function getRoadmapSubset(actor?: string) {
  const accessContext = await getUserAccessContext();
  return uncachedFallback(() => getCachedRoadmapSubset(accessContext, actor), [], "Error fetching roadmap iteration subset");
}

// Also include the ids of goals and actions under the selected iterations
const roadmapSubsetSelect = {
  ...multiRoadmapInclusionSelection,
  goals: { select: { id: true } },
  actions: { select: { id: true } },
} satisfies Prisma.RoadmapIterationsInclude;

/**
 * Caches a subset of roadmap iterations the user has access to, based on the parameters passed to the function.
 * Cache is invalidated when `revalidateTag()` is called on one of its tags `['database', 'roadmap', 'roadmapIteration', 'goal', 'action', 'org']`, which is done in relevant API routes.
 * @param accessContext Requesting user's access context (null for anonymous visitors); part of the cache key.
 * @param actor Actor to filter by
 */
async function getCachedRoadmapSubset(accessContext: UserAccessContext | null, actor?: string) {
  'use cache';
  cacheTag('database', 'roadmap', 'roadmapIteration', 'goal', 'action', 'org');

  return boundedFill("getCachedRoadmapSubset", async () => {
    let iterations: Prisma.RoadmapIterationsGetPayload<{
      include: typeof roadmapSubsetSelect;
    }>[] = await prisma.roadmapIterations.findMany({
      where: {
        // AND avoids clobbering the `roadmap` key inside the visibility filter
        AND: [
          { roadmap: { actor: actor ?? undefined } },
          visibleRoadmapIterationsWHERE(accessContext),
        ],
      },
      include: roadmapSubsetSelect,
    });

    // Prisma loads the roadmaps in a second query, so a roadmap deleted in between leaves
    // its iteration without one (despite the type); drop those instead of crashing the sort
    iterations = iterations.filter(iteration => (iteration.roadmap as typeof iteration.roadmap | null) !== null);
    iterations.sort(roadmapIterationSorter);

    return iterations;
  });
};
