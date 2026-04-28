import "server-only";
import { multiRoadmapInclusionSelection } from "@/fetchers/inclusionSelectors";
import type { LoginData } from "@/lib/session";
import { getSession } from "@/lib/session";
import { roadmapSorter } from "@/lib/sorters";
import type { Prisma } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { cacheTag } from "next/cache";
import { cookies } from "next/headers";

/**
 * Gets a subset of roadmaps the user has access to, based on the parameters passed to the function.
 * 
 * Returns an empty array if no roadmaps are found or user does not have access to any. Also returns an empty array on error.
 * @param actor Actor to filter by
 * @returns Array of roadmaps
 */
export async function getRoadmapSubset(actor?: string) {
  const session = await getSession(await cookies());
  return getCachedRoadmapSubset(session.user, actor);
}

// Also include the ids of goals and actions under the selected roadmaps
const roadmapSubsetSelect = {
  ...multiRoadmapInclusionSelection,
  goals: { select: { id: true } },
  actions: { select: { id: true } },
}

/**
 * Caches a subset of roadmaps the user has access to, based on the parameters passed to the function.
 * Cache is invalidated when `revalidateTag()` is called on one of its tags `['database', 'roadmap']`, which is done in relevant API routes.
 * @param user Data from user's session cookie.
 * @param actor Actor to filter by
 */
async function getCachedRoadmapSubset(user: LoginData['user'], actor?: string) {
  'use cache'
  cacheTag('database', 'roadmap')
  let roadmaps: Prisma.RoadmapGetPayload<{
    include: typeof roadmapSubsetSelect;
  }>[];

  // If user is admin, get all relevant roadmaps
  if (user?.isAdmin) {
    try {
      roadmaps = await prisma.roadmap.findMany({
        where: {
          metaRoadmap: { actor: actor ?? undefined },
        },
        include: roadmapSubsetSelect
      });
    } catch (error) {
      console.log(error);
      console.log('Error fetching admin roadmaps');
      return [];
    }

    // Sort roadmaps
    roadmaps.sort(roadmapSorter);

    return roadmaps;
  }

  // If user is logged in, get all relevant roadmaps they have access to
  if (user?.isLoggedIn) {
    try {
      roadmaps = await prisma.roadmap.findMany({
        where: {
          metaRoadmap: { actor: actor ?? undefined },
          OR: [
            { authorId: user.id },
            { editors: { some: { id: user.id } } },
            { viewers: { some: { id: user.id } } },
            { editGroups: { some: { users: { some: { id: user.id } } } } },
            { viewGroups: { some: { users: { some: { id: user.id } } } } },
            { isPublic: true },
          ]
        },
        include: roadmapSubsetSelect
      });
    } catch (error) {
      console.log(error);
      console.log('Error fetching user roadmaps');
      return [];
    }

    // Sort roadmaps
    roadmaps.sort(roadmapSorter);

    return roadmaps;
  }

  // If user is not logged in, get all public roadmaps
  try {
    roadmaps = await prisma.roadmap.findMany({
      where: {
        metaRoadmap: { actor: actor ?? undefined },
        isPublic: true,
      },
      include: roadmapSubsetSelect
    });
  } catch (error) {
    console.log(error);
    console.log('Error fetching public roadmaps');
    return [];
  }

  // Sort roadmaps
  roadmaps.sort(roadmapSorter);

  return roadmaps;
};