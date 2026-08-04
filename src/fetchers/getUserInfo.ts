import "server-only";
import { userInfoSelector } from "@/fetchers/inclusionSelectors";
import { getUserAccessContext } from "@/fetchers/getUserAccessContext";
import { readableAccessControlWhere, visibleRoadmapIterationsWhere } from "@/lib/accessFilters";
import { roadmapIterationSorter, roadmapSorter } from "@/lib/sorters";
import { prisma } from "@/lib/prisma";
import type { UserAccessContext } from "@/types";
import { cacheTag } from "next/cache";

/**
 * Gets basic user information and all (accessible) roadmaps and roadmap iterations authored by the user.
 *
 * Returns null if user is not found. Also returns null on error.
 * @param username Username of the user to get
 * @returns User object with authored roadmaps
 */
export async function getUserInfo(username: string) {
  const accessContext = await getUserAccessContext();
  return getCachedUserInfo(username, accessContext);
}

/**
 * Caches basic user information and all (accessible) roadmaps and roadmap iterations authored by the user.
 * Cache is invalidated when `revalidateTag()` is called on one of its tags `['database', 'user', 'roadmap', 'roadmapIteration']`, which is done in relevant API routes.
 * @param username Username of the user to get
 * @param accessContext Requesting user's access context (null for anonymous visitors); part of the cache key.
 */
async function getCachedUserInfo(username: string, accessContext: UserAccessContext | null) {
  'use cache';
  cacheTag('database', 'user', 'roadmap', 'roadmapIteration');

  // The filters collapse the ladder into the query: anonymous visitors only match public
  // content, superadmins match everything, everyone else matches what their memberships grant.
  try {
    const fetchedUser = await prisma.users.findUnique({
      where: { username },
      select: {
        ...userInfoSelector,
        authored_roadmaps: {
          where: {
            access_control: readableAccessControlWhere(accessContext),
          },
          include: userInfoSelector.authored_roadmaps.include,
        },
        authored_roadmap_iterations: {
          where: visibleRoadmapIterationsWhere(accessContext),
          include: userInfoSelector.authored_roadmap_iterations.include,
        },
      },
    });

    // Sort roadmaps and iterations
    fetchedUser?.authored_roadmaps.sort(roadmapSorter);
    fetchedUser?.authored_roadmap_iterations.sort(roadmapIterationSorter);

    return fetchedUser;
  }
  catch (err) {
    console.error("Error fetching user info", { err });
    return null;
  }
};
