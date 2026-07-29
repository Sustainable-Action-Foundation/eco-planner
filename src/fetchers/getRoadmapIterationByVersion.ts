import "server-only";
import { roadmapIterationInclusionSelection } from "@/fetchers/inclusionSelectors";
import { getUserAccessContext } from "@/fetchers/getUserAccessContext";
import { visibleRoadmapIterationsWhere } from "@/lib/accessFilters";
import { goalSorter } from "@/lib/sorters";
import { prisma } from "@/lib/prisma";
import type { RoadmapIteration, UserAccessContext } from "@/types";
import { cacheTag } from "next/cache";

/**
 * Gets a roadmap iteration from a roadmap ID and version number.
 *
 * Returns null if the iteration is not found or user does not have access to it. Also returns null on error.
 * @param roadmapId ID of the roadmap to search for a specific version of
 * @param version Version number of the iteration to get
 * @returns Roadmap iteration object with goals
 */
export async function getRoadmapIterationByVersion(roadmapId: string, version: number): Promise<RoadmapIteration | null> {
  const accessContext = await getUserAccessContext();
  return getCachedRoadmapIterationByVersion(roadmapId, version, accessContext);
}

/**
 * Caches the specified roadmap iteration and all goals for that iteration.
 * Cache is invalidated when `revalidateTag()` is called on one of its tags `['database', 'roadmap', 'goal']`, which is done in relevant API routes.
 * @param roadmapId ID of the roadmap to search for a specific version of
 * @param version Version number of the iteration to cache
 * @param accessContext Requesting user's access context (null for anonymous visitors); part of the cache key.
 */
async function getCachedRoadmapIterationByVersion(roadmapId: string, version: number, accessContext: UserAccessContext | null): Promise<RoadmapIteration | null> {
  'use cache';
  cacheTag('database', 'roadmap', 'goal');

  let iteration: RoadmapIteration | null;
  try {
    iteration = await prisma.roadmapIterations.findUnique({
      where: {
        roadmap_version: { roadmap_id: roadmapId, version },
        // AND keeps the filter's optional unique-key fields out of the WhereUniqueInput type
        AND: [visibleRoadmapIterationsWhere(accessContext)],
      },
      include: roadmapIterationInclusionSelection,
    }) satisfies RoadmapIteration | null;
  }
  catch (err) {
    console.error("Error fetching roadmap iteration by version", { err });
    return null;
  }

  iteration?.goals.sort(goalSorter);

  return iteration;
};
