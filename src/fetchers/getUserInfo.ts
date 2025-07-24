import "server-only";
import { userInfoSelector } from "@/fetchers/inclusionSelectors";
import { getSession, LoginData } from "@/lib/session";
import { metaRoadmapSorter, roadmapSorter } from "@/lib/sorters";
import prisma from "@/prismaClient";
import { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { cookies } from "next/headers";

/**
 * Gets basic user information and all (accessible) MetaRoadmaps and Roadmaps authored by the user.
 * 
 * Returns null if user is not found. Also returns null on error.
 * @param username Username of the user to get
 * @returns User object with authored roadmaps
 */
export default async function getUserInfo(username: string) {
  const session = await getSession(await cookies());
  return getCachedUserInfo(username, session.user);
}

/**
 * Caches basic user information and all (accessible) MetaRoadmaps and Roadmaps authored by the user.
 * Cache is invalidated when `revalidateTag()` is called on one of its tags `['database', 'user', 'roadmap', 'metaRoadmap']`, which is done in relevant API routes.
 * @param username Username of the user to get
 * @param activeUser Data from requesting user's session cookie.
 */
const getCachedUserInfo = unstable_cache(
  async (username: string, activeUser: LoginData['user']) => {
    let fetchedUser: Prisma.UserGetPayload<{
      select: typeof userInfoSelector;
    }> | null = null;

    // If active user is admin, get all relevant roadmaps
    if (activeUser?.isAdmin) {
      try {
        fetchedUser = await prisma.user.findUnique({
          where: { username },
          select: userInfoSelector,
        });
      } catch (error) {
        console.log(error);
        console.log('Error admin fetching authored posts');
        return null;
      }

      // Sort roadmaps and meta roadmaps
      fetchedUser?.authoredRoadmaps.sort(roadmapSorter);
      fetchedUser?.authoredMetaRoadmaps.sort(metaRoadmapSorter);

      return fetchedUser;
    }

    // If active user is logged in, get relevant roadmaps they have access to
    if (activeUser?.isLoggedIn) {
      try {
        fetchedUser = await prisma.user.findUnique({
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
                ]
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
                ]
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
                    ]
                  },
                  include: userInfoSelector.authoredMetaRoadmaps.include.roadmapVersions.include,
                },
              }
            },
          }
        });
      } catch (error) {
        console.log(error);
        console.log('Error user fetching authored posts');
        return null;
      }

      // Sort roadmaps and meta roadmaps
      fetchedUser?.authoredRoadmaps.sort(roadmapSorter);
      fetchedUser?.authoredMetaRoadmaps.sort(metaRoadmapSorter);

      return fetchedUser;
    }

    // If active user is not logged in, get relevant public roadmaps
    try {
      fetchedUser = await prisma.user.findUnique({
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
        }
      });
    } catch (error) {
      console.log(error);
      console.log('Error public fetching authored posts');
      return null;
    }

    // Sort roadmaps and meta roadmaps
    fetchedUser?.authoredRoadmaps.sort(roadmapSorter);
    fetchedUser?.authoredMetaRoadmaps.sort(metaRoadmapSorter);

    return fetchedUser;
  },
  ['getUserInfo'],
  { revalidate: 600, tags: ['database', 'user', 'roadmap', 'metaRoadmap'] },
)