'use server';

import { goalInclusionSelection } from "@/fetchers/inclusionSelectors";
import { getSession, LoginData } from "@/lib/session"
import { effectSorter } from "@/lib/sorters";
import prisma from "@/prismaClient";
import { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { cookies } from "next/headers";

/**
 * Gets specified goal and all actions for that goal.
 * 
 * Returns null if goal is not found or user does not have access to it. Also returns null on error.
 * @param id ID of the goal to get
 * @returns Goal object with actions
 */
export default async function getOneGoal(id: string) {
  const session = await getSession(cookies());
  return getCachedGoal(id, session.user)
}

/**
 * A wrapper for `getOneGoal` that excludes sensitive data.
 * 
 * Returns null if goal is not found or user does not have access to it. Also returns null on error.
 * @param id ID of the goal to get
 * @returns Goal object with actions
 */
export async function clientSafeGetOneGoal(id: string) {
  const goal = await getOneGoal(id);
  if (!goal) return null;

  return {
    id: goal.id,
    name: goal.name,
    description: goal.description,
    indicatorParameter: goal.indicatorParameter,
    isFeatured: goal.isFeatured,
    externalDataset: goal.externalDataset,
    externalTableId: goal.externalTableId,
    externalSelection: goal.externalSelection,
    combinationScale: goal.combinationScale,
    roadmapId: goal.roadmapId,
    _count: goal._count,
    dataSeries: (goal.dataSeries ? (({
      createdAt,
      updatedAt,
      authorId,
      ...data
    }) => data)(goal.dataSeries) : null),
    baselineDataSeries: (goal.baselineDataSeries ? (({
      createdAt,
      updatedAt,
      authorId,
      ...data
    }) => data)(goal.baselineDataSeries) : null),
    combinationParents: goal.combinationParents.map(combination => ({
      resultingGoalId: combination.resultingGoalId,
      parentGoalId: combination.parentGoalId,
      isInverted: combination.isInverted,
      parentGoal: {
        id: combination.parentGoal.id,
        dataSeries: (combination.parentGoal.dataSeries ? (({
          createdAt,
          updatedAt,
          authorId,
          ...data
        }) => data)(combination.parentGoal.dataSeries) : null),
        roadmapId: combination.parentGoal.roadmapId,
      },
    })),
    effects: goal.effects.map(effect => ({
      impactType: effect.impactType,
      actionId: effect.actionId,
      goalId: effect.goalId,
      action: {
        id: effect.action.id,
        name: effect.action.name,
        description: effect.action.description,
      },
      dataSeries: (effect.dataSeries ? (({
        createdAt,
        updatedAt,
        authorId,
        ...data
      }) => data)(effect.dataSeries) : null),
    })),
    roadmap: {
      id: goal.roadmap.id,
      version: goal.roadmap.version,
      targetVersion: goal.roadmap.targetVersion,
      metaRoadmap: {
        id: goal.roadmap.metaRoadmap.id,
        name: goal.roadmap.metaRoadmap.name,
        parentRoadmapId: goal.roadmap.metaRoadmap.parentRoadmapId,
      },
    },
    links: goal.links,
    comments: goal.comments?.map(comment => ({
      id: comment.id,
      commentText: comment.commentText,
      actionId: comment.actionId,
      goalId: comment.goalId,
      roadmapId: comment.roadmapId,
      metaRoadmapId: comment.metaRoadmapId,
    })),
  };
}

/**
 * Caches the specified goal and all actions for that goal.
 * Cache is invalidated when `revalidateTag()` is called on one of its tags `['database', 'goal', 'action', 'dataSeries']`, which is done in relevant API routes.
 * @param id ID of the goal to cache
 * @param user Data from user's session cookie.
 */
const getCachedGoal = unstable_cache(
  async (id: string, user: LoginData['user']) => {
    let goal: Prisma.GoalGetPayload<{
      include: typeof goalInclusionSelection;
    }> | null = null;

    // If user is admin, always get the goal
    if (user?.isAdmin) {
      try {
        goal = await prisma.goal.findUnique({
          where: { id },
          include: goalInclusionSelection,
        });
      } catch (error) {
        console.log(error);
        console.log('Error fetching admin goal');
        return null
      }

      goal?.effects.sort(effectSorter);

      return goal;
    }

    // If user is logged in, get the goal if they have access to it
    if (user?.isLoggedIn) {
      try {
        goal = await prisma.goal.findUnique({
          where: {
            id,
            roadmap: {
              OR: [
                { authorId: user.id },
                { editors: { some: { id: user.id } } },
                { viewers: { some: { id: user.id } } },
                { editGroups: { some: { users: { some: { id: user.id } } } } },
                { viewGroups: { some: { users: { some: { id: user.id } } } } },
                { isPublic: true }
              ]
            }
          },
          include: goalInclusionSelection,
        });
      } catch (error) {
        console.log(error);
        console.log('Error fetching user goal');
        return null
      }

      goal?.effects.sort(effectSorter);

      return goal;
    }

    // If user is not logged in, get the goal if it is public
    try {
      goal = await prisma.goal.findUnique({
        where: {
          id,
          roadmap: { isPublic: true }
        },
        include: goalInclusionSelection,
      });
    } catch (error) {
      console.log(error);
      console.log('Error fetching public goal');
      return null
    }

    goal?.effects.sort(effectSorter);

    return goal;
  },
  ['getOneGoal'],
  { revalidate: 600, tags: ['database', 'goal', 'action', 'dataSeries'] }
);