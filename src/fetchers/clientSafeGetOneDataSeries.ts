'use server';

import { clientSafeDataSeriesSelection } from "@/fetchers/inclusionSelectors";
import { getSession, type LoginData } from "@/lib/session"
import prisma from "@/prismaClient";
import { DataSeries } from "@/types";
import { cacheTag } from "next/dist/server/use-cache/cache-tag";
import { cookies } from "next/headers";

export async function clientSafeGetOneDataSeries(id: string): Promise<DataSeries | null> {
  const session = await getSession(await cookies());
  return clientSafeGetCachedDataSeries(id, session.user);
}

async function clientSafeGetCachedDataSeries(id: string, user: LoginData['user']): Promise<DataSeries | null> {
  'use cache';
  cacheTag('database', 'dataSeries', 'action', 'goal');

  let dataSeries: DataSeries | null = null;

  const canViewParentRoadmap = {
    roadmap: {
      OR: [
        { authorId: user?.id },
        { editors: { some: { id: user?.id } } },
        { viewers: { some: { id: user?.id } } },
        { editGroups: { some: { users: { some: { id: user?.id } } } } },
        { viewGroups: { some: { users: { some: { id: user?.id } } } } },
        { isPublic: true }
      ],
    },
  };

  // If user is admin, always get the data series
  if (user?.isAdmin) {
    try {
      dataSeries = await prisma.dataSeries.findUnique({
        where: { id },
        select: clientSafeDataSeriesSelection,
      }) satisfies DataSeries | null;
    } catch (error) {
      console.log(error);
      console.log('Error fetching admin data series');
      return null;
    }

    return dataSeries;
  }

  // If user is logged in, get the data series if they have access to it
  if (user?.isLoggedIn) {
    try {
      dataSeries = await prisma.dataSeries.findUnique({
        where: {
          id,
          OR: [
            // Authored the data series
            { authorId: user.id },
            // Has access to it through a roadmap
            {
              dependentGoals: {
                some: {
                  OR: [
                    { authorId: user.id },
                    canViewParentRoadmap,
                  ],
                },
              },
            },
            // Has access to it through an action
            {
              dependentBaselines: {
                some: {
                  OR: [
                    { authorId: user.id },
                    canViewParentRoadmap,
                  ],
                },
              },
            },
            // Has access to it through an effect
            {
              dependentEffects: {
                some: {
                  action: {
                    OR: [
                      { authorId: user.id },
                      canViewParentRoadmap,
                    ],
                  },
                  goal: {
                    OR: [
                      { authorId: user.id },
                      canViewParentRoadmap,
                    ],
                  },
                },
              },
            },
          ],
        },
        select: clientSafeDataSeriesSelection
      }) satisfies DataSeries | null;
    } catch (error) {
      console.log(error);
      console.log('Error fetching user data series');
      return null;
    }
    return dataSeries;
  }

  // If user is not logged in, get the data series if it is public
  try {
    dataSeries = await prisma.dataSeries.findUnique({
      where: {
        id,
        OR: [
          // In public goal
          { dependentGoals: { some: { roadmap: { isPublic: true, }, }, }, },
          // In public action
          { dependentBaselines: { some: { roadmap: { isPublic: true, }, }, }, },
          // In public effect
          {
            dependentEffects: {
              some: {
                action: { roadmap: { isPublic: true } },
                goal: { roadmap: { isPublic: true } },
              },
            },
          },
        ],
      },
      select: clientSafeDataSeriesSelection,
    }) satisfies DataSeries | null;
  } catch (error) {
    console.log(error);
    console.log('Error fetching public data series');
    return null;
  }

  return dataSeries;
}