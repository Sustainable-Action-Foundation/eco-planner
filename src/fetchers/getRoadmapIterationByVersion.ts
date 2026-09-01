import { IterationStatus } from "@/lib/prisma/generated";
import "server-only";
import { roadmapIterationInclusionSelection } from "@/fetchers/inclusionSelectors";
import { getUserAccessContext } from "@/fetchers/getUserAccessContext";
import { visibleRoadmapIterationsWHERE } from "@/lib/accessFilters";
import { goalSorter } from "@/lib/sorters";
import { prisma } from "@/lib/prisma";
import type { RoadmapIteration, UserAccessContext } from "@/types";
import { cacheTag } from "next/cache";

/**
 * Gets a roadmap iteration from a roadmap ID and version number, or the latest published iteration if version is "latest".
 *
 * Returns null if the iteration is not found or user does not have access to it. Also returns null on error.
 * @param roadmapId ID of the roadmap to search for a specific version of
 * @param version Version number of the iteration to get, or "latest" for the latest published iteration
 * @returns Roadmap iteration object with goals
 */
export async function getRoadmapIterationByVersion(roadmapId: string, version: number | "latest"): Promise<RoadmapIteration | null> {
  const accessContext = await getUserAccessContext();
  return getCachedRoadmapIterationByVersion(roadmapId, version, accessContext);
}

/**
 * Caches the specified roadmap iteration and all goals for that iteration.
 * Cache is invalidated when `revalidateTag()` is called on one of its tags `['database', 'roadmap', 'roadmapIteration', 'goal']`, which is done in relevant API routes.
 * @param roadmapId ID of the roadmap to search for a specific version of
 * @param version Version number of the iteration to cache, or "latest" for the latest published iteration
 * @param accessContext Requesting user's access context (null for anonymous visitors); part of the cache key.
 */
async function getCachedRoadmapIterationByVersion(roadmapId: string, version: number | "latest", accessContext: UserAccessContext | null): Promise<RoadmapIteration | null> {
  'use cache';
  cacheTag('database', 'roadmap', 'roadmapIteration', 'goal', 'action');

  let iteration: RoadmapIteration | null;
  try {
    if (version === "latest") {
      // Latest non-draft iteration; drafts are never "latest" even for users who may see them
      iteration = await prisma.roadmapIterations.findFirst({
        where: {
          roadmap_id: roadmapId,
          status: { not: IterationStatus.DRAFT },
          AND: [visibleRoadmapIterationsWHERE(accessContext)],
        },
        orderBy: { version: "desc" },
        include: roadmapIterationInclusionSelection,
      }) satisfies RoadmapIteration | null;
    }
    else {
      iteration = await prisma.roadmapIterations.findUnique({
        where: {
          roadmap_version: { roadmap_id: roadmapId, version },
          // AND keeps the filter's optional unique-key fields out of the WhereUniqueInput type
          AND: [visibleRoadmapIterationsWHERE(accessContext)],
        },
        include: roadmapIterationInclusionSelection,
      }) satisfies RoadmapIteration | null;
    }
  }
  catch (err) {
    console.error("Error fetching roadmap iteration by version", { err });
    return null;
  }

  iteration?.goals.sort(goalSorter);

  return iteration;
};
