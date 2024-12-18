'use server';

import { getSession, LoginData } from "@/lib/session";
import { metaRoadmapSorter } from "@/lib/sorters";
import prisma from "@/prismaClient";
import { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { cookies } from "next/headers";

/**
 * Get all meta roadmaps the user has access to, as well as the different versions the user has access to.
 * 
 * Returns an empty array if none are found or user does not have access to any. Also returns an empty array on error.
 * @returns Array of meta roadmaps
 */
export default async function getMetaRoadmaps() {
  const session = await getSession(cookies());
  return getCachedMetaRoadmaps(session.user);
}

/**
 * Caches all meta roadmaps the user has access to.
 * Cache is invalidated when `revalidateTag()` is called on one of its tags `['database', 'metaRoadmap', 'roadmap']`, which is done in relevant API routes.
 * @param user Data from user's session cookie.
 */
const getCachedMetaRoadmaps = unstable_cache(
  async (user: LoginData['user']) => {
    let metaRoadmaps: Prisma.MetaRoadmapGetPayload<{
      include: {
        roadmapVersions: {
          include: {
            metaRoadmap: true,
            _count: { select: { goals: true } },
            author: { select: { id: true, username: true } },
            editors: { select: { id: true, username: true } },
            viewers: { select: { id: true, username: true } },
            editGroups: { include: { users: { select: { id: true, username: true } } } },
            viewGroups: { include: { users: { select: { id: true, username: true } } } },
          },
        },
        comments: true,
        links: true,
        author: { select: { id: true, username: true } },
        editors: { select: { id: true, username: true } },
        viewers: { select: { id: true, username: true } },
        editGroups: { include: { users: { select: { id: true, username: true } } } },
        viewGroups: { include: { users: { select: { id: true, username: true } } } },
      }
    }>[] = [];

    // If user is admin, get all meta roadmaps
    if (user?.isAdmin) {
      try {
        metaRoadmaps = await prisma.metaRoadmap.findMany({
          include: {
            roadmapVersions: {
              include: {
                metaRoadmap: true,
                _count: { select: { goals: true } },
                author: { select: { id: true, username: true } },
                editors: { select: { id: true, username: true } },
                viewers: { select: { id: true, username: true } },
                editGroups: { include: { users: { select: { id: true, username: true } } } },
                viewGroups: { include: { users: { select: { id: true, username: true } } } },
              },
            },
            comments: true,
            links: true,
            author: { select: { id: true, username: true } },
            editors: { select: { id: true, username: true } },
            viewers: { select: { id: true, username: true } },
            editGroups: { include: { users: { select: { id: true, username: true } } } },
            viewGroups: { include: { users: { select: { id: true, username: true } } } },
          },
        });
      } catch (error) {
        console.log(error);
        console.log('Error fetching admin meta roadmaps');
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
            ]
          },
          include: {
            roadmapVersions: {
              where: {
                OR: [
                  { authorId: user.id },
                  { editors: { some: { id: user.id } } },
                  { viewers: { some: { id: user.id } } },
                  { editGroups: { some: { users: { some: { id: user.id } } } } },
                  { viewGroups: { some: { users: { some: { id: user.id } } } } },
                  { isPublic: true },
                ]
              },
              include: {
                metaRoadmap: true,
                _count: { select: { goals: true } },
                author: { select: { id: true, username: true } },
                editors: { select: { id: true, username: true } },
                viewers: { select: { id: true, username: true } },
                editGroups: { include: { users: { select: { id: true, username: true } } } },
                viewGroups: { include: { users: { select: { id: true, username: true } } } },
              },
            },
            comments: true,
            links: true,
            author: { select: { id: true, username: true } },
            editors: { select: { id: true, username: true } },
            viewers: { select: { id: true, username: true } },
            editGroups: { include: { users: { select: { id: true, username: true } } } },
            viewGroups: { include: { users: { select: { id: true, username: true } } } },
          },
        });
      } catch (error) {
        console.log(error);
        console.log('Error fetching meta roadmaps');
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
          isPublic: true
        },
        include: {
          roadmapVersions: {
            where: {
              isPublic: true
            },
            include: {
              metaRoadmap: true,
              _count: { select: { goals: true } },
              author: { select: { id: true, username: true } },
              editors: { select: { id: true, username: true } },
              viewers: { select: { id: true, username: true } },
              editGroups: { include: { users: { select: { id: true, username: true } } } },
              viewGroups: { include: { users: { select: { id: true, username: true } } } },
            },
          },
          comments: true,
          links: true,
          author: { select: { id: true, username: true } },
          editors: { select: { id: true, username: true } },
          viewers: { select: { id: true, username: true } },
          editGroups: { include: { users: { select: { id: true, username: true } } } },
          viewGroups: { include: { users: { select: { id: true, username: true } } } },
        },
      });
    } catch (error) {
      console.log(error);
      console.log('Error fetching public meta roadmaps');
      return [];
    }

    // Sort roadmaps
    metaRoadmaps.sort(metaRoadmapSorter);

    return metaRoadmaps;
  },
  ['getMetaRoadmaps'],
  { revalidate: 600, tags: ['database', 'metaRoadmap', 'roadmap'] },
);