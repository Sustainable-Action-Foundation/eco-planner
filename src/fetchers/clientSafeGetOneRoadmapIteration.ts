"use server";

import { clientSafeRoadmapIterationSelection } from "@/fetchers/inclusionSelectors";
import { getUserAccessContext } from "@/fetchers/getUserAccessContext";
import { visibleRoadmapIterationsWHERE } from "@/lib/accessFilters";
import { goalSorter } from "@/lib/sorters";
import { prisma } from "@/lib/prisma";
import type { ClientRoadmapIteration, UserAccessContext } from "@/types";
import { cacheTag } from "next/cache";

/**
 * A function similar to `getOneRoadmapIteration`, but excluding potentially sensitive data.
 *
 * Returns null if the iteration is not found or user does not have access to it. Also returns null on error.
 * @param id ID of the iteration to get
 * @returns Roadmap iteration object with goals
 */
export async function clientSafeGetOneRoadmapIteration(id: string): Promise<ClientRoadmapIteration | null> {
  const accessContext = await getUserAccessContext();
  return getCachedClientSafeRoadmapIteration(id, accessContext);
}

async function getCachedClientSafeRoadmapIteration(id: string, accessContext: UserAccessContext | null): Promise<ClientRoadmapIteration | null> {
  'use cache';
  cacheTag('database', 'roadmap', 'roadmapIteration', 'goal', 'action');

  let iteration: ClientRoadmapIteration | null;
  try {
    iteration = await prisma.roadmapIterations.findUnique({
      where: {
        // Spread first: the filter type has an optional `id` that would otherwise widen the unique key
        ...visibleRoadmapIterationsWHERE(accessContext),
        id,
      },
      select: clientSafeRoadmapIterationSelection,
    }) satisfies ClientRoadmapIteration | null;
  }
  catch (err) {
    console.error("Error fetching roadmap iteration", { err });
    return null;
  }

  iteration?.goals.sort(goalSorter);

  return iteration;
}
