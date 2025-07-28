import { NextRequest } from "next/server";
import { getSession } from "@/lib/session"
import prisma from "@/prismaClient";
import { AccessControlled, AccessLevel, ClientError, dataSeriesDataFieldNames, DataSeriesDataFields, GoalCreateInput, GoalUpdateInput, JSONValue } from "@/types";
import { DataSeries, Prisma } from "@prisma/client";
import accessChecker from "@/lib/accessChecker";
import { revalidateTag } from "next/cache";
import dataSeriesPrep from "./dataSeriesPrep";
import pruneOrphans from "@/functions/pruneOrphans";
import { cookies } from "next/headers";
import getOneGoal from "@/fetchers/getOneGoal";
import { recalculateGoal } from "@/functions/recalculateGoal";
import { DataSeriesArray } from "@/functions/recipe-parser/types";

function isNull(value: unknown): value is null {
  return value === null;
}

function isUndefined(value: unknown): value is undefined {
  return value === undefined;
}

function isNullOrUndefined(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

function isString(value: unknown): value is string {
  return !isNullOrUndefined(value) && typeof value === 'string' && value.length > 0;
}

function isBoolean(value: unknown): value is boolean {
  return !isNullOrUndefined(value) && typeof value === 'boolean';
}

function isNumber(value: unknown): value is number {
  return !isNullOrUndefined(value) && typeof value === 'number' && !isNaN(value);
}

function isDate(value: unknown): value is Date {
  return !isNullOrUndefined(value) && value instanceof Date && !isNaN(value.getTime());
}

function isArray(value: unknown): value is unknown[] {
  return !isNullOrUndefined(value) && Array.isArray(value);
}

function isArrayOfStrings(value: unknown): value is string[] {
  return isArray(value) && value.every(item => isString(item));
}

// Type guard and check if the request body is a valid GoalInput
function isTypeGoalCreateInput(goal: JSONValue): goal is GoalCreateInput {
  return (
    typeof goal === 'object'
    && !isNullOrUndefined(goal)
    && !isArray(goal)
    && Object.keys(goal).length > 0 // Ensure it's not an empty object

    && (isNullOrUndefined(goal.name) || isString(goal.name))
    && (isNullOrUndefined(goal.description) || isString(goal.description))
    && (isString(goal.indicatorParameter))

    && (isUndefined(goal.isFeatured) || isBoolean(goal.isFeatured))

    && (isNullOrUndefined(goal.externalDataset) || isString(goal.externalDataset))
    && (isNullOrUndefined(goal.externalTableId) || isString(goal.externalTableId))
    && (isNullOrUndefined(goal.externalSelection) || isString(goal.externalSelection))

    && (isString(goal.roadmapId))

    && (isUndefined(goal.recipeHash) || isString(goal.recipeHash))

    && (isUndefined(goal.rawDataSeries) || isArrayOfStrings(goal.rawDataSeries))
    && (isNullOrUndefined(goal.rawBaselineDataSeries) || isArrayOfStrings(goal.rawBaselineDataSeries))
    && (isNullOrUndefined(goal.dataUnit) || isString(goal.dataUnit))

    && (isNullOrUndefined(goal.links) || (isArray(goal.links) && goal.links.every(link => (
      typeof link === 'object'
      && !isNullOrUndefined(link)
      && !Array.isArray(link)
      && isString(link.url)
      && (isNullOrUndefined(link.description) || isString(link.description))
    ))))
  );
}

function isTypeGoalUpdateInput(goal: JSONValue): goal is GoalUpdateInput {
  return (
    typeof goal === 'object'
    && !isNullOrUndefined(goal)
    && !isArray(goal)
    && Object.keys(goal).length > 0 // Ensure it's not an empty object

    && (isNullOrUndefined(goal.name) || isString(goal.name))
    && (isNullOrUndefined(goal.description) || isString(goal.description))
    && (isUndefined(goal.indicatorParameter) || isString(goal.indicatorParameter))

    && (isUndefined(goal.isFeatured) || isBoolean(goal.isFeatured))

    && (isNullOrUndefined(goal.externalDataset) || isString(goal.externalDataset))
    && (isNullOrUndefined(goal.externalTableId) || isString(goal.externalTableId))
    && (isNullOrUndefined(goal.externalSelection) || isString(goal.externalSelection))

    && (isString(goal.goalId))

    && (isUndefined(goal.timestamp) || isNumber(goal.timestamp))

    && (isUndefined(goal.recipeHash) || isString(goal.recipeHash))

    && (isUndefined(goal.rawDataSeries) || isArrayOfStrings(goal.rawDataSeries))
    && (isNullOrUndefined(goal.rawBaselineDataSeries) || isArrayOfStrings(goal.rawBaselineDataSeries))
    && (isNullOrUndefined(goal.dataUnit) || isString(goal.dataUnit))

    && (isNullOrUndefined(goal.links) || (isArray(goal.links) && goal.links.every(link => (
      typeof link === 'object'
      && !isNullOrUndefined(link)
      && !Array.isArray(link)
      && isString(link.url)
      && (isNullOrUndefined(link.description) || isString(link.description))
    ))))
  );
}


/**
 * Handles POST requests to the goal API
 */
export async function POST(request: NextRequest) {
  const [session, formData] = await Promise.all([
    getSession(await cookies()),
    request.json() as Promise<JSONValue>,
  ]);

  // Validate session
  if (!session.user?.id) {
    return Response.json({ message: 'Unauthorized' },
      { status: 401, headers: { 'Location': '/login' } }
    );
  }

  // Validate form data type
  if (!isTypeGoalCreateInput(formData)) {
    return Response.json({ message: 'Invalid request body' },
      { status: 400 }
    );
  }

  try {
    // Get user, roadmap
    const [user, roadmap] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, username: true, isAdmin: true, userGroups: true }
      }),
      prisma.roadmap.findUnique({
        where: { id: formData.roadmapId },
        select: {
          author: { select: { id: true, username: true } },
          editors: { select: { id: true, username: true } },
          viewers: { select: { id: true, username: true } },
          editGroups: { include: { users: { select: { id: true, username: true } } } },
          viewGroups: { include: { users: { select: { id: true, username: true } } } },
          isPublic: true,
        }
      }),
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

    // TODO - reimplement with recipe
    // // If the user tries to inherit from a goal they don't have access to, return IllegalParent
    // for (const relatedGoal of relatedGoals) {
    //   if (!relatedGoal) {
    //     throw new Error(ClientError.IllegalParent, { cause: 'goal' });
    //   }
    // }
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

  // TODO - validate data series
  const dataSeriesArray: DataSeriesArray = {};
  for (const field of dataSeriesDataFieldNames) {
    const value = formData.dataSeriesArray?.[field];
    if (isNullOrUndefined(value)) {
      dataSeriesArray[field] = null;
    }
    else if (isString(value) && Number.isFinite(parseFloat(value))) {
      dataSeriesArray[field] = parseFloat(value);
    }
    else if (isNumber(value)) {
      dataSeriesArray[field] = value;
    }
    else {
      console.warn(`Invalid value for data series field "${field}":`, value, "Setting to null");
      dataSeriesArray[field] = null; // If the value is not a number or string, set it to null
    }
  };

  // Create goal
  try {
    const newGoal = await prisma.goal.create({
      data: {
        name: formData.name,
        description: formData.description,
        indicatorParameter: formData.indicatorParameter,
        isFeatured: formData.isFeatured,
        externalDataset: formData.externalDataset,
        externalTableId: formData.externalTableId,
        externalSelection: formData.externalSelection,
        author: {
          connect: { id: session.user.id },
        },
        roadmap: {
          connect: { id: formData.roadmapId },
        },
        dataSeries: {
          create: {
            ...dataSeriesArray,
            unit: formData.dataUnit,
            authorId: session.user.id,
          },
        },
        // TODO - validate this
        baselineDataSeries: formData.rawBaselineDataSeries ? {
          create: {
            ...formData.rawBaselineDataSeries,
            unit: formData.dataUnit,
            authorId: session.user.id,
          },
        } : undefined,
        links: {
          create: formData.links?.map(link => {
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

  if (!isTypeGoalUpdateInput(goal)) {
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
    // Get user, current goal
    const [user, currentGoal] = await Promise.all([
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

  // TODO - reimplement with recipes
  // Prepare for creating data series
  // let dataValues: Partial<DataSeriesDataFields> | undefined | null = undefined;
  // if (goal.inheritFrom?.length) {
  //   // Combine the data series of the parent goals
  //   const parentGoals = await Promise.all(goal.inheritFrom.map(({ id }) => getOneGoal(id)));
  //   const combinationParents: {
  //     isInverted: boolean,
  //     parentGoal: {
  //       dataSeries: DataSeries | null
  //     }
  //   }[] = goal.inheritFrom.map(({ id, isInverted }) => {
  //     const parentGoal = parentGoals.find(goal => goal?.id === id);
  //     return { isInverted: isInverted ?? false, parentGoal: { dataSeries: parentGoal?.dataSeries ?? null } };
  //   });
  //   dataValues = await recalculateGoal({ combinationScale: goal.combinationScale ?? null, combinationParents });
  // } else if (goal.dataSeries) {
  //   // Don't try to update if the received data series is undefined (but complain about null)
  //   // Get data series from the request
  //   dataValues = dataSeriesPrep(goal.dataSeries);
  // }
  // if (dataValues === null) {
  //   return Response.json({ message: 'Bad data series' },
  //     { status: 400 }
  //   );
  // }

  

  // Prepare goal baseline (if any), or deletion thereof
  // If the baseline data series is null, it means the user wants to delete it. A value of undefined means no change.
  let shouldRemoveBaseline = goal.rawBaselineDataSeries === null;
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
  if (goal.rawBaselineDataSeries?.length) {
    // Get baseline data series from the request
    baselineValues = dataSeriesPrep(goal.rawBaselineDataSeries);
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
        // TODO - reimplement with recipe
        // Only update the data series if it is not undefined (undefined means no change)
        // ...(dataValues ? {
        //   dataSeries: {
        //     upsert: {
        //       create: {
        //         ...dataValues,
        //         unit: goal.dataUnit,
        //         authorId: session.user.id,
        //       },
        //       update: {
        //         ...dataValues,
        //         unit: goal.dataUnit,
        //       }
        //     }
        //   }
        // } : {}),
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
                unit: goal.dataUnit,
                authorId: session.user.id,
              },
              update: {
                ...baselineValues,
                unit: goal.dataUnit,
              }
            }
          }
        } : {}),
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

  // Validate session
  if (!session.user?.id) {
    return Response.json({ message: 'Unauthorized' },
      { status: 401, headers: { 'Location': '/login' } }
    );
  }

  // Validate request body
  if (!goal.id) {
    return Response.json({ message: 'Missing required input parameters' },
      { status: 400 }
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