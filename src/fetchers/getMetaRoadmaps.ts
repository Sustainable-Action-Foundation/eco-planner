import "server-only";
import { metaRoadmapInclusionSelection } from "@/fetchers/inclusionSelectors";
import type { LoginData, MetaRoadmap } from "@/types";
import { getSession } from "@/lib/session";
import { metaRoadmapSorter } from "@/lib/sorters";
import { prisma } from "@/lib/prisma";
import { cacheTag } from "next/cache";
import { cookies } from "next/headers";

/**
 * Get all meta roadmaps the user has access to, as well as the different versions the user has access to.
 * 
 * Returns an empty array if none are found or user does not have access to any. Also returns an empty array on error.
 * @returns Array of meta roadmaps
 */
export async function getMetaRoadmaps() {
  const session = await getSession(await cookies());
  return getCachedMetaRoadmaps(session.user);
}

/**
 * Caches all meta roadmaps the user has access to.
 * Cache is invalidated when `revalidateTag()` is called on one of its tags `['database', 'metaRoadmap', 'roadmap']`, which is done in relevant API routes.
 * @param user Data from user's session cookie.
 */
async function getCachedMetaRoadmaps(user: LoginData['user']) {
  'use cache';
  cacheTag('database', 'metaRoadmap', 'roadmap');

  let metaRoadmaps: MetaRoadmap[];

  // If user is admin, get all meta roadmaps
  if (user?.isAdmin) {
    try {
      metaRoadmaps = await prisma.metaRoadmap.findMany({
        include: metaRoadmapInclusionSelection,
      });
    }
    catch (err) {
      console.error("Error fetching meta roadmaps for admin user", { err });
      return [];
    }

    // Sort roadmaps
    metaRoadmaps.sort(metaRoadmapSorter);

    return metaRoadmaps;
  }

  // If user is logged in, get all meta roadmaps they have access to
  if (user?.isLoggedIn) {
    try {
      metaRoadmaps = await prisma.metaRoadmap.findMany({
        where: {
          OR: [
            { authorId: user.id },
            { editors: { some: { id: user.id } } },
            { viewers: { some: { id: user.id } } },
            { editGroups: { some: { users: { some: { id: user.id } } } } },
            { viewGroups: { some: { users: { some: { id: user.id } } } } },
            { isPublic: true },
          ],
        },
        include: {
          ...metaRoadmapInclusionSelection,
          roadmapVersions: {
            where: {
              OR: [
                { authorId: user.id },
                { editors: { some: { id: user.id } } },
                { viewers: { some: { id: user.id } } },
                { editGroups: { some: { users: { some: { id: user.id } } } } },
                { viewGroups: { some: { users: { some: { id: user.id } } } } },
                { isPublic: true },
              ],
            },
            include: metaRoadmapInclusionSelection.roadmapVersions.include,
          },
        },
      });
    }
    catch (err) {
      console.error(`Error fetching meta roadmaps for user ${user.id}`, { err });
      return [];
    }

    // Sort roadmaps
    metaRoadmaps.sort(metaRoadmapSorter);

    return metaRoadmaps;
  }

  // Get all public meta roadmaps
  try {
    metaRoadmaps = await prisma.metaRoadmap.findMany({
      where: {
        isPublic: true,
      },
      include: {
        ...metaRoadmapInclusionSelection,
        roadmapVersions: {
          where: {
            isPublic: true,
          },
          include: metaRoadmapInclusionSelection.roadmapVersions.include,
        },
      },
    });
  }
  catch (err) {
    console.error("Error fetching public meta roadmaps", { err });
    return [];
  }

  // Sort roadmaps
  metaRoadmaps.sort(metaRoadmapSorter);

  return metaRoadmaps;
};
