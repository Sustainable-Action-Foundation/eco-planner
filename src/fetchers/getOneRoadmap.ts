import "server-only";
import { roadmapInclusionSelection } from "@/fetchers/inclusionSelectors";
import { getSession, LoginData } from "@/lib/session"
import { goalSorter } from "@/lib/sorters";
import prisma from "@/prismaClient";
import { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { cookies } from "next/headers";

/**
 * Gets specified roadmap and all goals for that roadmap.
 * 
 * Returns null if roadmap is not found or user does not have access to it. Also returns null on error.
 * @param id ID of the roadmap to get
 * @returns Roadmap object with goals
 */
export default async function getOneRoadmap(id: string) {
  const session = await getSession(await cookies());
  return await getCachedRoadmap(id, session.user)
}

/**
 * Caches the specified roadmap and all goals for that roadmap.
 * Cache is invalidated when `revalidateTag()` is called on one of its tags `['database', 'roadmap', 'goal']`, which is done in relevant API routes.
 * @param id ID of the roadmap to cache
 * @param user Data from user's session cookie.
 */
const getCachedRoadmap = unstable_cache(
  async (id: string, user: LoginData['user']) => {
    let roadmap: Prisma.RoadmapGetPayload<{
      include: typeof roadmapInclusionSelection
    }> | null = null;

    // If user is admin, always get the roadmap
    if (user?.isAdmin) {
      try {
        roadmap = await prisma.roadmap.findUnique({
          where: { id },
          include: roadmapInclusionSelection
        });
      } catch (error) {
        console.error(`Error fetching admin roadmap with ID ${id}:`, error);
        return null
      }

      roadmap?.goals.sort(goalSorter);

      return roadmap;
    }

    // If user is logged in, get the roadmap if they have access to it
    if (user?.isLoggedIn) {
      try {
        roadmap = await prisma.roadmap.findUnique({
          where: {
            id,
            OR: [
              { authorId: user.id },
              { editors: { some: { id: user.id } } },
              { viewers: { some: { id: user.id } } },
              { editGroups: { some: { users: { some: { id: user.id } } } } },
              { viewGroups: { some: { users: { some: { id: user.id } } } } },
              { isPublic: true }
            ]
          },
          include: roadmapInclusionSelection
        });
      } catch (error) {
        console.error(`Error fetching roadmap with ID ${id} for user ${user.id}:`, error);
        return null
      }

      roadmap?.goals.sort(goalSorter);

      return roadmap;
    }

    // If user is not logged in, get the roadmap if it is public
    try {
      roadmap = await prisma.roadmap.findUnique({
        where: {
          id,
          isPublic: true,
        },
        include: roadmapInclusionSelection
      });
    } catch (error) {
      console.error(`Error fetching public roadmap with ID ${id}:`, error);
      return null
    }

    roadmap?.goals.sort(goalSorter);

    return roadmap;
  },
  ['getOneRoadmap'],
  { revalidate: 600, tags: ['database', 'roadmap', 'goal', 'action'] },
);