import "server-only";
import { goalInclusionSelection } from "@/fetchers/inclusionSelectors";
import { withoutHiddenSources } from "@/fetchers/hiddenSources";
import { getUserAccessContext } from "@/fetchers/getUserAccessContext";
import { boundedFill, uncachedFallback } from "@/fetchers/cacheFallback";
import { visibleRoadmapIterationsWHERE } from "@/lib/accessFilters";
import { effectSorter } from "@/lib/sorters";
import { prisma } from "@/lib/prisma";
import type { GoalWithHiddenEffects, UserAccessContext } from "@/types";
import { cacheTag } from "next/cache";

/**
 * Gets specified goal and the effects on it that the user may see: an effect whose action the
 * user cannot open is left out, counted in `hidden_effect_count`.
 *
 * Returns null if goal is not found or user does not have access to it. Also returns null on error.
 * @param id ID of the goal to get
 * @returns Goal object with its visible effects
 */
export async function getOneGoal(id: string): Promise<GoalWithHiddenEffects | null> {
  const accessContext = await getUserAccessContext();
  return uncachedFallback(() => getCachedGoal(id, accessContext), null, "Error fetching goal:", { id });
}

/**
 * Caches the specified goal and its visible effects.
 * Cache is invalidated when `revalidateTag()` is called on one of its tags `['database', 'goal', 'action', 'dataSeries', 'roadmap', 'roadmapIteration', 'org']`, which is done in relevant API routes.
 * @param id ID of the goal to cache
 * @param accessContext Requesting user's access context (null for anonymous visitors); part of the cache key.
 */
async function getCachedGoal(id: string, accessContext: UserAccessContext | null): Promise<GoalWithHiddenEffects | null> {
  'use cache';
  cacheTag('database', 'goal', 'action', 'dataSeries', 'roadmap', 'roadmapIteration', 'org');

  return boundedFill("getCachedGoal", async () => {
    const goal = await prisma.goals.findUnique({
      where: {
        id,
        roadmap_iteration: visibleRoadmapIterationsWHERE(accessContext),
      },
      include: {
        ...goalInclusionSelection(accessContext),
        // Every effect on the goal here, to tell the viewer how many they are not shown
        _count: { select: { effects: true } },
      },
    });
    if (!goal) return null;

    goal.effects.sort(effectSorter);

    // `effects` holds only what the viewer may see; of the rest nothing but the number leaves
    // this function. Clamped: the count and the rows are not one snapshot, and an effect can land in between.
    const visibleEffects = goal.effects.length;
    return withoutHiddenSources({
      ...goal,
      _count: { effects: visibleEffects },
      hidden_effect_count: Math.max(0, goal._count.effects - visibleEffects),
    } satisfies GoalWithHiddenEffects);
  });
};
