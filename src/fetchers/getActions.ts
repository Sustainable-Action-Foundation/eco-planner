import "server-only";
import { actionInclusionSelection } from "@/fetchers/inclusionSelectors";
import { getUserAccessContext } from "@/fetchers/getUserAccessContext";
import { visibleActionsWhere } from "@/lib/accessFilters";
import { prisma } from "@/lib/prisma";
import type { Action, UserAccessContext } from "@/types";
import { cacheTag } from "next/cache";

/**
 * Gets all available actions, including roadmapless ones from the public action database.
 *
 * Returns an empty array if no actions are found or user does not have access to any. Also returns an empty array on error.
 * @returns Array of actions
 */
export async function getActions(): Promise<Action[]> {
  const accessContext = await getUserAccessContext();
  return getCachedActions(accessContext);
}

/**
 * Caches available actions per user.
 * @param accessContext Requesting user's access context (null for anonymous visitors); part of the cache key.
 */
async function getCachedActions(accessContext: UserAccessContext | null): Promise<Action[]> {
  'use cache';
  cacheTag('database', 'action');

  // TODO: Use a different inclusion selection, probably excluding effects and parent roadmap
  let actions: Action[];
  try {
    actions = await prisma.actions.findMany({
      where: visibleActionsWhere(accessContext),
      include: actionInclusionSelection,
    });
  }
  catch (err) {
    console.error("Error fetching actions", { err });
    return [];
  }

  return actions;
}
