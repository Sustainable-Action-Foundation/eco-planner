"use server";

import { clientSafeMultiRoadmapSelection } from "@/fetchers/inclusionSelectors";
import { getUserAccessContext } from "@/fetchers/getUserAccessContext";
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
  return getCachedClientSafeRoadmapIterations(accessContext);
}

async function getCachedClientSafeRoadmapIterations(accessContext: UserAccessContext | null): Promise<ClientMultiRoadmapInstance[]> {
  'use cache';
  cacheTag('database', 'roadmap', 'roadmapIteration');

  let iterations: ClientMultiRoadmapInstance[];
  try {
    iterations = await prisma.roadmapIterations.findMany({
      where: visibleRoadmapIterationsWHERE(accessContext),
      select: clientSafeMultiRoadmapSelection,
    }) satisfies ClientMultiRoadmapInstance[];
  }
  catch (err) {
    console.error("Error fetching roadmap iterations", { err });
    return [];
  }

  iterations.sort(roadmapIterationSorter);

  return iterations;
}
