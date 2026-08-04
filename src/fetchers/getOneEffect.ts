import "server-only";
import { effectInclusionSelection } from "@/fetchers/inclusionSelectors";
import { getUserAccessContext } from "@/fetchers/getUserAccessContext";
import { visibleActionsWhere, visibleRoadmapIterationsWHERE } from "@/lib/accessFilters";
import { prisma } from "@/lib/prisma";
import type { Effect, UserAccessContext } from "@/types";
import { cacheTag } from "next/cache";

/**
 * Gets specified effect as well as its action and goal.
 * Requires user to have view access to both the action *and* the goal.
 *
 * Returns null if the effect does not exist or the user does not have access to it. Also returns null on error.
 * @param actionId ID of the action this effect relates to
 * @param goalId ID of the goal this effect relates to
 * @returns Effect object with action and goal
 */
export async function getOneEffect(actionId: string, goalId: string): Promise<Effect | null> {
  const accessContext = await getUserAccessContext();
  return getCachedEffect(actionId, goalId, accessContext);
}

/**
 * Caches the specified effect as well as its action and goal.
 * @param accessContext Requesting user's access context (null for anonymous visitors); part of the cache key.
 */
async function getCachedEffect(actionId: string, goalId: string, accessContext: UserAccessContext | null): Promise<Effect | null> {
  'use cache';
  cacheTag('database', 'action', 'goal', 'effect');

  let effect: Effect | null;
  try {
    effect = await prisma.effects.findUnique({
      where: {
        id: { action_id: actionId, goal_id: goalId },
        // Requires access to both the action and the goal
        action: visibleActionsWhere(accessContext),
        goal: { roadmap_iteration: visibleRoadmapIterationsWHERE(accessContext) },
      },
      include: effectInclusionSelection,
    }) satisfies Effect | null;
  }
  catch (err) {
    console.error(`Error fetching effect with actionId ${actionId} and goalId ${goalId}:`, { err });
    return null;
  }

  return effect;
};
