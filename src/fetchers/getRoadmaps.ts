import "server-only";
import { roadmapInclusionSelection } from "@/fetchers/inclusionSelectors";
import { getUserAccessContext } from "@/fetchers/getUserAccessContext";
import { boundedFill, uncachedFallback } from "@/fetchers/cacheFallback";
import { listedRoadmapsWHERE, readableAccessControlWHERE, visibleRoadmapIterationsWHERE } from "@/lib/accessFilters";
import { roadmapSorter } from "@/lib/sorters";
import { prisma } from "@/lib/prisma";
import type { Roadmap, UserAccessContext } from "@/types";
import type { HiddenRoadmaps } from "@/types/enums";
import { cacheTag } from "next/cache";

/**
 * Gets all roadmaps the user has access to, with the iterations the user can see nested under each.
 *
 * Returns an empty array if none are found or user does not have access to any. Also returns an empty array on error.
 * @param hidden Which hidden roadmaps to include: `Exclude` for listings and pickers, `Include` for lookups by reference
 * @returns Array of roadmaps
 */
export async function getRoadmaps(hidden: HiddenRoadmaps): Promise<Roadmap[]> {
  const accessContext = await getUserAccessContext();
  return uncachedFallback(() => getCachedRoadmaps(accessContext, hidden), [], "Error fetching roadmaps");
}

/**
 * Caches all roadmaps the user has access to.
 * Cache is invalidated when `revalidateTag()` is called on one of its tags `['database', 'roadmap', 'roadmapIteration', 'goal', 'org']`, which is done in relevant API routes.
 * @param accessContext Requesting user's access context (null for anonymous visitors); part of the cache key.
 * @param hidden Which hidden roadmaps to include; part of the cache key.
 */
async function getCachedRoadmaps(accessContext: UserAccessContext | null, hidden: HiddenRoadmaps): Promise<Roadmap[]> {
  'use cache';
  cacheTag('database', 'roadmap', 'roadmapIteration', 'goal', 'org');

  return boundedFill("getCachedRoadmaps", async () => {
    const roadmaps: Roadmap[] = await prisma.roadmaps.findMany({
      where: {
        AND: [
          { access_control: readableAccessControlWHERE(accessContext) },
          listedRoadmapsWHERE(accessContext, hidden),
        ],
      },
      include: {
        ...roadmapInclusionSelection,
        iterations: {
          where: visibleRoadmapIterationsWHERE(accessContext),
          include: roadmapInclusionSelection.iterations.include,
        },
      },
    });

    // Sort roadmaps, and their iterations newest version first
    roadmaps.sort(roadmapSorter);
    for (const roadmap of roadmaps) {
      roadmap.iterations.sort((a, b) => b.version - a.version);
    }

    return roadmaps;
  });
};
