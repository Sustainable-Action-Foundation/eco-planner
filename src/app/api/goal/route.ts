import { NextRequest } from "next/server";
import { getSession } from "@/lib/session"
import prisma from "@/prismaClient";
import { AccessControlled, AccessLevel, ClientError, DataSeriesDataFields, GoalInput } from "@/types";
import { DataSeries } from "@prisma/client";
import accessChecker from "@/lib/accessChecker";
import { revalidateTag } from "next/cache";
import dataSeriesPrep from "./dataSeriesPrep";
import pruneOrphans from "@/functions/pruneOrphans";
import { cookies } from "next/headers";
import getOneGoal from "@/fetchers/getOneGoal";
import { recalculateGoal } from "@/functions/recalculateGoal";

/**
 * Handles POST requests to the goal API
 */
export async function POST(request: NextRequest) {
  const [session, goal] = await Promise.all([
    getSession(cookies()),
    request.json() as Promise<GoalInput & { roadmapId: string }>,
  ]);

  // Validate request body
  if (!goal.indicatorParameter || !goal.dataUnit || (!goal.dataSeries && !goal.inheritFrom?.length)) {
    return Response.json({ message: 'Missing required input parameters' },
      { status: 400 }
    );
  }

  if (!goal.roadmapId) {
    return Response.json({ message: 'Missing parent. Please report this problem unless you are sending custom requests.' },
      { status: 400 }
    );
  }

  // Validate session
  if (!session.user?.id) {
    return Response.json({ message: 'Unauthorized' },
      { status: 401, headers: { 'Location': '/login' } }
    );
  }

  try {
    // Get user, roadmap, and related goals
    const [user, roadmap, relatedGoals] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, username: true, isAdmin: true, userGroups: true }
      }),
      prisma.roadmap.findUnique({
        where: { id: goal.roadmapId },
        select: {
          author: { select: { id: true, username: true } },
          editors: { select: { id: true, username: true } },
          viewers: { select: { id: true, username: true } },
          editGroups: { include: { users: { select: { id: true, username: true } } } },
          viewGroups: { include: { users: { select: { id: true, username: true } } } },
          isPublic: true,
        }
      }),
      Promise.all([...(goal?.inheritFrom ? goal.inheritFrom.map(({ id }) => getOneGoal(id)) : [])]),
    ]);

    // If no user is found or the found user falsely claims to be an admin, they have a bad session cookie and should be logged out
    if (!user || (session.user.isAdmin && !user.isAdmin)) {
      throw new Error(ClientError.BadSession, { cause: 'goal' });
    }

    // If no roadmap is found or the user has no access to it, return IllegalParent
    if (!roadmap) {
      throw new Error(ClientError.IllegalParent, { cause: 'goal' });
    }
    const accessFields: AccessControlled = {
      author: roadmap.author,
      editors: roadmap.editors,
      viewers: roadmap.viewers,
      editGroups: roadmap.editGroups,
      viewGroups: roadmap.viewGroups,
      isPublic: roadmap.isPublic,
    }
    const accessLevel = accessChecker(accessFields, session.user)
    if (accessLevel === AccessLevel.None || accessLevel === AccessLevel.View) {
      throw new Error(ClientError.IllegalParent, { cause: 'goal' });
    }

    // If the user tries to inherit from a goal they don't have access to, return IllegalParent
    for (const relatedGoal of relatedGoals) {
      if (!relatedGoal) {
        throw new Error(ClientError.IllegalParent, { cause: 'goal' });
      }
    }
  } catch (e) {
    if (e instanceof Error) {
      if (e.message == ClientError.BadSession) {
        // Remove session to log out. The client should redirect to login page.
        session.destroy();
        return Response.json({ message: ClientError.BadSession },
          { status: 400, headers: { 'Location': '/login' } }
        );
      }
      if (e.message == ClientError.IllegalParent) {
        return Response.json({ message: ClientError.IllegalParent },
          { status: 403 }
        );
      }
    }
    // If no matching error is thrown, log the error and return a generic error message
    console.log(e);
    return Response.json({ message: "Internal server error" },
      { status: 500 }
    );
  }

  // Prepare for creating data series
  let dataValues: Partial<DataSeriesDataFields> | undefined | null = null;
  if (goal.inheritFrom?.length) {
    // Combine the data series of the parent goals
    const parentGoals = await Promise.all(goal.inheritFrom.map(({ id }) => getOneGoal(id)));
    const combinationParents: {
      isInverted: boolean,
      parentGoal: {
        dataSeries: DataSeries | null
      }
    }[] = goal.inheritFrom.map(({ id, isInverted }) => {
      const parentGoal = parentGoals.find(goal => goal?.id === id);
      return { isInverted: isInverted ?? false, parentGoal: { dataSeries: parentGoal?.dataSeries ?? null } };
    });
    dataValues = await recalculateGoal({ combinationScale: goal.combinationScale ?? null, combinationParents });
  } else if (goal.dataSeries) {
    // Get data series from the request
    dataValues = dataSeriesPrep(goal);
  }
  // If the data series is invalid, return an error
  if (dataValues == null) {
    return Response.json({
      message: 'Invalid data series'
    },
      { status: 400 }
    );
  }

  // Create goal
  try {
    const newGoal = await prisma.goal.create({
      data: {
        name: goal.name,
        description: goal.description,
        indicatorParameter: goal.indicatorParameter,
        isFeatured: goal.isFeatured,
        externalDataset: goal.externalDataset,
        externalTableId: goal.externalTableId,
        externalSelection: goal.externalSelection,
        combinationScale: goal.combinationScale || undefined,
        author: {
          connect: { id: session.user.id },
        },
        roadmap: {
          connect: { id: goal.roadmapId },
        },
        dataSeries: {
          create: {
            ...dataValues,
            unit: goal.dataUnit,
            authorId: session.user.id,
            scale: goal.dataScale || undefined,
          },
        },
        combinationParents: {
          create: [...(goal.inheritFrom ? goal.inheritFrom.map(({ id, isInverted }) => { return ({ parentGoalId: id, isInverted }) }) : [])],
        },
        links: {
          create: goal.links?.map(link => {
            return {
              url: link.url,
              description: link.description || undefined,
            }
          })
        },
      }
    });
    // Invalidate old cache
    revalidateTag('goal');
    // Return the new goal's ID if successful
    return Response.json({ message: "Goal created", id: newGoal.id },
      { status: 201, headers: { 'Location': `/roadmap/${goal.roadmapId}/goal/${newGoal.id}` } }
    );
  } catch (e: any) {
    console.log(e);
    if (e?.code == 'P2025') {
      return Response.json({ message: 'Failed to connect records. Given roadmap might not exist' },
        { status: 400 }
      );
    }
    return Response.json({ message: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Handles PUT requests to the goal API
 */
export async function PUT(request: NextRequest) {
  const [session, goal] = await Promise.all([
    getSession(cookies()),
    request.json() as Promise<GoalInput & { goalId: string, timestamp?: number }>,
  ]);

  // Convert externalSelection to string so it can be stored in the database
  if (goal.externalSelection && typeof goal.externalSelection == "object") {
    goal.externalSelection = JSON.stringify(goal.externalSelection);
  }

  // Validate request body
  if (goal.indicatorParameter === null || goal.dataUnit === null || goal.dataSeries === null || !goal.goalId) {
    return Response.json({ message: 'Missing required input parameters' },
      { status: 400 }
    );
  }

  // Validate session
  if (!session.user?.id) {
    return Response.json({ message: 'Unauthorized' },
      { status: 401, headers: { 'Location': '/login' } }
    );
  }

  try {
    // Get user, current goal, and related goals
    const [user, currentGoal, relatedGoals] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, username: true, isAdmin: true, userGroups: true }
      }),
      prisma.goal.findUnique({
        where: { id: goal.goalId },
        select: {
          updatedAt: true,
          roadmap: {
            select: {
              author: { select: { id: true, username: true } },
              editors: { select: { id: true, username: true } },
              viewers: { select: { id: true, username: true } },
              editGroups: { include: { users: { select: { id: true, username: true } } } },
              viewGroups: { include: { users: { select: { id: true, username: true } } } },
              isPublic: true,
            }
          },
        }
      }),
      Promise.all([...(goal?.inheritFrom ? goal.inheritFrom.map(({ id }) => getOneGoal(id)) : [])]),
    ]);

    // If no user is found or the found user falsely claims to be an admin, they have a bad session cookie and should be logged out
    if (!user || (session.user.isAdmin && !user.isAdmin)) {
      throw new Error(ClientError.BadSession, { cause: 'goal' });
    }

    // If no goal is found or the user has no access to it, return AccessDenied
    if (!currentGoal) {
      throw new Error(ClientError.AccessDenied, { cause: 'goal' });
    }
    const accessFields: AccessControlled = {
      author: currentGoal.roadmap.author,
      editors: currentGoal.roadmap.editors,
      viewers: currentGoal.roadmap.viewers,
      editGroups: currentGoal.roadmap.editGroups,
      viewGroups: currentGoal.roadmap.viewGroups,
      isPublic: currentGoal.roadmap.isPublic,
    }
    const accessLevel = accessChecker(accessFields, session.user)
    if (accessLevel === AccessLevel.None || accessLevel === AccessLevel.View) {
      throw new Error(ClientError.AccessDenied, { cause: 'goal' });
    }

    // If the user tries to inherit from a goal they don't have access to, return IllegalParent
    for (const relatedGoal of relatedGoals) {
      if (!relatedGoal) {
        throw new Error(ClientError.IllegalParent, { cause: 'goal' });
      }
    }

    // If the provided timestamp is not up-to-date, return StaleData
    if (!goal.timestamp || (currentGoal?.updatedAt?.getTime() || 0) > goal.timestamp) {
      throw new Error(ClientError.StaleData, { cause: 'goal' });
    }
  } catch (e) {
    if (e instanceof Error) {
      if (e.message == ClientError.BadSession) {
        // Remove session to log out. The client should redirect to login page.
        session.destroy();
        return Response.json({ message: ClientError.BadSession },
          { status: 400, headers: { 'Location': '/login' } }
        );
      }
      if (e.message == ClientError.StaleData) {
        return Response.json({ message: ClientError.StaleData },
          { status: 409 }
        );
      }
      if (e.message == ClientError.IllegalParent) {
        return Response.json({ message: ClientError.IllegalParent },
          { status: 403 }
        );
      }
      if (e.message == ClientError.AccessDenied) {
        return Response.json({ message: ClientError.AccessDenied },
          { status: 403 }
        );
      }
    }
    // If no matching error is thrown, log the error and return a generic error message
    console.log(e);
    return Response.json({ message: "Internal server error" },
      { status: 500 }
    );
  }

  // Prepare for creating data series
  let dataValues: Partial<DataSeriesDataFields> | undefined | null = null;
  if (goal.inheritFrom?.length) {
    console.log('Combining data series');
    // Combine the data series of the parent goals
    const parentGoals = await Promise.all(goal.inheritFrom.map(({ id }) => getOneGoal(id)));
    const combinationParents: {
      isInverted: boolean,
      parentGoal: {
        dataSeries: DataSeries | null
      }
    }[] = goal.inheritFrom.map(({ id, isInverted }) => {
      const parentGoal = parentGoals.find(goal => goal?.id === id);
      return { isInverted: isInverted ?? false, parentGoal: { dataSeries: parentGoal?.dataSeries ?? null } };
    });
    dataValues = await recalculateGoal({ combinationScale: goal.combinationScale ?? null, combinationParents });
  } else if (goal.dataSeries) {
    console.log('Updating data series');
    // Don't try to update if the received data series is undefined (but complain about null)
    // Get data series from the request
    dataValues = dataSeriesPrep(goal);
  }
  if (dataValues === null) {
    return Response.json({ message: 'Invalid data series' },
      { status: 400 }
    );
  }

  // Edit goal
  try {
    const editedGoal = await prisma.goal.update({
      where: { id: goal.goalId },
      data: {
        name: goal.name,
        description: goal.description,
        indicatorParameter: goal.indicatorParameter,
        isFeatured: goal.isFeatured,
        externalDataset: goal.externalDataset,
        externalTableId: goal.externalTableId,
        externalSelection: goal.externalSelection,
        // Only update the data series if it is not undefined (undefined means no change)
        ...(dataValues ? {
          dataSeries: {
            upsert: {
              create: {
                ...dataValues,
                unit: goal.dataUnit,
                authorId: session.user.id,
                scale: goal.dataScale || undefined,
              },
              update: dataValues,
            }
          }
        } : {}),
        ...(goal.inheritFrom === undefined ? {}
          : {
            // Delete all previous connections and make new ones if goal.inheritFrom changes
            combinationParents: {
              deleteMany: {},
              create: [...goal.inheritFrom.map(({ id, isInverted }) => { return ({ parentGoalId: id, isInverted }) })],
            }
          }
        ),
        combinationScale: goal.combinationScale,
        links: {
          set: [],
          create: goal.links?.map(link => {
            return {
              url: link.url,
              description: link.description || undefined,
            }
          })
        },
      },
      select: {
        id: true,
        roadmap: {
          select: { id: true }
        }
      }
    });
    // Prune any orphaned links and comments
    await pruneOrphans();
    // Invalidate old cache
    revalidateTag('goal');
    // Return the edited goal's ID if successful
    return Response.json({ message: "Goal updated", id: editedGoal.id },
      { status: 200, headers: { 'Location': `/roadmap/${editedGoal.roadmap.id}/goal/${editedGoal.id}` } }
    );
  } catch (e: any) {
    console.log(e);
    return Response.json({ message: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Handles DELETE requests to the goal API
 */
export async function DELETE(request: NextRequest) {
  const [session, goal] = await Promise.all([
    getSession(cookies()),
    request.json() as Promise<{ id: string }>
  ]);

  // Validate request body
  if (!goal.id) {
    return Response.json({ message: 'Missing required input parameters' },
      { status: 400 }
    );
  }

  // Validate session
  if (!session.user?.id) {
    return Response.json({ message: 'Unauthorized' },
      { status: 401, headers: { 'Location': '/login' } }
    );
  }

  try {
    const [user, currentGoal] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, username: true, isAdmin: true, userGroups: true }
      }),
      prisma.goal.findUnique({
        where: {
          id: goal.id,
          ...(session.user.isAdmin ? {} : {
            OR: [
              // Either the goal, roadmap or meta roadmap must be authored by the user unless they are an admin
              { authorId: session.user.id },
              { roadmap: { authorId: session.user.id } },
              { roadmap: { metaRoadmap: { authorId: session.user.id } } },
            ]
          })
        },
      }),
    ]);

    // If no user is found or the found user falsely claims to be an admin, they have a bad session cookie and should be logged out
    if (!user || (session.user.isAdmin && !user.isAdmin)) {
      throw new Error(ClientError.BadSession, { cause: 'goal' });
    }

    // If the goal is not found it eiter does not exist or the user has no access to it
    if (!currentGoal) {
      throw new Error(ClientError.AccessDenied, { cause: 'goal' });
    }
  } catch (e) {
    if (e instanceof Error) {
      if (e.message == ClientError.BadSession) {
        // Remove session to log out. The client should redirect to login page.
        session.destroy();
        return Response.json({ message: ClientError.BadSession },
          { status: 400, headers: { 'Location': '/login' } }
        );
      }
      if (e.message == ClientError.AccessDenied) {
        return Response.json({ message: ClientError.AccessDenied },
          { status: 403 }
        );
      }
    }
    // If no matching error is thrown, log the error and return a generic error message
    console.log(e);
    return Response.json({ message: "Internal server error" },
      { status: 500 }
    );
  }

  // Delete the goal
  try {
    const deletedGoal = await prisma.goal.delete({
      where: {
        id: goal.id
      },
      select: {
        id: true,
        roadmap: {
          select: {
            id: true,
          }
        }
      }
    });
    // Prune any orphaned links and comments
    await pruneOrphans();
    // Invalidate old cache
    revalidateTag('goal');
    return Response.json({ message: 'Goal deleted', id: deletedGoal.id },
      // Redirect to the parent roadmap
      { status: 200, headers: { 'Location': `/roadmap/${deletedGoal.roadmap.id}` } }
    );
  } catch (e) {
    console.log(e);
    return Response.json({ message: "Internal server error" },
      { status: 500 }
    );
  }
}