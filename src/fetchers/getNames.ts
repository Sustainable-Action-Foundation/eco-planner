import "server-only";
import { nameSelector } from "@/fetchers/inclusionSelectors";
import { getUserAccessContext } from "@/fetchers/getUserAccessContext";
import { readableAccessControlWhere, visibleRoadmapIterationsWhere } from "@/lib/accessFilters";
import { prisma } from "@/lib/prisma";
import type { NameObject, UserAccessContext } from "@/types";
import { cacheTag } from "next/cache";

/**
 * Gets names and ids of all roadmaps, iterations, goals, and actions. Mainly intended for breadcrumbs, but could be useful for other things too.
 *
 * Returns an empty array if user does not have access to any roadmaps. Also returns an empty array on error.
 * @returns Nested array of roadmaps, iterations, goals, and actions (just ids and names, plus indicator parameter for goals, and a version rather than name for iterations)
 */
export async function getNames() {
  const accessContext = await getUserAccessContext();
  return getCachedNames(accessContext);
}

/**
 * Caches names and ids of all roadmaps, goals, and actions.
 * Cache is invalidated when `revalidateTag()` is called on one of its tags `['database', 'roadmap', 'goal', 'action']`, which is done in relevant API routes.
 * @param accessContext Requesting user's access context (null for anonymous visitors); part of the cache key.
 */
async function getCachedNames(accessContext: UserAccessContext | null) {
  'use cache';
  cacheTag('database', 'roadmap', 'roadmapIteration', 'goal', 'action');

  let names: NameObject[];
  try {
    names = await prisma.roadmaps.findMany({
      where: {
        access_control: readableAccessControlWhere(accessContext),
      },
      select: {
        ...nameSelector,
        iterations: {
          where: visibleRoadmapIterationsWhere(accessContext),
          select: nameSelector.iterations.select,
        },
      },
    });
  }
  catch (err) {
    console.error("Error fetching names", { err });
    return [];
  }

  return names;
};
