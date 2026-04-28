import "server-only";
import { actionInclusionSelection } from "@/fetchers/inclusionSelectors";
import type { LoginData } from "@/lib/session";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { cacheTag } from "next/cache";
import { cookies } from "next/headers";
import type { Action } from "@/types";

/**
 * Gets specified action.
 * 
 * Returns null if action is not found or user does not have access to it. Also returns null on error.
 * @param id ID of the action to get
 * @returns Action object
 */
export async function getOneAction(id: string): Promise<Action | null> {
  const session = await getSession(await cookies());
  return getCachedAction(id, session.user);
}

/**
 * Caches the specified action.
 * Cache is invalidated when `revalidateTag()` is called on one of its tags `['database', 'action']`, which is done in relevant API routes.
 * @param id ID of the action to cache
 * @param user Data from user's session cookie.
 */
async function getCachedAction(id: string, user: LoginData['user']): Promise<Action | null> {
  'use cache'
  cacheTag('database', 'action');
  let action: Action | null;

  // If user is admin, always get the action
  if (user?.isAdmin) {
    try {
      action = await prisma.action.findUnique({
        where: { id },
        include: actionInclusionSelection,
      }) satisfies Action | null;
    } catch (error) {
      console.log(error);
      console.log('Error fetching admin action');
      return null;
    }

    return action;
  }

  // If user is logged in, get the action if they have access to it
  if (user?.isLoggedIn) {
    try {
      action = await prisma.action.findUnique({
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
        include: actionInclusionSelection,
      }) satisfies Action | null;
    } catch (error) {
      console.log(error);
      console.log('Error fetching action');
      return null;
    }

    return action;
  }

  // If user is not logged in, get the action if it is public
  try {
    action = await prisma.action.findUnique({
      where: {
        id,
        roadmap: { isPublic: true }
      },
      include: actionInclusionSelection,
    }) satisfies Action | null;
  } catch (error) {
    console.log(error);
    console.log('Error fetching public action');
    return null;
  }

  return action;
};