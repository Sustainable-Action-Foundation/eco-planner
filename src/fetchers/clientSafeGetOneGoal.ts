'use server';

import { clientSafeGoalSelection } from "@/fetchers";
import { getSession, LoginData } from "@/lib/session"
import prisma from "@/prismaClient";
import { cookies } from "next/headers";
import { unstable_cacheTag as cacheTag } from 'next/cache'
import { ClientGoal } from "@/types";

/**
 * A function similar to `getOneGoal`, but excluding potentially sensitive data.
 * 
 * Returns null if goal is not found or user does not have access to it. Also returns null on error.
 * @param id ID of the goal to get
 * @returns Goal object with actions
 */
export default async function clientSafeGetOneGoal(id: string): Promise<ClientGoal | null> {
  const session = await getSession(await cookies());
  return clientSafeGetCachedGoal(id, session.user)
}
export { clientSafeGetOneGoal };

async function clientSafeGetCachedGoal(id: string, user: LoginData['user']): Promise<ClientGoal | null> {
  'use cache';
  cacheTag('database', 'goal', 'action', 'dataSeries');

  let goal: ClientGoal | null = null;

  // If user is admin, always get the goal
  if (user?.isAdmin) {
    try {
      goal = await prisma.goal.findUnique({
        where: { id },
        select: clientSafeGoalSelection,
      }) satisfies ClientGoal | null;
    } catch (error) {
      console.log(error);
      console.log('Error fetching admin goal');
      return null;
    }

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
        select: clientSafeGoalSelection,
      }) satisfies ClientGoal | null;
    } catch (error) {
      console.log(error);
      console.log('Error fetching user goal');
      return null
    }

    return goal;
  }

  // If user is not logged in, get the goal if it is public
  try {
    goal = await prisma.goal.findUnique({
      where: {
        id,
        roadmap: { isPublic: true }
      },
      select: clientSafeGoalSelection,
    }) satisfies ClientGoal | null;
  } catch (error) {
    console.log(error);
    console.log('Error fetching public goal');
    return null
  }

  return goal;
}