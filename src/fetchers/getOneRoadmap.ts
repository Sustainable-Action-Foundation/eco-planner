import "server-only";
import { roadmapInclusionSelection } from "@/fetchers/inclusionSelectors";
import { getUserAccessContext } from "@/fetchers/getUserAccessContext";
import { readableAccessControlWHERE, visibleRoadmapIterationsWHERE } from "@/lib/accessFilters";
import { prisma } from "@/lib/prisma";
import type { Roadmap, UserAccessContext } from "@/types";
import { cacheTag } from "next/cache";

/**
 * Gets specified roadmap with the iterations the user can see nested under it.
 *
 * Returns null if the roadmap is not found or user does not have access to it. Also returns null on error.
 * @param id ID of the roadmap to get
 * @returns Roadmap object with iterations
 */
export async function getOneRoadmap(id: string): Promise<Roadmap | null> {
  const accessContext = await getUserAccessContext();
  return getCachedRoadmap(id, accessContext);
}

/**
 * Caches the specified roadmap.
 * Cache is invalidated when `revalidateTag()` is called on one of its tags `['database', 'roadmap', 'roadmapIteration']`, which is done in relevant API routes.
 * @param id ID of the roadmap to cache
 * @param accessContext Requesting user's access context (null for anonymous visitors); part of the cache key.
 */
async function getCachedRoadmap(id: string, accessContext: UserAccessContext | null): Promise<Roadmap | null> {
  'use cache';
  cacheTag('database', 'roadmap', 'roadmapIteration');

  let roadmap: Roadmap | null;
  try {
    roadmap = await prisma.roadmaps.findUnique({
      where: {
        id,
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
    console.error("Error fetching roadmap:", { err });
    return null;
  }

  // Sort iterations newest version first
  roadmap?.iterations.sort((a, b) => b.version - a.version);

  return roadmap;
};
