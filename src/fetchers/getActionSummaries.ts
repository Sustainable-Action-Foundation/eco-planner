import "server-only";
import { actionSummarySelection } from "@/fetchers/inclusionSelectors";
import { getUserAccessContext } from "@/fetchers/getUserAccessContext";
import { boundedFill, uncachedFallback } from "@/fetchers/cacheFallback";
import { visibleActionsWHERE } from "@/lib/accessFilters";
import { prisma } from "@/lib/prisma";
import type { ActionSummary, UserAccessContext } from "@/types";
import { cacheTag } from "next/cache";

/**
 * The visible actions as the action list cards show them (name, years, origin, fields, author),
 * optionally only those owned by one org. Unlike `getActions` this leaves out effects, series,
 * comments and the roadmap, which the list never reads: for the biggest org that is most of the
 * page's payload.
 *
 * Returns an empty array if none are found or on error.
 * @param orgId Only actions owned by this org; all visible actions when omitted
 */
export async function getActionSummaries(orgId?: string): Promise<ActionSummary[]> {
  const accessContext = await getUserAccessContext();
  return uncachedFallback(() => getCachedActionSummaries(accessContext, orgId ?? null), [], "Error fetching action summaries", { orgId });
}

/**
 * Caches the action summaries per user and org.
 * @param accessContext Requesting user's access context (null for anonymous visitors); part of the cache key.
 */
async function getCachedActionSummaries(accessContext: UserAccessContext | null, orgId: string | null): Promise<ActionSummary[]> {
  'use cache';
  // Visibility comes from roadmap access and iteration status, so those tags too
  cacheTag('database', 'action', 'roadmap', 'roadmapIteration');

  return boundedFill("getCachedActionSummaries", async () => {
    return await prisma.actions.findMany({
      where: { AND: [orgId ? { org_id: orgId } : {}, visibleActionsWHERE(accessContext)] },
      select: actionSummarySelection,
    });
  });
}
