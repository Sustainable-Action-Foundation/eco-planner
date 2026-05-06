import "server-only";
import type { LoginData } from "@/lib/session";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { roadmapSorter } from "@/lib/sorters";
import { cacheTag } from "next/cache";
import { cookies } from "next/headers";
import { multiRoadmapInclusionSelection } from "@/fetchers/inclusionSelectors";
import type { MultiRoadmapInstance } from "@/types";

/**
 * Gets all roadmaps the user has access to, as well as the count of goals for each roadmap.
 * 
 * Returns an empty array if no roadmaps are found or user does not have access to any. Also returns an empty array on error.
 * @returns Array of roadmaps
 */
export async function getRoadmaps(roadmapIds?: string[]): Promise<MultiRoadmapInstance[]> {
  const session = await getSession(await cookies());
  return getCachedRoadmaps(session.user, roadmapIds);
}

/**
 * Caches all roadmaps the user has access to.
 * Cache is invalidated when `revalidateTag()` is called on one of its tags `['database', 'roadmap']`, which is done in relevant API routes.
 * @param user Data from user's session cookie.
 */
async function getCachedRoadmaps(user: LoginData['user'], roadmapIds?: string[]): Promise<MultiRoadmapInstance[]> {
  'use cache';
  cacheTag('database', 'roadmap');
  let roadmaps: MultiRoadmapInstance[];

  // If user is admin, get all roadmaps
  if (user?.isAdmin) {
    try {
      roadmaps = await prisma.roadmap.findMany({
        ...(roadmapIds ? { where: { id: { in: roadmapIds } } } : {}), // If roadmapIds is provided, filter by it
        include: multiRoadmapInclusionSelection,
      }) satisfies MultiRoadmapInstance[];
    } catch (error) {
      console.log(error);
      console.log('Error fetching admin roadmaps');
      return [];
    }

    // Sort roadmaps
    roadmaps.sort(roadmapSorter);

    return roadmaps;
  }

  // If user is logged in, get all roadmaps they have access to
  if (user?.isLoggedIn) {
    try {
      // Get all roadmaps authored by the user
      roadmaps = await prisma.roadmap.findMany({
        where: {
          ...(roadmapIds ? { id: { in: roadmapIds } } : {}), // If roadmapIds is provided, filter by it
          OR: [
            { authorId: user.id },
            { editors: { some: { id: user.id } } },
            { viewers: { some: { id: user.id } } },
            { editGroups: { some: { users: { some: { id: user.id } } } } },
            { viewGroups: { some: { users: { some: { id: user.id } } } } },
            { isPublic: true },
          ],
        },
        include: multiRoadmapInclusionSelection,
      }) satisfies MultiRoadmapInstance[];
    } catch (error) {
      console.log(error);
      console.log('Error fetching user roadmaps');
      return [];
    }

    // Sort roadmaps
    roadmaps.sort(roadmapSorter);

    return roadmaps;
  }

  // Get all public roadmaps
  try {
    roadmaps = await prisma.roadmap.findMany({
      where: {
        ...(roadmapIds ? { id: { in: roadmapIds } } : {}), // If roadmapIds is provided, filter by it
        isPublic: true,
      },
      include: multiRoadmapInclusionSelection,
    }) satisfies MultiRoadmapInstance[];
  } catch (error) {
    console.log(error);
    console.log('Error fetching public roadmaps');
    return [];
  }

  // Sort roadmaps
  roadmaps.sort(roadmapSorter);

  return roadmaps;
};