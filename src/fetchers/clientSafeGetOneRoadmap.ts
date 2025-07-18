"use server";

import { Prisma } from "@prisma/client";
import prisma from "@/prismaClient";
import { clientSafeRoadmapSelection } from "./inclusionSelectors";
import { cookies } from "next/headers";
import { getSession, LoginData } from "@/lib/session";
import { goalSorter } from "@/lib/sorters";
import { unstable_cacheTag as cacheTag } from 'next/cache'

/**
 * A function similar to `getOneRoadmap`, but excluding potentially sensitive data.
 * 
 * Returns null if roadmap is not found or user does not have access to it. Also returns null on error.
 * @param id ID of the roadmap to get
 * @returns Roadmap object with goals
 */
export default async function clientSafeGetOneRoadmap(id: string) {
  const session = await getSession(await cookies());
  return getCachedClientSafeRoadmap(id, session.user);
}

async function getCachedClientSafeRoadmap(id: string, user: LoginData['user']) {
  'use cache';
  cacheTag('database', 'roadmap', 'goal', 'action');

  let roadmap: Prisma.RoadmapGetPayload<{
    select: typeof clientSafeRoadmapSelection;
  }> | null = null;

  // If user is admin, get all roadmaps
  if (user?.isAdmin) {
    try {
      roadmap = await prisma.roadmap.findUnique({
        where: { id },
        select: clientSafeRoadmapSelection
      });
    } catch (error) {
      console.log(error);
      console.log('Error fetching admin roadmap');
      return null;
    }

    // Sort roadmaps
    roadmap?.goals.sort(goalSorter);

    return roadmap;
  }

  // If user is logged in, get all roadmaps they have access to
  if (user?.isLoggedIn) {
    try {
      // Get all roadmaps authored by the user
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
        select: clientSafeRoadmapSelection
      });
    } catch (error) {
      console.log(error);
      console.log('Error fetching user roadmap');
      return null;
    }

    // Sort roadmaps
    roadmap?.goals.sort(goalSorter);

    return roadmap;
  }

  // Get all public roadmaps
  try {
    roadmap = await prisma.roadmap.findUnique({
      where: {
        id,
        isPublic: true
      },
      select: clientSafeRoadmapSelection
    });
  } catch (error) {
    console.log(error);
    console.log('Error fetching public roadmap');
    return null;
  }

  // Sort roadmaps
  roadmap?.goals.sort(goalSorter);

  return roadmap;
}