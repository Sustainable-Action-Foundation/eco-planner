'use server';

import { getSession, LoginData } from "@/lib/session"
import { goalSorter } from "@/lib/sorters";
import prisma from "@/prismaClient";
import { Comment, DataSeries, Goal, MetaRoadmap, Roadmap } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { cookies } from "next/headers";

/**
 * Gets a roadmap from a meta roadmap ID and version number.
 * 
 * Returns null if roadmap is not found or user does not have access to it. Also returns null on error.
 * @param metaId ID of the meta roadmap to search for a specific version of
 * @param version Version number of the roadmap to get
 * @returns Roadmap object with goals
 */
export default async function getRoadmapByVersion(metaId: string, version: number) {
  const session = await getSession(cookies());
  return getCachedRoadmap(metaId, version, session.user)
}

/**
 * Caches the specified roadmap and all goals for that roadmap.
 * Cache is invalidated when `revalidateTag()` is called on one of its tags `['database', 'roadmap', 'goal']`, which is done in relevant API routes.
 * @param metaId ID of the meta roadmap to search for a specific version of
 * @param version Version number of the roadmap to cache
 * @param user Data from user's session cookie.
 */
const getCachedRoadmap = unstable_cache(
  async (metaId: string, version: number, user: LoginData['user']) => {
    let roadmap: Roadmap & {
      metaRoadmap: MetaRoadmap,
      goals: (Goal & {
        _count: { actions: number },
        dataSeries: DataSeries | null,
        author: { id: string, username: string },
      })[],
      comments?: (Comment & { author: { id: string, username: string } })[],
      author: { id: string, username: string },
      editors: { id: string, username: string }[],
      viewers: { id: string, username: string }[],
      editGroups: { id: string, name: string, users: { id: string, username: string }[] }[],
      viewGroups: { id: string, name: string, users: { id: string, username: string }[] }[],
    } | null = null;

    // If user is admin, always get the roadmap
    if (user?.isAdmin) {
      try {
        roadmap = await prisma.roadmap.findUnique({
          where: { meta_version: { metaRoadmapId: metaId, version } },
          include: {
            metaRoadmap: true,
            goals: {
              include: {
                _count: { select: { actions: true } },
                dataSeries: true,
                author: { select: { id: true, username: true } },
              }
            },
            comments: {
              include: {
                author: { select: { id: true, username: true } },
              },
            },
            author: { select: { id: true, username: true } },
            editors: { select: { id: true, username: true } },
            viewers: { select: { id: true, username: true } },
            editGroups: { include: { users: { select: { id: true, username: true } } } },
            viewGroups: { include: { users: { select: { id: true, username: true } } } },
          }
        });
      } catch (error) {
        console.log(error);
        console.log('Error fetching admin roadmap');
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
            meta_version: { metaRoadmapId: metaId, version },
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
            metaRoadmap: true,
            goals: {
              include: {
                _count: { select: { actions: true } },
                dataSeries: true,
                author: { select: { id: true, username: true } },
              }
            },
            author: { select: { id: true, username: true } },
            editors: { select: { id: true, username: true } },
            viewers: { select: { id: true, username: true } },
            editGroups: { include: { users: { select: { id: true, username: true } } } },
            viewGroups: { include: { users: { select: { id: true, username: true } } } },
          }
        });
      } catch (error) {
        console.log(error);
        console.log('Error fetching user roadmap');
        return null
      }

      roadmap?.goals.sort(goalSorter);

      return roadmap;
    }

    // If user is not logged in, get the roadmap if it is public
    try {
      roadmap = await prisma.roadmap.findUnique({
        where: {
          meta_version: { metaRoadmapId: metaId, version },
          isPublic: true,
        },
        include: {
          metaRoadmap: true,
          goals: {
            include: {
              _count: { select: { actions: true } },
              dataSeries: true,
              author: { select: { id: true, username: true } },
            }
          },
          author: { select: { id: true, username: true } },
          editors: { select: { id: true, username: true } },
          viewers: { select: { id: true, username: true } },
          editGroups: { include: { users: { select: { id: true, username: true } } } },
          viewGroups: { include: { users: { select: { id: true, username: true } } } },
        }
      });
    } catch (error) {
      console.log(error);
      console.log('Error fetching public roadmap');
      return null
    }

    roadmap?.goals.sort(goalSorter);

    return roadmap;
  },
  ['roadmapByVersion'],
  { revalidate: 600, tags: ['database', 'roadmap', 'goal'] },
);