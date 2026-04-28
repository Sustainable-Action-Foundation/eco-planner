import "server-only";
import type { LoginData } from "@/lib/session";
import { getSession } from "@/lib/session";
import { cacheTag } from "next/cache";
import { cookies } from "next/headers";
import { effectInclusionSelection } from "@/fetchers/inclusionSelectors";
import { prisma } from "@/lib/prisma";
import type { Effect } from "@/types";

/**
 * Gets specified effect as well as its action and goal.
 * Requires user to have view access to both the action *and* the goal.
 * 
 * Returns null if the effect does not exist or the user does not have access to it. Also returns null on error.
 * @param actionId ID of the action this effect relates to
 * @param goalId ID of the goal this effect relates to
 * @returns Effect object with action and goal
 */
export async function getOneEffect(actionId: string, goalId: string): Promise<Effect | null> {
  const session = await getSession(await cookies());
  return getCachedEffect(actionId, goalId, session.user);
}

/**
 * Caches the specified effect as well as its action and goal.
 */
async function getCachedEffect(actionId: string, goalId: string, user: LoginData['user']): Promise<Effect | null> {
  'use cache'
  cacheTag('database', 'action', 'goal', 'effect');

  let effect: Effect | null;

  // If user is admin, get effect without checking access
  if (user?.isAdmin) {
    try {
      effect = await prisma.effect.findUnique({
        where: { id: { actionId, goalId } },
        include: effectInclusionSelection,
      }) satisfies Effect | null;
    } catch (error) {
      console.log(error);
      console.log('Error fetching admin effect');
      return null;
    }

    return effect;
  }

  // Get effect with access check
  if (user?.isLoggedIn) {
    try {
      effect = await prisma.effect.findUnique({
        where: {
          id: { actionId, goalId },
          action: {
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
          goal: {
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
          }
        },
        include: effectInclusionSelection,
      }) satisfies Effect | null;
    } catch (error) {
      console.log(error);
      console.log('Error fetching user effect');
      return null;
    }

    return effect;
  }

  // If user is not logged in, get the effect if it is public
  try {
    effect = await prisma.effect.findUnique({
      where: {
        id: { actionId, goalId },
        action: { roadmap: { isPublic: true } },
        goal: { roadmap: { isPublic: true } }
      },
      include: effectInclusionSelection,
    }) satisfies Effect | null;
  } catch (error) {
    console.log(error);
    console.log('Error fetching public effect');
    return null;
  }

  return effect;
};