"use server";

import { Prisma } from "@prisma/client";
import prisma from "@/prismaClient";
import { clientSafeMultiRoadmapSelection } from "./inclusionSelectors";
import { cookies } from "next/headers";
import { getSession, LoginData } from "@/lib/session";
import { roadmapSorter } from "@/lib/sorters";
import { unstable_cacheTag as cacheTag } from 'next/cache'

/**
 * A function similar to `getRoadmaps`, but excluding potentially sensitive data.
 * 
 * Returns an empty array if no roadmaps are found or user does not have access to any. Also returns an empty array on error.
 * @returns Array of roadmaps
 */
export default async function clientSafeGetRoadmaps() {
  const session = await getSession(await cookies());
  return getCachedClientSafeRoadmaps(session.user);
}

async function getCachedClientSafeRoadmaps(user: LoginData['user']) {
  'use cache';
  cacheTag('database', 'roadmap');

  let roadmaps: Prisma.RoadmapGetPayload<{
    select: typeof clientSafeMultiRoadmapSelection;
  }>[] = [];

  // If user is admin, get all roadmaps
  if (user?.isAdmin) {
    try {
      roadmaps = await prisma.roadmap.findMany({
        select: clientSafeMultiRoadmapSelection
      });
    } catch (error) {
      console.log(error);
      console.log('Error fetching admin roadmaps');
      return [];
    }

    // Sort roadmaps
    roadmaps.sort(roadmapSorter);

    return roadmaps;
  }

  // If user is logged in, get all roadmaps they have access to
  if (user?.isLoggedIn) {
    try {
      // Get all roadmaps authored by the user
      roadmaps = await prisma.roadmap.findMany({
        where: {
          OR: [
            { authorId: user.id },
            { editors: { some: { id: user.id } } },
            { viewers: { some: { id: user.id } } },
            { editGroups: { some: { users: { some: { id: user.id } } } } },
            { viewGroups: { some: { users: { some: { id: user.id } } } } },
            { isPublic: true }
          ]
        },
        select: clientSafeMultiRoadmapSelection
      });
    } catch (error) {
      console.log(error);
      console.log('Error fetching user roadmaps');
      return [];
    }

    // Sort roadmaps
    roadmaps.sort(roadmapSorter);

    return roadmaps;
  }

  // Get all public roadmaps
  try {
    roadmaps = await prisma.roadmap.findMany({
      where: {
        isPublic: true
      },
      select: clientSafeMultiRoadmapSelection
    });
  } catch (error) {
    console.log(error);
    console.log('Error fetching public roadmaps');
    return [];
  }

  // Sort roadmaps
  roadmaps.sort(roadmapSorter);

  return roadmaps;
}