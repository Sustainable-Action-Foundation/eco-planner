import dataSeriesPrep from "@/app/api/goal/dataSeriesPrep";
import accessChecker from "@/lib/accessChecker";
import { getSession } from "@/lib/session";
import prisma from "@/prismaClient";
import { AccessLevel, ClientError, DataSeriesDataFields, EffectInput, JSONValue } from "@/types";
import { ActionImpactType, Prisma } from "@prisma/client";
import { revalidateTag } from "next/cache";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

/**
 * Handles POST requests to the effect API
 */
export async function POST(request: NextRequest) {
  const [session, effect] = await Promise.all([
    getSession(cookies()),
    request.json() as Promise<JSONValue>,
  ]);

  // Typeguard and check if the request body is valid
  function isEffect(effect: JSONValue): effect is EffectInput {
    return (
      // effect should be an object
      typeof effect === 'object' &&
      effect != null &&
      !(effect instanceof Array) &&
      // actionId and goalId should be strings
      typeof effect.actionId === 'string' &&
      typeof effect.goalId === 'string' &&
      // dataSeries should be an array of strings
      effect.dataSeries instanceof Array &&
      effect.dataSeries.every((value) => typeof value === 'string') &&
      // impactType may be included, and should in that case be one of the values in ActionImpactType
      (effect.impactType === undefined || Object.values(ActionImpactType).includes(effect.impactType as ActionImpactType))
    )
  }

  if (!isEffect(effect)) {
    return Response.json({ message: 'Invalid request body' },
      { status: 400 }
    );
  }

  if (!session.user?.id) {
    return Response.json({ message: 'Unauthorized' },
      { status: 401, headers: { 'Location': '/login' } }
    );
  }

  // Get user and check permissions
  try {
    const [user, action, goal] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, username: true, isAdmin: true, userGroups: true }
      }),
      prisma.action.findUnique({
        where: { id: effect.actionId },
        select: {
          roadmap: {
            select: {
              author: { select: { id: true, username: true } },
              editors: { select: { id: true, username: true } },
              viewers: { select: { id: true, username: true } },
              editGroups: { include: { users: { select: { id: true, username: true } } } },
              viewGroups: { include: { users: { select: { id: true, username: true } } } },
              isPublic: true,
            }
          }
        }
      }),
      prisma.goal.findUnique({
        where: { id: effect.goalId },
        select: {
          roadmap: {
            select: {
              author: { select: { id: true, username: true } },
              editors: { select: { id: true, username: true } },
              viewers: { select: { id: true, username: true } },
              editGroups: { include: { users: { select: { id: true, username: true } } } },
              viewGroups: { include: { users: { select: { id: true, username: true } } } },
              isPublic: true,
            }
          }
        }
      })
    ]);

    // If no user is found or the found user falsely claims to be an admin, they have a bad session cookie and should be logged out
    if (!user || (session.user.isAdmin && !user.isAdmin)) {
      throw new Error(ClientError.BadSession, { cause: 'effect' });
    }

    // Check access levels
    if (!action || !goal) {
      throw new Error(ClientError.IllegalParent, { cause: 'effect' });
    }

    const actionAccess = accessChecker(action.roadmap, session.user);
    const goalAccess = accessChecker(goal.roadmap, session.user);

    const allowedAccessLevels = [AccessLevel.Admin, AccessLevel.Author, AccessLevel.Edit];

    if (!allowedAccessLevels.includes(actionAccess) || !allowedAccessLevels.includes(goalAccess)) {
      throw new Error(ClientError.IllegalParent, { cause: 'effect' });
    }
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case ClientError.BadSession:
          session.destroy();
          return Response.json({ message: ClientError.BadSession },
            { status: 400, headers: { 'Location': '/login' } }
          );
        case ClientError.IllegalParent:
          return Response.json({ message: ClientError.IllegalParent },
            { status: 403 }
          );
        default:
          return Response.json({ message: 'Unknown error' },
            { status: 500 }
          );
      }
    } else {
      console.log(error);
      return Response.json({ message: 'Unknown error' },
        { status: 500 }
      );
    }
  }

  // Prepare effect data series
  let dataSeries: Partial<DataSeriesDataFields> | null = null;
  dataSeries = dataSeriesPrep(effect.dataSeries ?? []);
  if (dataSeries == null) {
    return Response.json({ message: 'Bad data series' },
      { status: 400 }
    );
  }

  // Create the effect
  try {
    const newEffect = await prisma.effect.create({
      data: {
        actionId: effect.actionId,
        goalId: effect.goalId,
        impactType: effect.impactType,
        dataSeries: {
          create: {
            ...dataSeries,
            unit: '',
            authorId: session.user.id
          }
        },
      },
    });
    // Invalidate old cache
    revalidateTag('action');
    revalidateTag('goal');
    // Return success
    return Response.json({ message: 'Effect created', actionId: newEffect.actionId, goalId: newEffect.goalId },
      { status: 201 }
    );
  } catch (error) {
    // Unique constraint error
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return Response.json({ message: 'Effect already exists, try edit page if you want to change values' },
        { status: 409 }
      );
    }
    console.log(error);
    return Response.json({ message: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Handles PUT requests to the effect API
 */
export async function PUT(request: NextRequest) {
  const [session, effect] = await Promise.all([
    getSession(cookies()),
    request.json() as Promise<JSONValue>,
  ]);

  // Typeguard and check if the request body is valid
  function isEffect(effect: JSONValue): effect is EffectInput & { timestamp: number } {
    return (
      // effect should be an object
      typeof effect === 'object' &&
      effect != null &&
      !(effect instanceof Array) &&
      // actionId and goalId should be strings
      typeof effect.actionId === 'string' &&
      typeof effect.goalId === 'string' &&
      // dataSeries should be either undefined or an array of strings
      (
        effect.dataSeries === undefined ||
        (
          effect.dataSeries instanceof Array &&
          effect.dataSeries.every((value) => typeof value === 'string')
        )
      ) &&
      // impactType may be included, and should in that case be one of the values in ActionImpactType
      (effect.impactType === undefined || Object.values(ActionImpactType).includes(effect.impactType as ActionImpactType)) &&
      // timestamp should be a number
      typeof effect.timestamp === 'number'
    )
  }

  if (!isEffect(effect)) {
    return Response.json({ message: 'Invalid request body' },
      { status: 400 }
    );
  }

  if (!session.user?.id) {
    return Response.json({ message: 'Unauthorized' },
      { status: 401, headers: { 'Location': '/login' } }
    );
  }

  // Get user and check permissions
  try {
    const [user, currentEffect] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, username: true, isAdmin: true, userGroups: true }
      }),
      prisma.effect.findUnique({
        where: { id: { actionId: effect.actionId, goalId: effect.goalId } },
        select: {
          updatedAt: true,
          goal: {
            select: {
              roadmap: {
                select: {
                  author: { select: { id: true, username: true } },
                  editors: { select: { id: true, username: true } },
                  viewers: { select: { id: true, username: true } },
                  editGroups: { include: { users: { select: { id: true, username: true } } } },
                  viewGroups: { include: { users: { select: { id: true, username: true } } } },
                  isPublic: true,
                }
              }
            }
          },
          action: {
            select: {
              roadmap: {
                select: {
                  author: { select: { id: true, username: true } },
                  editors: { select: { id: true, username: true } },
                  viewers: { select: { id: true, username: true } },
                  editGroups: { include: { users: { select: { id: true, username: true } } } },
                  viewGroups: { include: { users: { select: { id: true, username: true } } } },
                  isPublic: true,
                }
              }
            }
          }
        }
      }),
    ]);

    // If no user is found or the found user falsely claims to be an admin, they have a bad session cookie and should be logged out
    if (!user || (session.user.isAdmin && !user.isAdmin)) {
      throw new Error(ClientError.BadSession, { cause: 'effect' });
    }

    // Check access
    if (!currentEffect) {
      throw new Error(ClientError.AccessDenied, { cause: 'effect' });
    }

    const actionAccess = accessChecker(currentEffect.action.roadmap, session.user);
    const goalAccess = accessChecker(currentEffect.goal.roadmap, session.user);

    const allowedAccessLevels = [AccessLevel.Admin, AccessLevel.Author, AccessLevel.Edit];

    if (!allowedAccessLevels.includes(actionAccess) || !allowedAccessLevels.includes(goalAccess)) {
      throw new Error(ClientError.AccessDenied, { cause: 'effect' });
    }

    // Check if the data is stale
    if (currentEffect.updatedAt.getTime() > effect.timestamp) {
      throw new Error(ClientError.StaleData, { cause: 'effect' });
    }
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case ClientError.BadSession:
          session.destroy();
          return Response.json({ message: ClientError.BadSession },
            { status: 400, headers: { 'Location': '/login' } }
          );
        case ClientError.AccessDenied:
          return Response.json({ message: ClientError.AccessDenied },
            { status: 403 }
          );
        case ClientError.StaleData:
          return Response.json({ message: ClientError.StaleData },
            { status: 409 }
          );
        default:
          return Response.json({ message: 'Unknown error' },
            { status: 500 }
          );
      }
    } else {
      console.log(error);
      return Response.json({ message: 'Unknown error' },
        { status: 500 }
      );
    }
  }

  // Prepare effect data series
  let dataSeries: Partial<DataSeriesDataFields> | undefined | null = undefined;
  if (effect.dataSeries) {
    dataSeries = dataSeriesPrep(effect.dataSeries);
  }
  if (dataSeries === null) {
    return Response.json({ message: 'Bad data series' },
      { status: 400 }
    );
  }

  // Update the effect
  try {
    const updatedEffect = await prisma.effect.update({
      where: { id: { actionId: effect.actionId, goalId: effect.goalId } },
      data: {
        impactType: effect.impactType,
        dataSeries: dataSeries ? {
          upsert: {
            create: {
              ...dataSeries,
              unit: '',
              authorId: session.user.id
            },
            update: {
              ...dataSeries,
            }
          }
        } : undefined,
      },
    });
    // Invalidate old cache
    revalidateTag('action');
    revalidateTag('goal');
    // Return success
    return Response.json({ message: 'Effect updated', actionId: updatedEffect.actionId, goalId: updatedEffect.goalId },
      { status: 200 }
    );
  } catch (error) {
    console.log(error);
    return Response.json({ message: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Handles DELETE requests to the effect API
 */
export async function DELETE(request: NextRequest) {
  const [session, effect] = await Promise.all([
    getSession(cookies()),
    request.json() as Promise<JSONValue>,
  ]);

  // Typeguard and check if the request body is valid
  // For delete, only expect actionId and goalId (but allow other fields)
  function isEffect(effect: JSONValue): effect is { actionId: string, goalId: string } {
    return (
      // effect should be an object
      typeof effect === 'object' &&
      effect != null &&
      !(effect instanceof Array) &&
      // actionId and goalId should be strings
      typeof effect.actionId === 'string' &&
      typeof effect.goalId === 'string'
    )
  }

  if (!isEffect(effect)) {
    return Response.json({ message: 'Invalid request body' },
      { status: 400 }
    );
  }

  if (!session.user?.id) {
    return Response.json({ message: 'Unauthorized' },
      { status: 401, headers: { 'Location': '/login' } }
    );
  }

  // Get user and check permissions
  try {
    const [user, currentEffect] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, username: true, isAdmin: true }
      }),
      prisma.effect.findUnique({
        where: {
          id: { actionId: effect.actionId, goalId: effect.goalId },
          // The user must be an admin or the author of one of the effect's parents
          ...(session.user.isAdmin ? {} : {
            OR: [
              { goal: { authorId: session.user.id } },
              { goal: { roadmap: { authorId: session.user.id } } },
              { goal: { roadmap: { metaRoadmap: { authorId: session.user.id } } } },
              { action: { authorId: session.user.id } },
              { action: { roadmap: { authorId: session.user.id } } },
              { action: { roadmap: { metaRoadmap: { authorId: session.user.id } } } },
            ]
          })
        },
      }),
    ]);

    // If no user is found or the found user falsely claims to be an admin, they have a bad session cookie and should be logged out
    if (!user || (session.user.isAdmin && !user.isAdmin)) {
      throw new Error(ClientError.BadSession, { cause: 'effect' });
    }

    // If the effect is not found it either does not exist or the user does not have access
    if (!currentEffect) {
      throw new Error(ClientError.AccessDenied, { cause: 'effect' });
    }
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case ClientError.BadSession:
          session.destroy();
          return Response.json({ message: ClientError.BadSession },
            { status: 400, headers: { 'Location': '/login' } }
          );
        case ClientError.AccessDenied:
          return Response.json({ message: ClientError.AccessDenied },
            { status: 403 }
          );
        default:
          return Response.json({ message: 'Unknown error' },
            { status: 500 }
          );
      }
    } else {
      console.log(error);
      return Response.json({ message: 'Unknown error' },
        { status: 500 }
      );
    }
  }

  // Delete the effect
  try {
    const deletedEffect = await prisma.effect.delete({
      where: { id: { actionId: effect.actionId, goalId: effect.goalId } },
    });
    // Invalidate old cache
    revalidateTag('action');
    revalidateTag('goal');
    // Return success
    return Response.json({ message: 'Effect deleted', actionId: deletedEffect.actionId, goalId: deletedEffect.goalId },
      { status: 200 }
    );
  } catch (error) {
    console.log(error);
    return Response.json({ message: 'Internal server error' },
      { status: 500 }
    );
  }
}