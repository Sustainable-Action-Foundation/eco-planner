import "server-only";
import { metaRoadmapInclusionSelection } from "@/fetchers/inclusionSelectors";
import type { LoginData } from "@/lib/session";
import { getSession } from "@/lib/session";
import { roadmapSorter } from "@/lib/sorters";
import prisma from "@/prismaClient";
import { cacheTag } from "next/cache";
import { cookies } from "next/headers";
import type { MetaRoadmap } from "@/types";

/**
 * Gets specified meta roadmap and all versions for that meta roadmap.
 * 
 * Returns null if meta roadmap is not found or user does not have access to it. Also returns null on error.
 * @returns Meta roadmap object with roadmap versions
 */
export async function getOneMetaRoadmap(id: string): Promise<MetaRoadmap | null> {
  const session = await getSession(await cookies());
  return getCachedMetaRoadmap(id, session.user);
}

/**
 * Caches the specified meta roadmap.
 * Cache is invalidated when `revalidateTag()` is called on one of its tags `['database', 'metaRoadmap', 'roadmap']`, which is done in relevant API routes.
 * @param user Data from user's session cookie.
 */
async function getCachedMetaRoadmap(id: string, user: LoginData['user']) {
  'use cache'
  cacheTag('database', 'metaRoadmap', 'roadmap');
  let metaRoadmap: MetaRoadmap | null;

  // If user is admin, get all meta roadmaps
  if (user?.isAdmin) {
    try {
      metaRoadmap = await prisma.metaRoadmap.findUnique({
        where: { id },
        include: metaRoadmapInclusionSelection,
      }) satisfies MetaRoadmap | null;
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
      }) satisfies MetaRoadmap | null;
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
    }) satisfies MetaRoadmap | null;
  } catch (error) {
    console.log(error);
    console.log('Error fetching public meta roadmaps');
    return null;
  }

  // Sort roadmap versions
  metaRoadmap?.roadmapVersions.sort(roadmapSorter);

  return metaRoadmap;
};