import "server-only";
import { actionInclusionSelection } from "@/fetchers/inclusionSelectors";
import type { Action, LoginData } from "@/types";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { cacheTag } from "next/dist/server/use-cache/cache-tag";

/**
 * Gets all available actions.
 * 
 * Returns an empty array if no actions are found or user does not have access to any. Also returns an empty array on error.
 * @returns Array of actions
 */
export async function getActions() {
  const session = await getSession(await cookies());
  return getCachedActions(session.user);
}

/**
 * Caches available actions per user.
 * @param user Data from user's session cookie.
 */
async function getCachedActions(user: LoginData['user']) {
  'use cache';
  cacheTag('database', 'action');

  // TODO: Use a different inclusion selection, probably excluding effects and parent roadmap
  let actions: Action[];

  // If user is admin, get all actions
  if (user?.isAdmin) {
    try {
      actions = await prisma.action.findMany({
        include: actionInclusionSelection,
      });
    }
    catch (err) {
      console.error("Error fetching admin actions", { err });
      return null;
    }

    return actions;
  }

  // If user is logged in, get the action if they have access to it
  if (user?.isLoggedIn) {
    try {
      actions = await prisma.action.findMany({
        where: {
          roadmap: {
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
        include: actionInclusionSelection,
      });
    }
    catch (err) {
      console.error("Error fetching user actions", { err });
      return null;
    }

    return actions;
  }

  // If user is not logged in, get the action if it is public
  try {
    actions = await prisma.action.findMany({
      where: {
        roadmap: { isPublic: true },
      },
      include: actionInclusionSelection,
    });
  }
  catch (err) {
    console.error("Error fetching public actions", { err });
    return null;
  }

  return actions;
}