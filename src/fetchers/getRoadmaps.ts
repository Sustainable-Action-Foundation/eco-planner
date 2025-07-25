import "server-only";
import { getSession, LoginData } from "@/lib/session"
import prisma from "@/prismaClient";
import { roadmapSorter } from "@/lib/sorters";
import { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { cookies } from "next/headers";
import { multiRoadmapInclusionSelection } from "@/fetchers/inclusionSelectors";

/**
 * Gets all roadmaps the user has access to, as well as the count of goals for each roadmap.
 * 
 * Returns an empty array if no roadmaps are found or user does not have access to any. Also returns an empty array on error.
 * @returns Array of roadmaps
 */
export default async function getRoadmaps() {
  const session = await getSession(await cookies());
  return getCachedRoadmaps(session.user);
}

/**
 * Caches all roadmaps the user has access to.
 * Cache is invalidated when `revalidateTag()` is called on one of its tags `['database', 'roadmap']`, which is done in relevant API routes.
 * @param user Data from user's session cookie.
 */
const getCachedRoadmaps = unstable_cache(
  async (user: LoginData['user']) => {
    let roadmaps: Prisma.RoadmapGetPayload<{
      include: typeof multiRoadmapInclusionSelection;
    }>[] = [];

    // If user is admin, get all roadmaps
    if (user?.isAdmin) {
      try {
        roadmaps = await prisma.roadmap.findMany({
          include: multiRoadmapInclusionSelection
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

    // If user is logged in, get all roadmaps they have access to
    if (user?.isLoggedIn) {
      try {
        // Get all roadmaps authored by the user
        roadmaps = await prisma.roadmap.findMany({
          where: {
            OR: [
              { authorId: user.id },
              { editors: { some: { id: user.id } } },
              { viewers: { some: { id: user.id } } },
              { editGroups: { some: { users: { some: { id: user.id } } } } },
              { viewGroups: { some: { users: { some: { id: user.id } } } } },
              { isPublic: true }
            ]
          },
          include: multiRoadmapInclusionSelection
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

    // Get all public roadmaps
    try {
      roadmaps = await prisma.roadmap.findMany({
        where: {
          isPublic: true
        },
        include: multiRoadmapInclusionSelection
      });
    } catch (error) {
      console.log(error);
      console.log('Error fetching public roadmaps');
      return [];
    }

    // Sort roadmaps
    roadmaps.sort(roadmapSorter);

    return roadmaps;
  },
  ['getRoadmaps'],
  { revalidate: 600, tags: ['database', 'roadmap'] },
);