'use server';

import { clientSafeGoalSelection } from "@/fetchers/inclusionSelectors";
import { getUserAccessContext } from "@/fetchers/getUserAccessContext";
import { visibleRoadmapIterationsWhere } from "@/lib/accessFilters";
import { prisma } from "@/lib/prisma";
import type { ClientGoal, UserAccessContext } from "@/types";
import { cacheTag } from "next/cache";

/**
 * A function similar to `getOneGoal`, but excluding potentially sensitive data.
 *
 * Returns null if goal is not found or user does not have access to it. Also returns null on error.
 * @param id ID of the goal to get
 * @returns Goal object
 */
export async function clientSafeGetOneGoal(id: string): Promise<ClientGoal | null> {
  const accessContext = await getUserAccessContext();
  return clientSafeGetCachedGoal(id, accessContext);
}

async function clientSafeGetCachedGoal(id: string, accessContext: UserAccessContext | null): Promise<ClientGoal | null> {
  'use cache';
  cacheTag('database', 'goal', 'action', 'dataSeries');

  let goal: ClientGoal | null;
  try {
    goal = await prisma.goals.findUnique({
      where: {
        id,
        roadmap_iteration: visibleRoadmapIterationsWhere(accessContext),
      },
      select: clientSafeGoalSelection,
    }) satisfies ClientGoal | null;
  }
  catch (err) {
    console.error("Error fetching goal", { error: err });
    return null;
  }

  return goal;
}
