'use server';

import { actionInclusionSelection } from "@/fetchers/inclusionSelectors";
import { getSession, LoginData } from "@/lib/session";
import prisma from "@/prismaClient";
import type { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { cookies } from "next/headers";

/**
 * Gets specified action.
 * 
 * Returns null if action is not found or user does not have access to it. Also returns null on error.
 * @param id ID of the action to get
 * @returns Action object
 */
export default async function getOneAction(id: string) {
  const session = await getSession(cookies());
  return getCachedAction(id, session.user);
}

/**
 * Caches the specified action.
 * Cache is invalidated when `revalidateTag()` is called on one of its tags `['database', 'action']`, which is done in relevant API routes.
 * @param id ID of the action to cache
 * @param user Data from user's session cookie.
 */
const getCachedAction = unstable_cache(
  async (id: string, user: LoginData['user']) => {
    let action: Prisma.ActionGetPayload<{
      include: typeof actionInclusionSelection;
    }> | null = null;

    // If user is admin, always get the action
    if (user?.isAdmin) {
      try {
        action = await prisma.action.findUnique({
          where: { id },
          include: actionInclusionSelection,
        });
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
        });
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
      });
    } catch (error) {
      console.log(error);
      console.log('Error fetching public action');
      return null;
    }

    return action;
  },
  ['getOneAction'],
  { revalidate: 600, tags: ['database', 'action'] }
)