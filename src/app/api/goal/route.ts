import { NextRequest } from "next/server";
import { getSession } from "@/lib/session"
import prisma from "@/prismaClient";
import { AccessControlled, AccessLevel, ClientError, dataSeriesDataFieldNames, DataSeriesDataFields, GoalInput, JSONValue } from "@/types";
import { DataSeries, Prisma } from "@prisma/client";
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
    getSession(await cookies()),
    request.json() as Promise<JSONValue>,
  ]);

  // Type guard and check if the request body is a valid GoalInput
  function isGoal(goal: JSONValue): goal is GoalInput & { roadmapId: string } {
    return (
      // Should be a non-null object
      typeof goal === 'object' &&
      goal !== null &&
      !Array.isArray(goal) &&
      // Typecheck properties
      (typeof goal.name === 'string' || goal.name === undefined || goal.name === null) &&
      (typeof goal.description === 'string' || goal.description === undefined || goal.description === null) &&
      // Indicator parameter must be a non-empty string
      (typeof goal.indicatorParameter === 'string' && goal.indicatorParameter.length > 0) &&
      (typeof goal.isFeatured === 'boolean' || goal.isFeatured === undefined) &&
      (typeof goal.externalDataset === 'string' || goal.externalDataset === undefined || goal.externalDataset === null) &&
      (typeof goal.externalTableId === 'string' || goal.externalTableId === undefined || goal.externalTableId === null) &&
      (typeof goal.externalSelection === 'string' || goal.externalSelection === undefined || goal.externalSelection === null) &&
      // "Recipe" for combining data series, can be a stringified number or a stringified object matching the ScalingRecipie type
      (typeof goal.combinationScale === 'string' || goal.combinationScale === undefined || goal.combinationScale === null) &&
      // Data series should be either undefined or have a length between 1 and dataSeriesDataFieldNames.length
      ((Array.isArray(goal.dataSeries) && goal.dataSeries.every((entry: JSONValue) => (typeof entry === 'string')) && goal.dataSeries.length > 0 && goal.dataSeries.length <= dataSeriesDataFieldNames.length)
        || goal.dataSeries === undefined) &&
      // baselineDataSeries can be a valid data series to set values, undefined to not set a baseline, or null to delete the baseline
      ((Array.isArray(goal.baselineDataSeries) && goal.baselineDataSeries.every((entry: JSONValue) => (typeof entry === 'string')) && goal.baselineDataSeries.length > 0 && goal.baselineDataSeries.length <= dataSeriesDataFieldNames.length)
        || goal.baselineDataSeries === undefined || goal.baselineDataSeries === null) &&
      // TODO: When database is next updated, dataUnit might be nullable, and an isUnitless boolean might be added
      typeof goal.dataUnit === 'string' &&
      // TODO: dataScale is deprecated, to be removed in next database update
      (typeof goal.dataScale === 'string' || goal.dataScale === undefined || goal.dataScale === null) &&
      ((Array.isArray(goal.inheritFrom) && goal.inheritFrom.every((entry: JSONValue) => (
        typeof entry === 'object' &&
        entry !== null &&
        !Array.isArray(entry) &&
        typeof entry.id === 'string' &&
        (typeof entry.isInverted === 'boolean' || entry.isInverted === undefined)
      ))) || goal.inheritFrom === undefined || goal.inheritFrom === null) &&
      ((Array.isArray(goal.links) && goal.links.every((entry: JSONValue) => (
        typeof entry === 'object' &&
        entry !== null &&
        !Array.isArray(entry) &&
        typeof entry.url === 'string' &&
        (typeof entry.description === 'string' || entry.description === undefined || entry.description === null)
      ))) || goal.links === undefined || goal.links === null) &&
      // Roadmap ID must be a non-empty string
      // Invalid and forbidden IDs are rejected further down
      (typeof goal.roadmapId === 'string' && goal.roadmapId.length > 0) &&
      // Either dataSeries or inheritFrom must be defined and not null
      (goal.dataSeries !== undefined || goal.inheritFrom != undefined)
    );
  }

  if (!isGoal(goal)) {
    return Response.json({ message: 'Invalid request body' },
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
    const accessLevel = accessChecker(accessFields, session.user);
    if (accessLevel === AccessLevel.None || accessLevel === AccessLevel.View) {
      throw new Error(ClientError.IllegalParent, { cause: 'goal' });
    }

    // If the user tries to inherit from a goal they don't have access to, return IllegalParent
    for (const relatedGoal of relatedGoals) {
      if (!relatedGoal) {
        throw new Error(ClientError.IllegalParent, { cause: 'goal' });
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.message == ClientError.BadSession) {
        // Remove session to log out. The client should redirect to login page.
        session.destroy();
        return Response.json({ message: ClientError.BadSession },
          { status: 400, headers: { 'Location': '/login' } }
        );
      }
      if (error.message == ClientError.IllegalParent) {
        return Response.json({ message: ClientError.IllegalParent },
          { status: 403 }
        );
      }
    }
    // If no matching error is thrown, log the error and return a generic error message
    console.log(error);
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
  } else if (goal.dataSeries?.length) {
    // Get data series from the request
    dataValues = dataSeriesPrep(goal.dataSeries);
  }
  // If the data series is invalid, return an error
  if (dataValues == null) {
    return Response.json({ message: 'Bad data series' },
      { status: 400 }
    );
  }

  // Prepare goal baseline (if any)
  let baselineValues: Partial<DataSeriesDataFields> | undefined | null = undefined;
  if (goal.baselineDataSeries?.length) {
    // Get baseline data series from the request
    baselineValues = dataSeriesPrep(goal.baselineDataSeries);
  }
  // If the baseline data series is invalid, return an error
  if (baselineValues === null) {
    return Response.json({ message: 'Bad baseline data series' },
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
          },
        },
        baselineDataSeries: baselineValues ? {
          create: {
            ...baselineValues,
            unit: goal.dataUnit,
            authorId: session.user.id,
          },
        } : undefined,
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
      },
      select: {
        id: true,
      }
    });
    // Invalidate old cache
    revalidateTag('goal');
    // Return the new goal's ID if successful
    return Response.json({ message: "Goal created", id: newGoal.id },
      { status: 201, headers: { 'Location': `/goal/${newGoal.id}` } }
    );
  } catch (error) {
    console.log(error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code == 'P2025') {
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
    getSession(await cookies()),
    request.json() as Promise<JSONValue>,
  ]);

  // Type guard and check if the request body is a valid GoalInput
  function isGoal(goal: JSONValue): goal is Partial<GoalInput> & { goalId: string, timestamp?: number } {
    return (
      // Should be a non-null object
      typeof goal === 'object' &&
      goal !== null &&
      !Array.isArray(goal) &&
      // Typecheck properties
      (typeof goal.name === 'string' || goal.name === undefined || goal.name === null) &&
      (typeof goal.description === 'string' || goal.description === undefined || goal.description === null) &&
      // Indicator parameter must be a non-empty string
      ((typeof goal.indicatorParameter === 'string' && goal.indicatorParameter.length > 0) || goal.indicatorParameter === undefined) &&
      (typeof goal.isFeatured === 'boolean' || goal.isFeatured === undefined) &&
      (typeof goal.externalDataset === 'string' || goal.externalDataset === undefined || goal.externalDataset === null) &&
      (typeof goal.externalTableId === 'string' || goal.externalTableId === undefined || goal.externalTableId === null) &&
      (typeof goal.externalSelection === 'string' || goal.externalSelection === undefined || goal.externalSelection === null) &&
      // "Recipe" for combining data series, can be a stringified number or a stringified object matching the ScalingRecipie type
      (typeof goal.combinationScale === 'string' || goal.combinationScale === undefined || goal.combinationScale === null) &&
      // Data series should be either undefined or have a length between 1 and dataSeriesDataFieldNames.length
      ((Array.isArray(goal.dataSeries) && goal.dataSeries.every((entry: JSONValue) => (typeof entry === 'string')) && goal.dataSeries.length > 0 && goal.dataSeries.length <= dataSeriesDataFieldNames.length)
        || goal.dataSeries === undefined) &&
      // baselineDataSeries can be a valid data series to set values, undefined to not set a baseline, or null to delete the baseline
      ((Array.isArray(goal.baselineDataSeries) && goal.baselineDataSeries.every((entry: JSONValue) => (typeof entry === 'string')) && goal.baselineDataSeries.length > 0 && goal.baselineDataSeries.length <= dataSeriesDataFieldNames.length)
        || goal.baselineDataSeries === undefined || goal.baselineDataSeries === null) &&
      // TODO: When database is next updated, dataUnit might be nullable, and an isUnitless boolean might be added
      (typeof goal.dataUnit === 'string' || goal.dataUnit === undefined) &&
      // TODO: dataScale is deprecated, to be removed in next database update
      (typeof goal.dataScale === 'string' || goal.dataScale === undefined || goal.dataScale === null) &&
      ((Array.isArray(goal.inheritFrom) && goal.inheritFrom.every((entry: JSONValue) => (
        typeof entry === 'object' &&
        entry !== null &&
        !Array.isArray(entry) &&
        typeof entry.id === 'string' &&
        (typeof entry.isInverted === 'boolean' || entry.isInverted === undefined)
      ))) || goal.inheritFrom === undefined || goal.inheritFrom === null) &&
      ((Array.isArray(goal.links) && goal.links.every((entry: JSONValue) => (
        typeof entry === 'object' &&
        entry !== null &&
        !Array.isArray(entry) &&
        typeof entry.url === 'string' &&
        (typeof entry.description === 'string' || entry.description === undefined || entry.description === null)
      ))) || goal.links === undefined || goal.links === null) &&
      // Goal ID must be a non-empty string
      (typeof goal.goalId === 'string' && goal.goalId.length > 0)
    );
  }

  if (!isGoal(goal)) {
    return Response.json({ message: 'Invalid request body' },
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
  } catch (error) {
    if (error instanceof Error) {
      if (error.message == ClientError.BadSession) {
        // Remove session to log out. The client should redirect to login page.
        session.destroy();
        return Response.json({ message: ClientError.BadSession },
          { status: 400, headers: { 'Location': '/login' } }
        );
      }
      if (error.message == ClientError.StaleData) {
        return Response.json({ message: ClientError.StaleData },
          { status: 409 }
        );
      }
      if (error.message == ClientError.IllegalParent) {
        return Response.json({ message: ClientError.IllegalParent },
          { status: 403 }
        );
      }
      if (error.message == ClientError.AccessDenied) {
        return Response.json({ message: ClientError.AccessDenied },
          { status: 403 }
        );
      }
    }
    // If no matching error is thrown, log the error and return a generic error message
    console.log(error);
    return Response.json({ message: "Internal server error" },
      { status: 500 }
    );
  }

  // Prepare for creating data series
  let dataValues: Partial<DataSeriesDataFields> | undefined | null = undefined;
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
    // Don't try to update if the received data series is undefined (but complain about null)
    // Get data series from the request
    dataValues = dataSeriesPrep(goal.dataSeries);
  }
  if (dataValues === null) {
    return Response.json({ message: 'Bad data series' },
      { status: 400 }
    );
  }

  // Prepare goal baseline (if any), or deletion thereof
  // If the baseline data series is null, it means the user wants to delete it. A value of undefined means no change.
  let shouldRemoveBaseline = goal.baselineDataSeries === null;
  if (shouldRemoveBaseline) {
    // Check if current goal has a baseline data series, if not, no need to delete it
    try {
      const currentGoal = await prisma.goal.findUnique({
        where: { id: goal.goalId },
        select: { baselineDataSeries: true }
      });
      if (currentGoal?.baselineDataSeries == null) {
        // Trying to delete the baseline when it doesn't exist will cause Prisma to throw an error
        shouldRemoveBaseline = false;
      }
    } catch {
      // Fail silently, this should either already be handled by the access check, or get handled when updating the goal
    }
  }

  let baselineValues: Partial<DataSeriesDataFields> | undefined | null = undefined;
  if (goal.baselineDataSeries?.length) {
    // Get baseline data series from the request
    baselineValues = dataSeriesPrep(goal.baselineDataSeries);
  }
  // If the baseline data series is invalid, return an error
  if (baselineValues === null) {
    return Response.json({ message: 'Bad baseline data series' },
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
                unit: goal.dataUnit ?? '',
                authorId: session.user.id,
              },
              update: {
                ...dataValues,
                unit: goal.dataUnit,
              }
            }
          }
        } : {}),
        ...(goal.inheritFrom === undefined ? {}
          : {
            // Delete all previous connections and make new ones if goal.inheritFrom changes
            combinationParents: {
              deleteMany: {},
              create: [...(goal.inheritFrom ? goal.inheritFrom.map(({ id, isInverted }) => { return ({ parentGoalId: id, isInverted }) }) : [])],
            }
          }
        ),
        // Only update the baseline data series if it is not undefined (undefined means no change)
        ...(shouldRemoveBaseline ? {
          baselineDataSeries: {
            delete: true,
          },
        } : baselineValues ? {
          baselineDataSeries: {
            upsert: {
              create: {
                ...baselineValues,
                unit: goal.dataUnit ?? '',
                authorId: session.user.id,
              },
              update: {
                ...baselineValues,
                unit: goal.dataUnit,
              }
            }
          }
        } : {}),
        combinationScale: goal.combinationScale,
        links: {
          deleteMany: {},
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
      }
    });
    // Prune any orphaned links and comments
    await pruneOrphans();
    // Invalidate old cache
    revalidateTag('goal');
    // Return the edited goal's ID if successful
    return Response.json({ message: "Goal updated", id: editedGoal.id },
      { status: 200, headers: { 'Location': `/goal/${editedGoal.id}` } }
    );
  } catch (error) {
    console.log(error);
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
    getSession(await cookies()),
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

    // If the goal is not found it either does not exist or the user has no access to it
    if (!currentGoal) {
      throw new Error(ClientError.AccessDenied, { cause: 'goal' });
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.message == ClientError.BadSession) {
        // Remove session to log out. The client should redirect to login page.
        session.destroy();
        return Response.json({ message: ClientError.BadSession },
          { status: 400, headers: { 'Location': '/login' } }
        );
      }
      if (error.message == ClientError.AccessDenied) {
        return Response.json({ message: ClientError.AccessDenied },
          { status: 403 }
        );
      }
    }
    // If no matching error is thrown, log the error and return a generic error message
    console.log(error);
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
  } catch (error) {
    console.log(error);
    return Response.json({ message: "Internal server error" },
      { status: 500 }
    );
  }
}