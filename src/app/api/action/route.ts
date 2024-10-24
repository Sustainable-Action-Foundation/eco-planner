import { NextRequest } from "next/server";
import { getSession } from "@/lib/session"
import prisma from "@/prismaClient";
import { AccessControlled, AccessLevel, ClientError, ActionInput, DataSeriesDataFields } from "@/types";
import accessChecker from "@/lib/accessChecker";
import { revalidateTag } from "next/cache";
import pruneOrphans from "@/functions/pruneOrphans";
import { cookies } from "next/headers";
import dataSeriesPrep from "../goal/dataSeriesPrep";
import { Prisma } from "@prisma/client";

/**
 * Handles POST requests to the action API
 */
export async function POST(request: NextRequest) {
  const [session, action] = await Promise.all([
    getSession(cookies()),
    request.json() as Promise<ActionInput>,
  ]);

  // Validate request body
  if (!action.name) {
    return Response.json({ message: 'Missing required input parameters' },
      { status: 400 }
    );
  }

  // TODO: Make sure user has access to the parent goal (declared in goal's parent roadmap)
  if (!action.goalId) {
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
    // Get user and goal
    const [user, goal] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, username: true, isAdmin: true, userGroups: true }
      }),
      prisma.goal.findUnique({
        where: { id: action.goalId },
        include: {
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
      throw new Error(ClientError.BadSession, { cause: 'action' });
    }

    // If no goal is found or the user has no access to the goal, return IllegalParent
    if (!goal) {
      throw new Error(ClientError.IllegalParent, { cause: 'action' });
    }
    const accessFields: AccessControlled = {
      author: goal.roadmap.author,
      editors: goal.roadmap.editors,
      viewers: goal.roadmap.viewers,
      editGroups: goal.roadmap.editGroups,
      viewGroups: goal.roadmap.viewGroups,
      isPublic: goal.roadmap.isPublic,
    }
    const accessLevel = accessChecker(accessFields, session.user)
    if (accessLevel === AccessLevel.None || accessLevel === AccessLevel.View) {
      throw new Error(ClientError.IllegalParent, { cause: 'action' });
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
      return Response.json({ message: ClientError.IllegalParent },
        { status: 403 }
      );
    } else {
      // If non-error is thrown, log it and return a generic error message
      console.log(e);
      return Response.json({ message: "Unknown internal server error" },
        { status: 500 }
      );
    }
  }

  // Prepare action impact data
  let impactData: Partial<DataSeriesDataFields> | undefined | null = undefined;
  if (action.dataSeries?.length) {
    // Parse the data series
    impactData = dataSeriesPrep(action.dataSeries);
  }
  // If the data series is invalid, return an error
  if (impactData === null) {
    return Response.json({ message: 'Bad data series' },
      { status: 400 }
    );
  }

  // Create the action
  try {
    const newAction = await prisma.action.create({
      data: {
        name: action.name,
        description: action.description,
        costEfficiency: action.costEfficiency,
        expectedOutcome: action.expectedOutcome,
        startYear: action.startYear,
        endYear: action.endYear,
        projectManager: action.projectManager,
        relevantActors: action.relevantActors,
        isSufficiency: action.isSufficiency,
        isEfficiency: action.isEfficiency,
        isRenewables: action.isRenewables,
        dataSeries: impactData ? {
          create: {
            ...impactData,
            unit: '',
            authorId: session.user.id,
          }
        } : undefined,
        impactType: action.impactType,
        links: {
          create: action.links?.map(link => {
            return {
              url: link.url,
              description: link.description || undefined,
            }
          })
        },
        // TODO: Add `Note`s
        goal: {
          connect: { id: action.goalId }
        },
        author: {
          connect: {
            id: session.user.id
          }
        },
      },
      select: {
        id: true,
        goal: {
          select: {
            id: true,
            roadmap: {
              select: {
                id: true,
              }
            }
          }
        }
      }
    });
    // Invalidate old cache
    revalidateTag('action');
    // Return the new action's ID if successful
    return Response.json({ message: 'Action created', id: newAction.id },
      { status: 201, headers: { 'Location': `/roadmap/${newAction.goal.roadmap.id}/goal/${newAction.goal.id}/action/${newAction.id}` } }
    );
  } catch (error) {
    console.log(error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return Response.json({ message: 'Failed to connect records. Given goal might not exist' },
        { status: 400 }
      );
    }
    return Response.json({ message: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Handles PUT requests to the action API
 */
export async function PUT(request: NextRequest) {
  const [session, action] = await Promise.all([
    getSession(cookies()),
    request.json() as Promise<ActionInput & { actionId: string, timestamp?: number }>
  ]);

  // Validate request body
  if (!action.actionId || !action.name) {
    return Response.json({ message: 'Missing required input parameters' },
      { status: 400 }
    );
  }
  if (!action.timestamp) {
    return Response.json({ message: 'Potentially stale data. Please refresh and try again.' },
      { status: 409 }
    );
  }

  // Validate session
  if (!session.user?.id) {
    return Response.json({ message: 'Unauthorized' },
      { status: 401, headers: { 'Location': '/login' } }
    );
  }

  try {
    const [user, currentAction] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, username: true, isAdmin: true, userGroups: true }
      }),
      prisma.action.findUnique({
        where: { id: action.actionId },
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
        }
      }),
    ]);
    // If no user is found or the found user falsely claims to be an admin, they have a bad session cookie and should be logged out
    if (!user || (session.user.isAdmin && !user.isAdmin)) {
      throw new Error(ClientError.BadSession, { cause: 'goal' });
    }

    // If no action is found or the user has no access to the action, return AccessDenied
    if (!currentAction) {
      throw new Error(ClientError.AccessDenied, { cause: 'action' });
    }
    const accessFields: AccessControlled = {
      author: currentAction.goal.roadmap.author,
      editors: currentAction.goal.roadmap.editors,
      viewers: currentAction.goal.roadmap.viewers,
      editGroups: currentAction.goal.roadmap.editGroups,
      viewGroups: currentAction.goal.roadmap.viewGroups,
      isPublic: currentAction.goal.roadmap.isPublic,
    }
    const accessLevel = accessChecker(accessFields, session.user)
    if (accessLevel === AccessLevel.None || accessLevel === AccessLevel.View) {
      throw new Error(ClientError.AccessDenied, { cause: 'action' });
    }

    // Check if the action has been updated since the client last fetched it
    if ((currentAction?.updatedAt?.getTime() || 0) > action.timestamp) {
      throw new Error(ClientError.StaleData, { cause: 'action' });
    }
  } catch (e) {
    if (e instanceof Error) {
      if (e.message == ClientError.BadSession) {
        // Remove session to log out. The client should redirect to login page.
        await session.destroy();
        return Response.json({ message: ClientError.BadSession },
          { status: 400, headers: { 'Location': '/login' } }
        );
      }
      if (e.message == ClientError.StaleData) {
        return Response.json({ message: ClientError.StaleData },
          { status: 409 }
        );
      }
      return Response.json({ message: ClientError.AccessDenied },
        { status: 403 }
      );
    } else {
      console.log(e);
      return Response.json({ message: "Unknown internal server error" },
        { status: 500 }
      );
    }
  }

  // Prepare action impact data
  let impactData: Partial<DataSeriesDataFields> | undefined | null = undefined;
  if (action.dataSeries?.length) {
    // Parse the data series
    impactData = dataSeriesPrep(action.dataSeries);
  }
  // If the data series is invalid, return an error
  if (impactData === null) {
    return Response.json({ message: 'Bad data series' },
      { status: 400 }
    );
  }

  // Update the action
  try {
    const updatedAction = await prisma.action.update({
      where: {
        id: action.actionId
      },
      data: {
        name: action.name,
        description: action.description,
        costEfficiency: action.costEfficiency,
        expectedOutcome: action.expectedOutcome,
        startYear: action.startYear,
        endYear: action.endYear,
        projectManager: action.projectManager,
        relevantActors: action.relevantActors,
        isSufficiency: action.isSufficiency,
        isEfficiency: action.isEfficiency,
        isRenewables: action.isRenewables,
        ...(impactData ? {
          dataSeries: {
            upsert: {
              create: {
                ...impactData,
                unit: '',
                authorId: session.user.id,
              },
              update: impactData
            },
          }
        } : (action.dataSeries === null || action.dataSeries?.length === 0) ? {
          delete: true
        } : {}),
        impactType: action.impactType,
        links: {
          set: [],
          create: action.links?.map(link => {
            return {
              url: link.url,
              description: link.description || undefined,
            }
          })
        },
      },
      select: {
        id: true,
        goal: {
          select: {
            id: true,
            roadmap: {
              select: {
                id: true,
              }
            }
          }
        }
      }
    });
    // Prune any orphaned links and comments
    await pruneOrphans();
    // Invalidate old cache
    revalidateTag('action');
    // Return the new action's ID if successful
    return Response.json({ message: 'Action updated', id: updatedAction.id },
      { status: 200, headers: { 'Location': `/roadmap/${updatedAction.goal.roadmap.id}/goal/${updatedAction.goal.id}/action/${updatedAction.id}` } }
    );
  } catch (error) {
    console.log(error);
    return Response.json({ message: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Handles DELETE requests to the action API
 */
export async function DELETE(request: NextRequest) {
  const [session, action] = await Promise.all([
    getSession(cookies()),
    request.json() as Promise<{ id: string }>
  ]);

  // Validate request body
  if (!action.id) {
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
    const [user, currentAction] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, username: true, isAdmin: true, userGroups: true }
      }),
      prisma.action.findUnique({
        where: {
          id: action.id,
          // The user must be admin, or have authored the action or one of its parents
          ...(session.user.isAdmin ? {} : {
            OR: [
              { authorId: session.user.id },
              { goal: { authorId: session.user.id } },
              { goal: { roadmap: { authorId: session.user.id } } },
              { goal: { roadmap: { metaRoadmap: { authorId: session.user.id } } } },
            ]
          })
        },
      }),
    ]);

    // If no user is found or the found user falsely claims to be an admin, they have a bad session cookie and should be logged out
    if (!user || (session.user.isAdmin && !user.isAdmin)) {
      throw new Error(ClientError.BadSession, { cause: 'action' });
    }

    // If the action is not found it eiter does not exist or the user has no access to it
    if (!currentAction) {
      throw new Error(ClientError.AccessDenied, { cause: 'action' });
    }
  } catch (e) {
    if (e instanceof Error) {
      if (e.message == ClientError.BadSession) {
        // Remove session to log out. The client should redirect to login page.
        await session.destroy();
        return Response.json({ message: ClientError.BadSession },
          { status: 400, headers: { 'Location': '/login' } }
        );
      }
      return Response.json({ message: ClientError.AccessDenied },
        { status: 403 }
      );
    } else {
      console.log(e);
      return Response.json({ message: "Unknown internal server error" },
        { status: 500 }
      );
    }
  }

  // Delete the action
  try {
    const deletedAction = await prisma.action.delete({
      where: {
        id: action.id
      },
      select: {
        id: true,
        goal: {
          select: {
            id: true,
            roadmap: {
              select: {
                id: true,
              }
            }
          }
        }
      }
    });
    // Prune any orphaned links and comments
    await pruneOrphans();
    // Invalidate old cache
    revalidateTag('action');
    return Response.json({ message: 'Action deleted', id: deletedAction.id },
      // Redirect to the parent goal
      { status: 200, headers: { 'Location': `/roadmap/${deletedAction.goal.roadmap.id}/goal/${deletedAction.goal.id}` } }
    );
  } catch (e) {
    console.log(e);
    return Response.json({ message: "Internal server error" },
      { status: 500 }
    );
  }
}