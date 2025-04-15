'use server';

import { metaRoadmapInclusionSelection } from "@/fetchers/inclusionSelectors";
import { getSession, LoginData } from "@/lib/session";
import { roadmapSorter } from "@/lib/sorters";
import prisma from "@/prismaClient";
import { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { cookies } from "next/headers";

/**
 * Gets specified meta roadmap and all versions for that meta roadmap.
 * 
 * Returns null if meta roadmap is not found or user does not have access to it. Also returns null on error.
 * @returns Meta roadmap object with roadmap versions
 */
export default async function getOneMetaRoadmap(id: string) {
  const session = await getSession(await cookies());
  return getCachedMetaRoadmap(id, session.user);
}

/**
 * Caches the specified meta roadmap.
 * Cache is invalidated when `revalidateTag()` is called on one of its tags `['database', 'metaRoadmap', 'roadmap']`, which is done in relevant API routes.
 * @param user Data from user's session cookie.
 */
const getCachedMetaRoadmap = unstable_cache(
  async (id: string, user: LoginData['user']) => {
    let metaRoadmap: Prisma.MetaRoadmapGetPayload<{
      include: typeof metaRoadmapInclusionSelection
    }> | null = null;

    // If user is admin, get all meta roadmaps
    if (user?.isAdmin) {
      try {
        metaRoadmap = await prisma.metaRoadmap.findUnique({
          where: { id },
          include: metaRoadmapInclusionSelection,
        });
      } catch (error) {
        console.log(error);
        console.log('Error fetching admin meta roadmaps');
        return null;
      }

      // Sort roadmap versions
      metaRoadmap?.roadmapVersions.sort(roadmapSorter);

      return metaRoadmap;
    }

    // If user is logged in, get all meta roadmaps they have access to
    if (user?.isLoggedIn) {
      try {
        metaRoadmap = await prisma.metaRoadmap.findUnique({
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
                  { isPublic: true }
                ]
              },
              include: metaRoadmapInclusionSelection.roadmapVersions.include,
            },
          },
        });
      } catch (error) {
        console.log(error);
        console.log('Error fetching meta roadmaps');
        return null;
      }

      // Sort roadmap versions
      metaRoadmap?.roadmapVersions.sort(roadmapSorter);

      return metaRoadmap;
    }

    // Get all public meta roadmaps
    try {
      metaRoadmap = await prisma.metaRoadmap.findUnique({
        where: {
          id,
          isPublic: true
        },
        include: {
          ...metaRoadmapInclusionSelection,
          roadmapVersions: {
            where: {
              isPublic: true
            },
            include: metaRoadmapInclusionSelection.roadmapVersions.include,
          },
        },
      });
    } catch (error) {
      console.log(error);
      console.log('Error fetching public meta roadmaps');
      return null;
    }

    // Sort roadmap versions
    metaRoadmap?.roadmapVersions.sort(roadmapSorter);

    return metaRoadmap;
  },
  ['getOneMetaRoadmap'],
  { revalidate: 600, tags: ['database', 'metaRoadmap', 'roadmap'] },
);