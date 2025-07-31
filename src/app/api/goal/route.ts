import { NextRequest } from "next/server";
import prisma from "@/prismaClient";
import { revalidateTag } from "next/cache";
import { cookies } from "next/headers";
import { getSession } from "@/lib/session";
import accessChecker from "@/lib/accessChecker";
import { AccessControlled, AccessLevel, ClientError, dataSeriesDataFieldNames, GoalCreateInput, GoalUpdateInput, JSONValue } from "@/types";
import { goalInclusionSelection } from "@/fetchers/inclusionSelectors";
import { Prisma } from "@prisma/client";
import type { DataSeriesArray } from "@/functions/recipe-parser/types";

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

function isArrayOfNumbersOrNulls(value: unknown): value is (number | null)[] {
    return isArray(value) && value.every(item => item === null || isNumber(item));
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

    && (isUndefined(goal.dataSeriesArray) || isArrayOfNumbersOrNulls(goal.dataSeriesArray))
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

  console.log("Received formData:", JSON.stringify(formData, null, 2));

  // Validate session
  if (!session.user?.id) {
    return Response.json({ message: 'Unauthorized' },
      { status: 401, headers: { 'Location': '/login' } }
    );
  }

  // Validate form data type
  if (!isTypeGoalCreateInput(formData)) {
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
    if (accessLevel === AccessLevel.None || accessLevel === AccessLevel.View) {
      throw new Error(ClientError.IllegalParent, { cause: 'goal' });
    }

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
    const dataSeries = formData.dataSeriesArray ?
      Object.fromEntries(
        dataSeriesDataFieldNames.map((field, i) => [field, formData.dataSeriesArray?.[i] ?? null])
      ) :
      undefined;

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
        dataSeries: dataSeries ? {
          create: {
            ...dataSeries,
            unit: formData.dataUnit,
            authorId: session.user.id,
          },
        } : undefined,
        ...(formData.recipeHash ? {
          recipeUsed: {
            connect: { hash: formData.recipeHash },
          },
        } : {}),
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
    const access = accessChecker(currentGoal.roadmap, { ...user, userGroups: user.userGroups.map(g => g.id) });
    if (access !== AccessLevel.Author && access !== AccessLevel.Edit) {
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
        ); revalidateTag
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
        where: { id: goal.id },
        include: goalInclusionSelection,
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

    // Check if the user has the right to delete the goal
    const access = accessChecker(currentGoal.roadmap, { ...user, userGroups: user.userGroups.map(g => g.id) });
    if (access !== AccessLevel.Author && access !== AccessLevel.Edit) {
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