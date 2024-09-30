'use server';

import { getSession } from "@/lib/session"
import { goalSorter } from "@/lib/sorters";
import prisma from "@/prismaClient";
import { Comment, DataSeries, Goal, MetaRoadmap, Roadmap } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { cookies } from "next/headers";
import { data } from "node_modules/cypress/types/jquery";

/**
 * Gets specified roadmap and all goals for that roadmap.
 * 
 * Returns null if roadmap is not found or user does not have access to it. Also returns null on error.
 * @param id ID of the roadmap to get
 * @returns Roadmap object with goals
 */
export default async function getOneRoadmap(id: string) {
  const session = await getSession(cookies());
  return getCachedRoadmap(id, session.user?.id ?? '')
}

/**
 * A wrapper for `getOneRoadmap` that excludes sensitive data.
 * 
 * Returns null if roadmap is not found or user does not have access to it. Also returns null on error.
 * @param id ID of the roadmap to get
 * @returns Roadmap object with goals
 */
export async function clientSafeGetOneRoadmap(id: string) {
  const roadmap = await getOneRoadmap(id);
  if (!roadmap) return null;

  return {
    id: roadmap.id,
    description: roadmap.description,
    version: roadmap.version,
    targetVersion: roadmap.targetVersion,
    isPublic: roadmap.isPublic,
    metaRoadmap: {
      id: roadmap.metaRoadmap.id,
      name: roadmap.metaRoadmap.name,
      description: roadmap.metaRoadmap.description,
      type: roadmap.metaRoadmap.type,
      actor: roadmap.metaRoadmap.actor,
      parentRoadmapId: roadmap.metaRoadmap.parentRoadmapId,
      isPublic: roadmap.metaRoadmap.isPublic,
    },
    goals: roadmap.goals.map(goal => ({
      id: goal.id,
      name: goal.name,
      description: goal.description,
      indicatorParameter: goal.indicatorParameter,
      isFeatured: goal.isFeatured,
      externalDataset: goal.externalDataset,
      externalTableId: goal.externalTableId,
      externalSelection: goal.externalSelection,
      combinationScale: goal.combinationScale,
      _count: goal._count,
      dataSeries: (goal.dataSeries ? (({
        createdAt,
        updatedAt,
        authorId,
        ...data
      }) => data)(goal.dataSeries) : null),
    })),
    comments: roadmap.comments?.map(comment => ({
      id: comment.id,
      commentText: comment.commentText,
      actionId: comment.actionId,
      goalId: comment.goalId,
      roadmapId: comment.roadmapId,
      metaRoadmapId: comment.metaRoadmapId,
    })),
  }
}

/**
 * Caches the specified roadmap and all goals for that roadmap.
 * Cache is invalidated when `revalidateTag()` is called on one of its tags `['database', 'roadmap', 'goal']`, which is done in relevant API routes.
 * @param id ID of the roadmap to cache
 * @param userId ID of user. Isn't passed in, but is used to associate the cache with the user.
 */
const getCachedRoadmap = unstable_cache(
  async (id, userId) => {
    const session = await getSession(cookies());

    let roadmap: Roadmap & {
      metaRoadmap: MetaRoadmap,
      goals: (Goal & {
        _count: { actions: number, combinationParents: number },
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
    if (session.user?.isAdmin) {
      try {
        roadmap = await prisma.roadmap.findUnique({
          where: { id },
          include: {
            metaRoadmap: true,
            goals: {
              include: {
                _count: { select: { actions: true, combinationParents: true } },
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
    if (session.user?.isLoggedIn) {
      try {
        roadmap = await prisma.roadmap.findUnique({
          where: {
            id,
            OR: [
              { authorId: session.user.id },
              { editors: { some: { id: session.user.id } } },
              { viewers: { some: { id: session.user.id } } },
              { editGroups: { some: { users: { some: { id: session.user.id } } } } },
              { viewGroups: { some: { users: { some: { id: session.user.id } } } } },
              { isPublic: true }
            ]
          },
          include: {
            metaRoadmap: true,
            goals: {
              include: {
                _count: { select: { actions: true, combinationParents: true } },
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
          id,
          isPublic: true,
        },
        include: {
          metaRoadmap: true,
          goals: {
            include: {
              _count: { select: { actions: true, combinationParents: true } },
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
      console.log('Error fetching public roadmap');
      return null
    }

    roadmap?.goals.sort(goalSorter);

    return roadmap;
  },
  ['getOneRoadmap'],
  { revalidate: 600, tags: ['database', 'roadmap', 'goal'] },
);