import "server-only";
import { goalInclusionSelection } from "@/fetchers/inclusionSelectors";
import type { LoginData } from "@/lib/session";
import { getSession } from "@/lib/session";
import { effectSorter } from "@/lib/sorters";
import { prisma } from "@/lib/prisma";
import { cacheTag } from "next/cache";
import { cookies } from "next/headers";
import type { Goal } from "@/types";

// TODO: Check if we need to include data series unit as a key to make sure we don't get the wrong goal

/**
 * Gets specified goal and all actions for that goal.
 * 
 * Returns null if goal is not found or user does not have access to it. Also returns null on error.
 * @param roadmapId ID of the roadmap to search for the goal in
 * @param indicatorParameter Indicator parameter of the goal to get
 * @param unit If not undefined, the goal must have this unit in its data series (even if unit is null)
 * @returns Goal object with actions
 */
export async function getGoalByIndicator(roadmapId: string, indicatorParameter: string, unit?: string | null) {
  const session = await getSession(await cookies());
  return getCachedGoal(roadmapId, indicatorParameter, unit, session.user);
}

/**
 * Caches the specified goal and all actions for that goal.
 * Cache is invalidated when `revalidateTag()` is called on one of its tags `['database', 'goal', 'action', 'dataSeries']`, which is done in relevant API routes.
 * @param id ID of the roadmap to search for the goal in
 * @param indicatorParameter Indicator parameter of the goal to cache
 * @param user Data from user's session cookie.
 */
async function getCachedGoal(roadmapId: string, indicatorParameter: string, unit: string | undefined | null, user: LoginData["user"]) {
  'use cache';
  cacheTag('database', 'goal', 'action', 'dataSeries');

  let goal: Goal | null;

  // If user is admin, always get the goal
  if (user?.isAdmin) {
    try {
      goal = await prisma.goal.findFirst({
        where: {
          indicatorParameter: indicatorParameter,
          // If unit is specified, get a goal with the specified unit
          ...(unit !== undefined ? { dataSeries: { unit: unit } } : {}),
          roadmap: { id: roadmapId },
        },
        include: goalInclusionSelection,
      });
    }
    catch (error) {
      console.error(`Error fetching goal with indicatorParameter ${indicatorParameter} and unit ${unit} for roadmap ${roadmapId}`, { error });
      return null;
    }

    goal?.effects.sort(effectSorter);

    return goal;
  }

  // If user is logged in, get the goal if they have access to it
  if (user?.isLoggedIn) {
    try {
      goal = await prisma.goal.findFirst({
        where: {
          indicatorParameter: indicatorParameter,
          ...(unit !== undefined ? { dataSeries: { unit: unit } } : {}),
          roadmap: {
            id: roadmapId,
            OR: [
              { authorId: user.id },
              { editors: { some: { id: user.id } } },
              { viewers: { some: { id: user.id } } },
              { editGroups: { some: { users: { some: { id: user.id } } } } },
              { viewGroups: { some: { users: { some: { id: user.id } } } } },
              { isPublic: true },
            ],
          },
        },
        include: goalInclusionSelection,
      });
    }
    catch (error) {
      console.error(`Error fetching goal with indicatorParameter ${indicatorParameter} and unit ${unit} for roadmap ${roadmapId} and user ${user.id}`, { error });
      return null;
    }

    goal?.effects.sort(effectSorter);

    return goal;
  }

  // If user is not logged in, get the goal if it is public
  try {
    goal = await prisma.goal.findFirst({
      where: {
        indicatorParameter: indicatorParameter,
        ...(unit !== undefined ? { dataSeries: { unit: unit } } : {}),
        roadmap: {
          id: roadmapId,
          isPublic: true,
        },
      },
      include: goalInclusionSelection,
    });
  } 
  catch (error) {
    console.error(`Error fetching goal with indicatorParameter ${indicatorParameter} and unit ${unit} for roadmap ${roadmapId} for public user`, { error });
    return null;
  }

  goal?.effects.sort(effectSorter);

  return goal;
};