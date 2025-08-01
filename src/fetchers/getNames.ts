import "server-only";
import { nameSelector } from "@/fetchers/inclusionSelectors";
import { getSession, LoginData } from "@/lib/session";
import prisma from "@/prismaClient";
import { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { cookies } from "next/headers";

/**
 * Gets names and ids of all meta roadmaps, roadmaps, goals, and actions. Mainly intended for breadcrumbs, but could be useful for other things too.
 * 
 * Returns an empty array if user does not have access to any roadmaps. Also returns an empty array on error.
 * @returns Nested array of meta roadmaps, roadmaps, goals, and actions (just ids and names, plus indicator parameter for goals, and a version rather than name for roadmaps)
 */
export default async function getNames() {
  const session = await getSession(await cookies());
  return getCachedNames(session.user);
}

/**
 * Caches names and ids of all roadmaps, goals, and actions.
 * Cache is invalidated when `revalidateTag()` is called on one of its tags `['database', 'roadmap', 'goal', 'action']`, which is done in relevant API routes.
 * @param user Data from user's session cookie.
 */
const getCachedNames = unstable_cache(
  async (user: LoginData['user']) => {
    let names: Prisma.MetaRoadmapGetPayload<{
      select: typeof nameSelector
    }>[] = [];

    // If user is admin, get all roadmaps
    if (user?.isAdmin) {
      try {
        names = await prisma.metaRoadmap.findMany({
          select: nameSelector,
        });
      } catch (error) {
        console.log(error);
        console.log('Error fetching admin names');
        return [];
      }

      return names;
    }

    // If user is logged in, get all roadmaps they have access to
    if (user?.isLoggedIn) {
      try {
        // Get all roadmaps authored by the user
        names = await prisma.metaRoadmap.findMany({
          where: {
            OR: [
              { authorId: user.id },
              { editors: { some: { id: user.id } } },
              { viewers: { some: { id: user.id } } },
              { editGroups: { some: { users: { some: { id: user.id } } } } },
              { viewGroups: { some: { users: { some: { id: user.id } } } } },
              { isPublic: true },
              { roadmapVersions: { some: { authorId: user.id } } },
              { roadmapVersions: { some: { editors: { some: { id: user.id } } } } },
              { roadmapVersions: { some: { viewers: { some: { id: user.id } } } } },
              { roadmapVersions: { some: { editGroups: { some: { users: { some: { id: user.id } } } } } } },
              { roadmapVersions: { some: { viewGroups: { some: { users: { some: { id: user.id } } } } } } },
              { roadmapVersions: { some: { isPublic: true } } },
            ]
          },
          select: nameSelector,
        });
      } catch (error) {
        console.log(error);
        console.log('Error fetching user names');
        return [];
      }

      return names;
    }

    // If user is not logged in, get all public roadmaps
    try {
      names = await prisma.metaRoadmap.findMany({
        where: {
          OR: [
            { isPublic: true },
            { roadmapVersions: { some: { isPublic: true } } },
          ]
        },
        select: nameSelector,
      });
    } catch (error) {
      console.log(error);
      console.log('Error fetching public names');
      return [];
    }

    return names;
  },
  ['getNames'],
  { revalidate: 600, tags: ['database', 'roadmap', 'goal', 'action'] },
);