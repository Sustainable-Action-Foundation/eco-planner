import "server-only";
import { getUserAccessContext } from "@/fetchers/getUserAccessContext";
import { boundedFill, uncachedFallback } from "@/fetchers/cacheFallback";
import { visibleCommentsWHERE } from "@/lib/accessFilters";
import { prisma } from "@/lib/prisma";
import type { UserAccessContext } from "@/types";
import { cacheTag } from "next/cache";

/** A comment with the one object it was written on; the other three targets are null */
export type UserComment = Awaited<ReturnType<typeof getCachedUserComments>>[number];

/**
 * Gets the comments a user has written, newest first, each with the object it was written on.
 * Comments on objects the requesting user can't (or can no longer) see are left out, so no
 * target name leaks.
 *
 * Returns an empty array on error.
 * @param authorId Id of the user whose comments to get
 */
export async function getUserComments(authorId: string) {
  const accessContext = await getUserAccessContext();
  return uncachedFallback(() => getCachedUserComments(authorId, accessContext), [], "Error fetching user comments", { authorId });
}

/**
 * Caches the comments a user has written.
 * Cache is invalidated when `revalidateTag()` is called on one of its tags `['database', 'user', 'roadmap', 'roadmapIteration', 'goal', 'action', 'org']`:
 * the comment API revalidates the tag of the commented object's type, and the object APIs cover renames, deletes and sharing changes.
 * @param authorId Id of the user whose comments to get
 * @param accessContext Requesting user's access context (null for anonymous visitors); part of the cache key.
 */
async function getCachedUserComments(authorId: string, accessContext: UserAccessContext | null) {
  'use cache';
  cacheTag('database', 'user', 'roadmap', 'roadmapIteration', 'goal', 'action', 'org');

  return boundedFill("getCachedUserComments", () => prisma.comments.findMany({
    where: { author_id: authorId, AND: [visibleCommentsWHERE(accessContext)] },
    orderBy: [{ created_at: 'desc' }, { id: 'asc' }],
    select: {
      id: true,
      created_at: true,
      comment_text: true,
      action: { select: { id: true, name: true } },
      goal: { select: { id: true, name: true, indicator_parameter: true } },
      roadmap_iteration: { select: { version: true, roadmap: { select: { id: true, name: true } } } },
      roadmap: { select: { id: true, name: true } },
    },
  }));
}
