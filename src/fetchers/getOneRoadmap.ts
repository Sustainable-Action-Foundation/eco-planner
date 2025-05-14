'use server';

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
  return getCachedRoadmap(id, session.user)
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
    actions: roadmap.actions.map(action => ({
      id: action.id,
      name: action.name,
      description: action.description,
      startYear: action.startYear,
      endYear: action.endYear,
      costEfficiency: action.costEfficiency,
      expectedOutcome: action.expectedOutcome,
      _count: action._count,
      isSufficiency: action.isSufficiency,
      isEfficiency: action.isEfficiency,
      isRenewables: action.isRenewables,
      roadmapId: action.roadmapId,
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
        include: roadmapInclusionSelection
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
  { revalidate: 600, tags: ['database', 'roadmap', 'goal', 'action'] },
);