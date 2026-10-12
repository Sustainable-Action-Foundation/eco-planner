import "server-only";
import { actionInclusionSelection } from "@/fetchers/inclusionSelectors";
import { getUserAccessContext } from "@/fetchers/getUserAccessContext";
import { uncachedFallback } from "@/fetchers/cacheFallback";
import { visibleActionsWHERE } from "@/lib/accessFilters";
import { prisma } from "@/lib/prisma";
import type { Action, UserAccessContext } from "@/types";
import { cacheTag } from "next/cache";

/**
 * Gets specified action.
 *
 * Returns null if action is not found or user does not have access to it. Also returns null on error.
 * @param id ID of the action to get
 * @returns Action object
 */
export async function getOneAction(id: string): Promise<Action | null> {
  const accessContext = await getUserAccessContext();
  return uncachedFallback(() => getCachedAction(id, accessContext), null, `Error fetching action with id ${id}`);
}

/**
 * Caches the specified action.
 * Cache is invalidated when `revalidateTag()` is called on one of its tags `['database', 'action']`, which is done in relevant API routes.
 * @param id ID of the action to cache
 * @param accessContext Requesting user's access context (null for anonymous visitors); part of the cache key.
 */
async function getCachedAction(id: string, accessContext: UserAccessContext | null): Promise<Action | null> {
  'use cache';
  cacheTag('database', 'action');

  const action: Action | null = await prisma.actions.findUnique({
    where: {
      // Spread first: the filter type has an optional `id` that would otherwise widen the unique key
      ...visibleActionsWHERE(accessContext),
      id,
    },
    include: actionInclusionSelection,
  }) satisfies Action | null;

  return action;
};
