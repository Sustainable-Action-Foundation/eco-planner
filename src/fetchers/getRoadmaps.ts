import "server-only";
import { roadmapInclusionSelection } from "@/fetchers/inclusionSelectors";
import { getUserAccessContext } from "@/fetchers/getUserAccessContext";
import { readableAccessControlWHERE, visibleRoadmapIterationsWHERE } from "@/lib/accessFilters";
import { roadmapSorter } from "@/lib/sorters";
import { prisma } from "@/lib/prisma";
import type { Roadmap, UserAccessContext } from "@/types";
import { cacheTag } from "next/cache";

/**
 * Gets all roadmaps the user has access to, with the iterations the user can see nested under each.
 *
 * Returns an empty array if none are found or user does not have access to any. Also returns an empty array on error.
 * @returns Array of roadmaps
 */
export async function getRoadmaps(): Promise<Roadmap[]> {
  const accessContext = await getUserAccessContext();
  return getCachedRoadmaps(accessContext);
}

/**
 * Caches all roadmaps the user has access to.
 * Cache is invalidated when `revalidateTag()` is called on one of its tags `['database', 'roadmap', 'roadmapIteration']`, which is done in relevant API routes.
 * @param accessContext Requesting user's access context (null for anonymous visitors); part of the cache key.
 */
async function getCachedRoadmaps(accessContext: UserAccessContext | null): Promise<Roadmap[]> {
  'use cache';
  cacheTag('database', 'roadmap', 'roadmapIteration');

  let roadmaps: Roadmap[];
  try {
    roadmaps = await prisma.roadmaps.findMany({
      where: {
        access_control: readableAccessControlWHERE(accessContext),
      },
      include: {
        ...roadmapInclusionSelection,
        iterations: {
          where: visibleRoadmapIterationsWHERE(accessContext),
          include: roadmapInclusionSelection.iterations.include,
        },
      },
    });
  }
  catch (err) {
    console.error("Error fetching roadmaps", { err });
    return [];
  }

  // Sort roadmaps, and their iterations newest version first
  roadmaps.sort(roadmapSorter);
  for (const roadmap of roadmaps) {
    roadmap.iterations.sort((a, b) => b.version - a.version);
  }

  return roadmaps;
};
