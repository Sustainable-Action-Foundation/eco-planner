"use server";

import { clientSafeMultiRoadmapSelection } from "@/fetchers/inclusionSelectors";
import { getUserAccessContext } from "@/fetchers/getUserAccessContext";
import { boundedFill, uncachedFallback } from "@/fetchers/cacheFallback";
import { visibleRoadmapIterationsWHERE } from "@/lib/accessFilters";
import { roadmapIterationSorter } from "@/lib/sorters";
import { prisma } from "@/lib/prisma";
import type { ClientMultiRoadmapInstance, UserAccessContext } from "@/types";
import { cacheTag } from "next/cache";

/**
 * A function similar to `getRoadmapIterations`, but excluding potentially sensitive data.
 *
 * Returns an empty array if no iterations are found or user does not have access to any. Also returns an empty array on error.
 * @returns Array of roadmap iterations
 */
export async function clientSafeGetRoadmapIterations(): Promise<ClientMultiRoadmapInstance[]> {
  const accessContext = await getUserAccessContext();
  return uncachedFallback(() => getCachedClientSafeRoadmapIterations(accessContext), [], "Error fetching roadmap iterations");
}

async function getCachedClientSafeRoadmapIterations(accessContext: UserAccessContext | null): Promise<ClientMultiRoadmapInstance[]> {
  'use cache';
  cacheTag('database', 'roadmap', 'roadmapIteration', 'goal', 'action');

  return boundedFill("getCachedClientSafeRoadmapIterations", async () => {
    let iterations: ClientMultiRoadmapInstance[] = await prisma.roadmapIterations.findMany({
      where: visibleRoadmapIterationsWHERE(accessContext),
      select: clientSafeMultiRoadmapSelection,
    }) satisfies ClientMultiRoadmapInstance[];

    // Prisma loads the roadmaps in a second query, so a roadmap deleted in between leaves
    // its iteration without one (despite the type); drop those instead of crashing the sort
    iterations = iterations.filter(iteration => (iteration.roadmap as typeof iteration.roadmap | null) !== null);
    iterations.sort(roadmapIterationSorter);

    return iterations;
  });
}
