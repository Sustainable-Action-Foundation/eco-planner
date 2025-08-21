import { NextRequest } from "next/server";
import prisma from "@/prismaClient";
import { revalidateTag } from "next/cache";
import { cookies } from "next/headers";
import { getSession } from "@/lib/session";
import accessChecker, { hasEditAccess } from "@/lib/accessChecker";
import { AccessControlled, ClientError, Years, GoalCreateInput, GoalUpdateInput, JSONValue, DataSeriesValueFields } from "@/types";
import { goalInclusionSelection } from "@/fetchers/inclusionSelectors";
import { Prisma } from "@prisma/client";
import crypto from 'crypto';
import dataSeriesPrep from "./dataSeriesPrep";
import pruneOrphans from "@/functions/pruneOrphans";

// Type guards
function isGoalCreate(goal: JSONValue): goal is GoalCreateInput {
  return (
    // Should be a non-null object
    typeof goal === "object" &&
    goal !== null &&
    !Array.isArray(goal) &&
    // Typecheck properties
    (typeof goal.name === 'string' || goal.name === null || goal.description === undefined) &&
    (typeof goal.description === 'string' || goal.description === null || goal.description === undefined) &&
    // Indicator parameter must be a non-empty string
    (typeof goal.indicatorParameter === 'string' && goal.indicatorParameter.length > 0) &&
    (typeof goal.isFeatured === 'boolean' || goal.isFeatured === undefined) &&
    (typeof goal.externalDataset === 'string' || goal.externalDataset === undefined || goal.externalDataset === null) &&
    (typeof goal.externalTableId === 'string' || goal.externalTableId === undefined || goal.externalTableId === null) &&
    (typeof goal.externalSelection === 'string' || goal.externalSelection === undefined || goal.externalSelection === null) &&
    // Recipe for combining data series. Should be parsed and further checked outside this function
    (typeof goal.recipe === 'string' || goal.recipe === undefined || goal.recipe === null) &&
    // Data series should be either undefined or have a length between 1 and dataSeriesDataFieldNames.length
    ((Array.isArray(goal.rawDataSeries) && goal.rawDataSeries.every((entry: JSONValue) => (typeof entry === 'string' || entry === undefined || entry === null)) && goal.rawDataSeries.length <= Years.length)
      || goal.rawDataSeries === undefined) &&
    // baselineDataSeries can be a valid data series to set values, undefined to not set a baseline, or null to delete the baseline
    ((Array.isArray(goal.rawBaselineDataSeries) && goal.rawBaselineDataSeries.every((entry: JSONValue) => (typeof entry === 'string' || entry === undefined || entry === null)) && goal.rawBaselineDataSeries.length > 0 && goal.rawBaselineDataSeries.length <= Years.length)
      || goal.rawBaselineDataSeries === undefined || goal.rawBaselineDataSeries === null) &&
    // Empty string or undefined is treated as "missing unit", while null is explicitly unitless
    (typeof goal.dataUnit === 'string' || goal.dataUnit === undefined || goal.dataUnit === null) &&
    // TODO: links will soon be deprecated, should instead be included in the description
    ((Array.isArray(goal.links) && goal.links.every((entry: JSONValue) => (
      typeof entry === 'object' &&
      entry !== null &&
      !Array.isArray(entry) &&
      typeof entry.url === 'string' &&
      (typeof entry.description === 'string' || entry.description === undefined || entry.description === null)
    ))) || goal.links === undefined) &&
    // Roadmap ID must be a non-empty string
    // Invalid and forbidden IDs are rejected further down
    (typeof goal.roadmapId === 'string' && goal.roadmapId.length > 0) &&
    // Either dataSeries or recipe must be defined and not null or empty
    ((goal.rawDataSeries?.length ?? 0) > 0 || (goal.recipe?.length ?? 0) > 0)
  );
}

function isGoalUpdate(goal: JSONValue): goal is GoalUpdateInput {
  return (
    // Should be a non-null object
    typeof goal === "object" &&
    goal !== null &&
    !Array.isArray(goal) &&
    // Typecheck properties
    (typeof goal.name === 'string' || goal.name === null || goal.description === undefined) &&
    (typeof goal.description === 'string' || goal.description === null || goal.description === undefined) &&
    // Indicator parameter must be a non-empty string
    ((typeof goal.indicatorParameter === 'string' && goal.indicatorParameter.length > 0) || goal.indicatorParameter === undefined) &&
    (typeof goal.isFeatured === 'boolean' || goal.isFeatured === undefined) &&
    (typeof goal.externalDataset === 'string' || goal.externalDataset === undefined || goal.externalDataset === null) &&
    (typeof goal.externalTableId === 'string' || goal.externalTableId === undefined || goal.externalTableId === null) &&
    (typeof goal.externalSelection === 'string' || goal.externalSelection === undefined || goal.externalSelection === null) &&
    // Recipe for combining data series. Should be parsed and further checked outside this function
    (typeof goal.recipe === 'string' || goal.recipe === undefined || goal.recipe === null) &&
    // Data series should be either undefined or have a length between 1 and dataSeriesDataFieldNames.length
    ((Array.isArray(goal.rawDataSeries) && goal.rawDataSeries.every((entry: JSONValue) => (typeof entry === 'string' || entry === undefined || entry === null)) && goal.rawDataSeries.length <= Years.length)
      || goal.rawDataSeries === undefined) &&
    // baselineDataSeries can be a valid data series to set values, undefined to not set a baseline, or null to delete the baseline
    ((Array.isArray(goal.rawBaselineDataSeries) && goal.rawBaselineDataSeries.every((entry: JSONValue) => (typeof entry === 'string' || entry === undefined || entry === null)) && goal.rawBaselineDataSeries.length > 0 && goal.rawBaselineDataSeries.length <= Years.length)
      || goal.rawBaselineDataSeries === undefined || goal.rawBaselineDataSeries === null) &&
    // Empty string is treated as "missing unit", while null is explicitly unitless. (undefined means no change)
    (typeof goal.dataUnit === 'string' || goal.dataUnit === undefined || goal.dataUnit === null) &&
    // TODO: links will soon be deprecated, should instead be included in the description
    ((Array.isArray(goal.links) && goal.links.every((entry: JSONValue) => (
      typeof entry === 'object' &&
      entry !== null &&
      !Array.isArray(entry) &&
      typeof entry.url === 'string' &&
      (typeof entry.description === 'string' || entry.description === undefined || entry.description === null)
    ))) || goal.links === undefined) &&
    // Goal ID must be a non-empty string
    // Invalid and forbidden IDs are rejected separately
    (typeof goal.goalId === 'string' && goal.goalId.length > 0) &&
    // Timestamp must be a number, and is used to check if the goal is up-to-date
    (typeof goal.timestamp === 'number')
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
  if (!isGoalCreate(formData)) {
    console.log("formData failed validation");
    return Response.json({ message: 'Invalid request body' },
      { status: 400 }
    );
  }

  // Get user, roadmap
  try {
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
    if (!hasEditAccess(accessLevel)) {
      throw new Error(ClientError.IllegalParent, { cause: 'goal' });
    }
    // TODO: Access checks for goals used in recipe
  }
  catch (error) {
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

  try {
    let dataValues: Partial<DataSeriesValueFields> | undefined | null = null;
    if (formData.recipe) {
      // TODO: Handle case when a recipe is used
      // Parse and typecheck recipe
      // If the recipe is invalid, return an error UNLESS explicitly marked as incomplete somehow (needs to be added to form and here), in which case dataValues should be set to undefined
      // Calculate data series based on recipe
    } else if (formData.rawDataSeries?.length) {
      dataValues = dataSeriesPrep(formData.rawDataSeries);
    }
    // If the data series is invalid, return an error
    if (dataValues === null) {
      return Response.json({ message: 'Bad data series' },
        { status: 400 }
      );
    }

    const baselineDataSeries = formData.rawBaselineDataSeries?.length ? dataSeriesPrep(formData.rawBaselineDataSeries) : undefined;
    // If the baseline data series is invalid, return an error
    if (baselineDataSeries === null) {
      return Response.json({ message: 'Bad baseline data series' },
        { status: 400 }
      );
    }

    const recipeHash = formData.recipe ? crypto.createHash('sha256').update(formData.recipe).digest('hex') : undefined;

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
        dataSeries: dataValues ? {
          create: {
            ...dataValues,
            unit: formData.dataUnit ?? '',
            authorId: session.user.id,
          },
        } : undefined,
        baselineDataSeries: baselineDataSeries ? {
          create: {
            ...baselineDataSeries,
            unit: formData.dataUnit ?? '',
            authorId: session.user.id,
          },
        } : undefined,
        recipeUsed: formData.recipe ? {
          create: {
            hash: recipeHash as string,
            recipe: formData.recipe,
          }
        } : undefined,
        links: {
          create: formData.links?.map(link => ({
            url: link.url,
            description: link.description,
          }))
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
  }
  catch (error) {
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

  // Validate session
  if (!session.user?.id) {
    return Response.json({ message: 'Unauthorized' },
      { status: 401, headers: { 'Location': '/login' } }
    );
  }

  // Validate input
  if (!isGoalUpdate(goal)) {
    return Response.json({ message: 'Invalid request body' },
      { status: 400 }
    );
  }

  // Get user, current goal
  try {
    const [user, currentGoal] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, username: true, isAdmin: true, userGroups: true }
      }),
      prisma.goal.findUnique({
        where: { id: goal.goalId },
        include: goalInclusionSelection,
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

    // Check if the user has the right to edit the goal
    const access = accessChecker(currentGoal.roadmap, session.user);
    if (!hasEditAccess(access)) {
      throw new Error(ClientError.AccessDenied, { cause: 'goal' });
    }

    // If the provided timestamp is not up-to-date, return StaleData
    if (!goal.timestamp || currentGoal.updatedAt.getTime() > goal.timestamp) {
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

  // Edit goal
  try {
    let dataValues: Partial<DataSeriesValueFields> | undefined | null = undefined;
    if (goal.recipe) {
      // TODO: Handle case when a recipe is used
      // Parse and typecheck recipe
      // If the recipe is invalid, return an error UNLESS explicitly marked as incomplete somehow (needs to be added to form and here), in which case dataValues should be set to undefined
      // Calculate data series based on recipe
    } else if (goal.rawDataSeries?.length) {
      dataValues = dataSeriesPrep(goal.rawDataSeries);
    }
    // If the data series is invalid, return an error
    if (dataValues === null) {
      return Response.json({ message: 'Bad data series' },
        { status: 400 }
      );
    }

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

    const baselineDataSeries = goal.rawBaselineDataSeries?.length ? dataSeriesPrep(goal.rawBaselineDataSeries) : undefined;
    // If the baseline data series is invalid, return an error
    if (baselineDataSeries === null) {
      return Response.json({ message: 'Bad baseline data series' },
        { status: 400 }
      );
    }

    const recipeHash = goal.recipe ? crypto.createHash('sha256').update(goal.recipe).digest('hex') : undefined;

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
        ...(shouldRemoveBaseline ? {
          baselineDataSeries: {
            delete: true,
          },
        } : baselineDataSeries ? {
          baselineDataSeries: {
            upsert: {
              create: {
                ...baselineDataSeries,
                unit: goal.dataUnit ?? '',
                authorId: session.user.id,
              },
              update: {
                ...baselineDataSeries,
                unit: goal.dataUnit,
              }
            }
          }
        } : {}),
        // Connect, disconnect, or create recipe
        ...(goal.recipe ? {
          recipeUsed: {
            connectOrCreate: {
              where: {
                hash: recipeHash as string,
              },
              create: {
                hash: recipeHash as string,
                recipe: goal.recipe,
              }
            }
          }
        } : goal.recipe === null ? {
          recipeUsed: {
            disconnect: true
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
    void pruneOrphans();
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
    request.json() as Promise<JSONValue>
  ]);

  // Validate session
  if (!session.user?.id) {
    return Response.json({ message: 'Unauthorized' },
      { status: 401, headers: { 'Location': '/login' } }
    );
  }

  // Validate request body
  if (!goal || !(typeof goal === 'object') || Array.isArray(goal) || typeof goal.id !== 'string' || goal.id.length === 0) {
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
          // The following is an access check, implicitly checking that the user has `AccessLevel.Author` or `AccessLevel.Admin`
          ...(session.user.isAdmin ? {} : {
            OR: [
              // Either the goal, roadmap or meta roadmap must be authored by the user, unless they are an admin
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