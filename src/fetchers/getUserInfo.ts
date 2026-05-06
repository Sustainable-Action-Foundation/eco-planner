import "server-only";
import { userInfoSelector } from "@/fetchers/inclusionSelectors";
import type { LoginData } from "@/lib/session";
import { getSession } from "@/lib/session";
import { metaRoadmapSorter, roadmapSorter } from "@/lib/sorters";
import { prisma } from "@/lib/prisma";
import { cacheTag } from "next/cache";
import { cookies } from "next/headers";

/**
 * Gets basic user information and all (accessible) MetaRoadmaps and Roadmaps authored by the user.
 * 
 * Returns null if user is not found. Also returns null on error.
 * @param username Username of the user to get
 * @returns User object with authored roadmaps
 */
export async function getUserInfo(username: string) {
  const session = await getSession(await cookies());
  return getCachedUserInfo(username, session.user);
}

/**
 * Caches basic user information and all (accessible) MetaRoadmaps and Roadmaps authored by the user.
 * Cache is invalidated when `revalidateTag()` is called on one of its tags `['database', 'user', 'roadmap', 'metaRoadmap']`, which is done in relevant API routes.
 * @param username Username of the user to get
 * @param activeUser Data from requesting user's session cookie.
 */
async function getCachedUserInfo(username: string, activeUser: LoginData['user']) {
  'use cache'
  cacheTag('database', 'user', 'roadmap', 'metaRoadmap')
  // If active user is admin, get all relevant roadmaps
  if (activeUser?.isAdmin) {
    try {
      const fetchedUser = await prisma.user.findUnique({
        where: { username },
        select: userInfoSelector,
      });

      // Sort roadmaps and meta roadmaps
      fetchedUser?.authoredRoadmaps.sort(roadmapSorter);
      fetchedUser?.authoredMetaRoadmaps.sort(metaRoadmapSorter);

      return fetchedUser;
    }
    catch (error) {
      console.log(error);
      console.log('Error admin fetching authored posts');
      return null;
    }
  }

  // If active user is logged in, get relevant roadmaps they have access to
  if (activeUser?.isLoggedIn) {
    try {
      const fetchedUser = await prisma.user.findUnique({
        where: { username },
        select: {
          ...userInfoSelector,
          authoredRoadmaps: {
            where: {
              OR: [
                { authorId: activeUser.id },
                { editors: { some: { id: activeUser.id } } },
                { viewers: { some: { id: activeUser.id } } },
                { editGroups: { some: { users: { some: { id: activeUser.id } } } } },
                { viewGroups: { some: { users: { some: { id: activeUser.id } } } } },
                { isPublic: true },
              ],
            },
            include: userInfoSelector.authoredRoadmaps.include,
          },
          authoredMetaRoadmaps: {
            where: {
              OR: [
                { authorId: activeUser.id },
                { editors: { some: { id: activeUser.id } } },
                { viewers: { some: { id: activeUser.id } } },
                { editGroups: { some: { users: { some: { id: activeUser.id } } } } },
                { viewGroups: { some: { users: { some: { id: activeUser.id } } } } },
                { isPublic: true },
              ],
            },
            include: {
              ...userInfoSelector.authoredMetaRoadmaps.include,
              roadmapVersions: {
                where: {
                  OR: [
                    { authorId: activeUser.id },
                    { editors: { some: { id: activeUser.id } } },
                    { viewers: { some: { id: activeUser.id } } },
                    { editGroups: { some: { users: { some: { id: activeUser.id } } } } },
                    { viewGroups: { some: { users: { some: { id: activeUser.id } } } } },
                    { isPublic: true },
                  ],
                },
                include: userInfoSelector.authoredMetaRoadmaps.include.roadmapVersions.include,
              },
            },
          },
        },
      });

      // Sort roadmaps and meta roadmaps
      fetchedUser?.authoredRoadmaps.sort(roadmapSorter);
      fetchedUser?.authoredMetaRoadmaps.sort(metaRoadmapSorter);

      return fetchedUser;
    }
    catch (error) {
      console.log(error);
      console.log('Error user fetching authored posts');
      return null;
    }
  }

  // If active user is not logged in, get relevant public roadmaps
  try {
    const fetchedUser = await prisma.user.findUnique({
      where: { username },
      select: {
        ...userInfoSelector,
        authoredRoadmaps: {
          where: {
            isPublic: true,
          },
          include: userInfoSelector.authoredRoadmaps.include,
        },
        authoredMetaRoadmaps: {
          where: {
            isPublic: true,
          },
          include: {
            ...userInfoSelector.authoredMetaRoadmaps.include,
            roadmapVersions: {
              where: {
                isPublic: true,
              },
              include: userInfoSelector.authoredMetaRoadmaps.include.roadmapVersions.include,
            },
          },
        },
      },
    });

    // Sort roadmaps and meta roadmaps
    fetchedUser?.authoredRoadmaps.sort(roadmapSorter);
    fetchedUser?.authoredMetaRoadmaps.sort(metaRoadmapSorter);

    return fetchedUser;
  }
  catch (error) {
    console.log(error);
    console.log('Error public fetching authored posts');
    return null;
  }
};