import "server-only";
import { multiRoadmapInclusionSelection } from "@/fetchers/inclusionSelectors";
import { getUserAccessContext } from "@/fetchers/getUserAccessContext";
import { visibleRoadmapIterationsWhere } from "@/lib/accessFilters";
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
  return getCachedRoadmapSubset(accessContext, actor);
}

// Also include the ids of goals and actions under the selected iterations
const roadmapSubsetSelect = {
  ...multiRoadmapInclusionSelection,
  goals: { select: { id: true } },
  actions: { select: { id: true } },
} satisfies Prisma.RoadmapIterationsInclude;

/**
 * Caches a subset of roadmap iterations the user has access to, based on the parameters passed to the function.
 * Cache is invalidated when `revalidateTag()` is called on one of its tags `['database', 'roadmap']`, which is done in relevant API routes.
 * @param accessContext Requesting user's access context (null for anonymous visitors); part of the cache key.
 * @param actor Actor to filter by
 */
async function getCachedRoadmapSubset(accessContext: UserAccessContext | null, actor?: string) {
  'use cache';
  cacheTag('database', 'roadmap');

  let iterations: Prisma.RoadmapIterationsGetPayload<{
    include: typeof roadmapSubsetSelect;
  }>[];

  try {
    iterations = await prisma.roadmapIterations.findMany({
      where: {
        // AND avoids clobbering the `roadmap` key inside the visibility filter
        AND: [
          { roadmap: { actor: actor ?? undefined } },
          visibleRoadmapIterationsWhere(accessContext),
        ],
      },
      include: roadmapSubsetSelect,
    });
  }
  catch (err) {
    console.error("Error fetching roadmap iteration subset", { err });
    return [];
  }

  iterations.sort(roadmapIterationSorter);

  return iterations;
};
