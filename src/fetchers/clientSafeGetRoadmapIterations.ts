"use server";

import { clientSafeMultiRoadmapSelection } from "@/fetchers/inclusionSelectors";
import { getUserAccessContext } from "@/fetchers/getUserAccessContext";
import { boundedFill, uncachedFallback } from "@/fetchers/cacheFallback";
import { listedRoadmapsWHERE, visibleRoadmapIterationsWHERE } from "@/lib/accessFilters";
import { roadmapIterationSorter } from "@/lib/sorters";
import { prisma } from "@/lib/prisma";
import type { ClientMultiRoadmapInstance, UserAccessContext } from "@/types";
import { HiddenRoadmaps } from "@/types/enums";
import { cacheTag } from "next/cache";

/**
 * A function similar to `getRoadmapIterations`, but excluding potentially sensitive data.
 *
 * Returns an empty array if no iterations are found or user does not have access to any. Also returns an empty array on error.
 * @param hidden Which iterations of hidden roadmaps to include (listing only; access is checked regardless)
 * @returns Array of roadmap iterations
 */
export async function clientSafeGetRoadmapIterations(hidden: HiddenRoadmaps): Promise<ClientMultiRoadmapInstance[]> {
  const accessContext = await getUserAccessContext();
  // A server action: the argument comes from the client, so only known values pass
  const listing = Object.values(HiddenRoadmaps).includes(hidden) ? hidden : HiddenRoadmaps.Exclude;
  return uncachedFallback(() => getCachedClientSafeRoadmapIterations(accessContext, listing), [], "Error fetching roadmap iterations");
}

async function getCachedClientSafeRoadmapIterations(accessContext: UserAccessContext | null, hidden: HiddenRoadmaps): Promise<ClientMultiRoadmapInstance[]> {
  'use cache';
  cacheTag('database', 'roadmap', 'roadmapIteration', 'goal', 'action');

  return boundedFill("getCachedClientSafeRoadmapIterations", async () => {
    let iterations: ClientMultiRoadmapInstance[] = await prisma.roadmapIterations.findMany({
      // AND avoids clobbering the `roadmap` key inside the visibility filter
      where: { AND: [visibleRoadmapIterationsWHERE(accessContext), { roadmap: listedRoadmapsWHERE(accessContext, hidden) }] },
      select: clientSafeMultiRoadmapSelection,
    }) satisfies ClientMultiRoadmapInstance[];

    // Prisma loads the roadmaps in a second query, so a roadmap deleted in between leaves
    // its iteration without one (despite the type); drop those instead of crashing the sort
    iterations = iterations.filter(iteration => (iteration.roadmap as typeof iteration.roadmap | null) !== null);
    iterations.sort(roadmapIterationSorter);

    return iterations;
  });
}
