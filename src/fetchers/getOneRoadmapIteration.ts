import "server-only";
import { roadmapIterationInclusionSelection } from "@/fetchers/inclusionSelectors";
import { getUserAccessContext } from "@/fetchers/getUserAccessContext";
import { visibleRoadmapIterationsWhere } from "@/lib/accessFilters";
import { goalSorter } from "@/lib/sorters";
import { prisma } from "@/lib/prisma";
import type { RoadmapIteration, UserAccessContext } from "@/types";
import { cacheTag } from "next/cache";

/**
 * Gets specified roadmap iteration and all goals for that iteration.
 *
 * Returns null if the iteration is not found or user does not have access to it. Also returns null on error.
 * @param id ID of the iteration to get
 * @returns Roadmap iteration object with goals or null
 */
export async function getOneRoadmapIteration(id: string): Promise<RoadmapIteration | null> {
  const accessContext = await getUserAccessContext();
  return await getCachedRoadmapIteration(id, accessContext);
}

/**
 * Caches the specified roadmap iteration and all goals for that iteration.
 * Cache is invalidated when `revalidateTag()` is called on one of its tags `['database', 'roadmap', 'goal']`, which is done in relevant API routes.
 * @param id ID of the iteration to cache
 * @param accessContext Requesting user's access context (null for anonymous visitors); part of the cache key.
 */
async function getCachedRoadmapIteration(id: string, accessContext: UserAccessContext | null): Promise<RoadmapIteration | null> {
  'use cache';
  cacheTag('database', 'roadmap', 'goal', 'action');

  let iteration: RoadmapIteration | null;
  try {
    iteration = await prisma.roadmapIterations.findUnique({
      where: {
        // Spread first: the filter type has an optional `id` that would otherwise widen the unique key
        ...visibleRoadmapIterationsWhere(accessContext),
        id,
      },
      include: roadmapIterationInclusionSelection,
    }) satisfies RoadmapIteration | null;
  }
  catch (err) {
    console.error(`Error fetching roadmap iteration with ID ${id}:`, { err });
    return null;
  }

  iteration?.goals.sort(goalSorter);

  return iteration;
};
