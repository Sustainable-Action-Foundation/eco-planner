import "server-only";
import { goalInclusionSelection } from "@/fetchers/inclusionSelectors";
import { getSession } from "@/lib/session"
import { effectSorter } from "@/lib/sorters";
import prisma from "@/prismaClient";
import { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { cookies } from "next/headers";

// TODO: Check if we need to include data series unit as a key to make sure we don't get the wrong goal

/**
 * Gets specified goal and all actions for that goal.
 * 
 * Returns null if goal is not found or user does not have access to it. Also returns null on error.
 * @param roadmapId ID of the roadmap to search for the goal in
 * @param indicatorParameter Indicator parameter of the goal to get
 * @returns Goal object with actions
 */
export default async function getGoalByIndicator(roadmapId: string, indicatorParameter: string, unit?: string) {
  const session = await getSession(await cookies());
  return getCachedGoal(roadmapId, indicatorParameter, unit, session.user)
}

/**
 * Caches the specified goal and all actions for that goal.
 * Cache is invalidated when `revalidateTag()` is called on one of its tags `['database', 'goal', 'action', 'dataSeries']`, which is done in relevant API routes.
 * @param id ID of the roadmap to search for the goal in
 * @param indicatorParameter Indicator parameter of the goal to cache
 * @param user Data from user's session cookie.
 */
const getCachedGoal = unstable_cache(
  async (roadmapId: string, indicatorParameter: string, unit: string | undefined, user) => {
    let goal: Prisma.GoalGetPayload<{
      include: typeof goalInclusionSelection
    }> | null = null;

    // If user is admin, always get the goal
    if (user?.isAdmin) {
      try {
        goal = await prisma.goal.findFirst({
          where: {
            indicatorParameter: indicatorParameter,
            // If unit is specified, get a goal with the specified unit
            ...(unit ? { dataSeries: { unit: unit } } : {}),
            roadmap: { id: roadmapId },
          },
          include: goalInclusionSelection
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
        goal = await prisma.goal.findFirst({
          where: {
            indicatorParameter: indicatorParameter,
            ...(unit ? { dataSeries: { unit: unit } } : {}),
            roadmap: {
              id: roadmapId,
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
          include: goalInclusionSelection
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
      goal = await prisma.goal.findFirst({
        where: {
          indicatorParameter: indicatorParameter,
          ...(unit ? { dataSeries: { unit: unit } } : {}),
          roadmap: {
            id: roadmapId,
            isPublic: true,
          }
        },
        include: goalInclusionSelection
      });
    } catch (error) {
      console.log(error);
      console.log('Error fetching public goal');
      return null
    }

    goal?.effects.sort(effectSorter);

    return goal;
  },
  ['goalByIndicator'],
  { revalidate: 600, tags: ['database', 'goal', 'action', 'dataSeries'] }
);