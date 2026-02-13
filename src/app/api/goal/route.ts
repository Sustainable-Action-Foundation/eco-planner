import { NextRequest } from "next/server";
import prisma from "@/prismaClient";
import { revalidateTag } from "next/cache";
import { cookies } from "next/headers";
import { getSession } from "@/lib/session";
import accessChecker, { hasEditAccess } from "@/lib/accessChecker";
import { AccessControlled, ClientError, GoalCreateInput, GoalUpdateInput, JSONValue, isStandardObject, isDateValuesWithUnit } from "@/types";
import { goalInclusionSelection } from "@/fetchers/inclusionSelectors";
import { Prisma } from "@prisma/client";
import pruneOrphans from "@/functions/pruneOrphans";
import { isRecipe } from "@/functions/recipe/types";
import { dateValuesToDBDateRecord } from "@/functions/recipe/extractors";

function tryParseJSON(value: unknown): { ok: true; value: unknown } | { ok: false } {
  if (typeof value !== "string") return { ok: true, value };
  try {
    return { ok: true, value: JSON.parse(value) };
  } catch {
    return { ok: false };
  }
}

/** 
 * WARNING! also mutates and deserializes the input goal object!
 */
export function isGoalCreate(goal: unknown): goal is GoalCreateInput {
  if (!isStandardObject(goal)) return false;

  if ("goalId" in goal) return false;
  if ("timestamp" in goal) return false;

  if (!("roadmapId" in goal) || typeof goal.roadmapId !== 'string') return false;
  if (!("indicatorParameter" in goal) || typeof goal.indicatorParameter !== 'string') return false;
  if (!("name" in goal) || !(typeof goal.name === 'string' || goal.name === null || goal.name === undefined)) return false;
  if (!("description" in goal) || !(typeof goal.description === 'string' || goal.description === null || goal.description === undefined)) return false;
  if (!("isFeatured" in goal) || !(typeof goal.isFeatured === 'boolean' || goal.isFeatured === undefined)) return false;
  if (!("externalDataset" in goal) || !(typeof goal.externalDataset === 'string' || goal.externalDataset === null || goal.externalDataset === undefined)) return false;
  if (!("externalTableId" in goal) || !(typeof goal.externalTableId === 'string' || goal.externalTableId === null || goal.externalTableId === undefined)) return false;
  if (!("externalSelection" in goal) || !(typeof goal.externalSelection === 'string' || goal.externalSelection === null || goal.externalSelection === undefined)) return false;

  if ("recipeSuggestions" in goal && !(
    (
      Array.isArray(goal.recipeSuggestions)
      && goal.recipeSuggestions.every(isRecipe)
    )
    || goal.recipeSuggestions === null
    || goal.recipeSuggestions === undefined
  )) return false;

  if (!("dataSeries" in goal)) return false;
  {
    const parsed = tryParseJSON(goal.dataSeries);
    if (!parsed.ok) return false;
    goal.dataSeries = parsed.value as GoalCreateInput["dataSeries"];
  }
  if (!(
    isStandardObject(goal.dataSeries)
    && isDateValuesWithUnit(goal.dataSeries)
  )) return false;
  if (!("dataSeriesId" in goal) || !(typeof goal.dataSeriesId === 'string' || goal.dataSeriesId === null || goal.dataSeriesId === undefined)) return false;
  if (!("dataSeriesRecipe" in goal)) return false;
  {
    const parsed = tryParseJSON(goal.dataSeriesRecipe);
    if (!parsed.ok) return false;
    goal.dataSeriesRecipe = parsed.value as GoalCreateInput["dataSeriesRecipe"];
  }
  if (!(
    goal.dataSeriesRecipe === null
    || goal.dataSeriesRecipe === undefined
    || isStandardObject(goal.dataSeriesRecipe)
    && isRecipe(goal.dataSeriesRecipe)
  )) return false;

  if (!("baseline" in goal)) return false;
  {
    const parsed = tryParseJSON(goal.baseline);
    if (!parsed.ok) return false;
    goal.baseline = parsed.value as GoalCreateInput["baseline"];
  }
  if (!(
    isStandardObject(goal.baseline)
    && isDateValuesWithUnit(goal.baseline)
  )) return false;
  if (!("baselineId" in goal) || !(typeof goal.baselineId === 'string' || goal.baselineId === null || goal.baselineId === undefined)) return false;
  if (!("baselineRecipe" in goal)) return false;
  {
    const parsed = tryParseJSON(goal.baselineRecipe);
    if (!parsed.ok) return false;
    goal.baselineRecipe = parsed.value as GoalCreateInput["baselineRecipe"];
  }
  if (!(
    goal.baselineRecipe === null
    || goal.baselineRecipe === undefined
    || isStandardObject(goal.baselineRecipe)
    && isRecipe(goal.baselineRecipe)
  )) return false;

  if (!("links" in goal) || !(
    goal.links === undefined
    || goal.links === null
    || (
      Array.isArray(goal.links)
      && goal.links.every(link =>
        isStandardObject(link)
        && "url" in link && typeof link.url === 'string'
        && (!("description" in link) || typeof link.description === 'string' || link.description === null)
      )
    )
  )) return false;

  return true;
}

/** 
 * WARNING! also mutates and deserializes the input goal object!
 */
function isGoalUpdate(goal: unknown): goal is GoalUpdateInput {
  if (!isStandardObject(goal)) return false;

  if (!("goalId" in goal) || typeof goal.goalId !== 'string') return false;
  if (!("timestamp" in goal) || typeof goal.timestamp !== 'number') return false;

  if (!("indicatorParameter" in goal) || !(typeof goal.indicatorParameter === 'string' || goal.indicatorParameter === null || goal.indicatorParameter === undefined)) return false;
  if (!("name" in goal) || !(typeof goal.name === 'string' || goal.name === null || goal.name === undefined)) return false;
  if (!("description" in goal) || !(typeof goal.description === 'string' || goal.description === null || goal.description === undefined)) return false;
  if (!("isFeatured" in goal) || !(typeof goal.isFeatured === 'boolean' || goal.isFeatured === undefined)) return false;
  if (!("externalDataset" in goal) || !(typeof goal.externalDataset === 'string' || goal.externalDataset === null || goal.externalDataset === undefined)) return false;
  if (!("externalTableId" in goal) || !(typeof goal.externalTableId === 'string' || goal.externalTableId === null || goal.externalTableId === undefined)) return false;
  if (!("externalSelection" in goal) || !(typeof goal.externalSelection === 'string' || goal.externalSelection === null || goal.externalSelection === undefined)) return false;

  if ("dataSeries" in goal) {
    const parsed = tryParseJSON(goal.dataSeries);
    if (!parsed.ok) return false;
    goal.dataSeries = parsed.value as GoalUpdateInput["dataSeries"];
    if (!(
      goal.dataSeries === null
      || goal.dataSeries === undefined
      || isStandardObject(goal.dataSeries)
      && isDateValuesWithUnit(goal.dataSeries)
    )) return false;
  }
  if (!("dataSeriesId" in goal) || !(typeof goal.dataSeriesId === 'string' || goal.dataSeriesId === null || goal.dataSeriesId === undefined)) return false;
  if (!("dataSeriesRecipe" in goal)) return false;
  {
    const parsed = tryParseJSON(goal.dataSeriesRecipe);
    if (!parsed.ok) return false;
    goal.dataSeriesRecipe = parsed.value as GoalUpdateInput["dataSeriesRecipe"];
  }
  if (!(
    goal.dataSeriesRecipe === null
    || goal.dataSeriesRecipe === undefined
    || isStandardObject(goal.dataSeriesRecipe)
    && isRecipe(goal.dataSeriesRecipe)
  )) return false;

  if ("baseline" in goal) {
    const parsed = tryParseJSON(goal.baseline);
    if (!parsed.ok) return false;
    goal.baseline = parsed.value as GoalUpdateInput["baseline"];
    if (!(
      goal.baseline === null
      || goal.baseline === undefined
      || isStandardObject(goal.baseline)
      && isDateValuesWithUnit(goal.baseline)
    )) return false;
  }
  if (!("baselineId" in goal) || !(typeof goal.baselineId === 'string' || goal.baselineId === null || goal.baselineId === undefined)) return false;
  if (!("baselineRecipe" in goal)) return false;
  {
    const parsed = tryParseJSON(goal.baselineRecipe);
    if (!parsed.ok) return false;
    goal.baselineRecipe = parsed.value as GoalUpdateInput["baselineRecipe"];
  }
  if (!(
    goal.baselineRecipe === null
    || goal.baselineRecipe === undefined
    || isStandardObject(goal.baselineRecipe)
    && isRecipe(goal.baselineRecipe)
  )) return false;

  if (!("links" in goal) || !(
    goal.links === undefined
    || goal.links === null
    || (
      Array.isArray(goal.links)
      && goal.links.every(link =>
        isStandardObject(link)
        && "url" in link && typeof link.url === 'string'
        && (!("description" in link) || typeof link.description === 'string' || link.description === null)
      )
    )
  )) return false;

  return true;
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

  // Auth control
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
    };
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

  let goalId: string | undefined = undefined;

  // Parse form data
  try {
    await prisma.$transaction(async (prisma) => {
      // Create recipes first
      // New recipe data + existing recipe ID = update
      if (formData.dataSeriesRecipe && formData.dataSeriesRecipeId) {
        await prisma.recipe.update({
          where: { id: formData.dataSeriesRecipeId, },
          data: { recipe: formData.dataSeriesRecipe, },
        });
      }
      // New recipe data + no existing recipe ID = create
      else if (formData.dataSeriesRecipe) {
        formData.dataSeriesRecipeId = (await prisma.recipe.create({
          data: { recipe: formData.dataSeriesRecipe, },
          select: { id: true, },
        })).id;
      }
      // No new recipe data + existing recipe ID = link (if exists)
      else if (!formData.dataSeriesRecipe && formData.dataSeriesRecipeId) {
        const existingRecipe = await prisma.recipe.findUnique({
          where: { id: formData.dataSeriesRecipeId, },
          select: { id: true, },
        });
        if (!existingRecipe) {
          console.warn(`Goal creation: tried linking goal with a data series recipe (${formData.dataSeriesRecipeId}) but not found, unlinking...`);
          formData.dataSeriesRecipeId = null;
        }
      }
      // Baseline recipe
      // New recipe data + existing recipe ID = update
      if (formData.baselineRecipe && formData.baselineRecipeId) {
        await prisma.recipe.update({
          where: { id: formData.baselineRecipeId, },
          data: { recipe: formData.baselineRecipe, },
        });
      }
      // New recipe data + no existing recipe ID = create
      else if (formData.baselineRecipe) {
        formData.baselineRecipeId = (await prisma.recipe.create({
          data: { recipe: formData.baselineRecipe, },
          select: { id: true, },
        })).id;
      }
      // No new recipe data + existing recipe ID = link (if exists)
      else if (!formData.baselineRecipe && formData.baselineRecipeId) {
        const existingRecipe = await prisma.recipe.findUnique({
          where: { id: formData.baselineRecipeId, },
          select: { id: true, },
        });
        if (!existingRecipe) {
          console.warn(`Goal creation: tried linking goal with a baseline recipe (${formData.baselineRecipeId}) but not found, unlinking...`);
          formData.baselineRecipeId = null;
        }
      }

      // Create goal
      goalId = (await prisma.goal.create({
        data: {
          name: formData.name,
          description: formData.description,
          indicatorParameter: formData.indicatorParameter,
          isFeatured: formData.isFeatured,
          externalDataset: formData.externalDataset,
          externalTableId: formData.externalTableId,
          externalSelection: formData.externalSelection,
          author: {
            connect: { id: session.user?.id },
          },
          roadmap: {
            connect: { id: formData.roadmapId },
          },
          dataSeries: {
            create: {
              author: { connect: { id: session.user?.id }, },
              recipeUsed: formData.dataSeriesRecipeId !== null
                ? { connect: { id: formData.dataSeriesRecipeId, }, }
                : undefined,
              values: { createMany: { data: dateValuesToDBDateRecord(formData.dataSeries.dateValues) }, },
              ...(formData.dataSeries.unit == null ? {} : { unit: formData.dataSeries.unit }),
            },
          },
          ...(!formData.baseline ? {} : {
            baseline: {
              create: {
                author: { connect: { id: session.user?.id }, },
                recipeUsed: formData.baselineRecipeId !== null
                  ? { connect: { id: formData.baselineRecipeId, }, }
                  : undefined,
                values: { createMany: { data: dateValuesToDBDateRecord(formData.baseline.dateValues) }, },
                ...(formData.baseline.unit == null ? {} : { unit: formData.baseline.unit }),
              },
            },
          }),
          links: {
            create: formData.links?.map(link => ({
              url: link.url,
              description: link.description,
            })),
          },
        },
        select: {
          id: true,
        },
      })).id;
    });

    // Invalidate old cache
    revalidateTag('goal');
    // Return the new goal's ID if successful
    return Response.json({ message: "Goal created", id: goalId },
      { status: 201, headers: { 'Location': `/goal/${goalId}` } }
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
  let goalId: string | undefined = undefined;
  try {
    await prisma.$transaction(async (prisma) => {
      // Do recipes before goal update
      // New recipe data + existing recipe ID = update
      if (goal.dataSeriesRecipe && goal.dataSeriesRecipeId) {
        await prisma.recipe.update({
          where: { id: goal.dataSeriesRecipeId, },
          data: { recipe: goal.dataSeriesRecipe, },
        });
      }
      // New recipe data + no existing recipe ID = create
      else if (goal.dataSeriesRecipe) {
        goal.dataSeriesRecipeId = (await prisma.recipe.create({
          data: { recipe: goal.dataSeriesRecipe, },
          select: { id: true, },
        })).id;
      }
      // No new recipe data + existing recipe ID = link (if exists)
      else if (!goal.dataSeriesRecipe && goal.dataSeriesRecipeId) {
        const existingRecipe = await prisma.recipe.findUnique({
          where: { id: goal.dataSeriesRecipeId, },
          select: { id: true, },
        });
        if (!existingRecipe) {
          console.warn(`Goal update: tried updating goal with a data series recipe (${goal.dataSeriesRecipeId}) but not found, unlinking...`);
          goal.dataSeriesRecipeId = null;
        }
      }
      // Baseline recipe
      // New recipe data + existing recipe ID = update
      if (goal.baselineRecipe && goal.baselineRecipeId) {
        await prisma.recipe.update({
          where: { id: goal.baselineRecipeId, },
          data: { recipe: goal.baselineRecipe, },
        });
      }
      // New recipe data + no existing recipe ID = create
      else if (goal.baselineRecipe) {
        goal.baselineRecipeId = (await prisma.recipe.create({
          data: { recipe: goal.baselineRecipe, },
          select: { id: true, },
        })).id;
      }
      // No new recipe data + existing recipe ID = link (if exists)
      else if (!goal.baselineRecipe && goal.baselineRecipeId) {
        const existingRecipe = await prisma.recipe.findUnique({
          where: { id: goal.baselineRecipeId, },
          select: { id: true, },
        });
        if (!existingRecipe) {
          console.warn(`Goal update: tried updating goal with a baseline recipe (${goal.baselineRecipeId}) but not found, unlinking...`);
          goal.baselineRecipeId = null;
        }
      }

      // Update goal
      goalId = (await prisma.goal.update({
        where: { id: goal.goalId },
        data: {
          name: goal.name,
          description: goal.description,
          indicatorParameter: goal.indicatorParameter,
          isFeatured: goal.isFeatured,
          externalDataset: goal.externalDataset,
          externalTableId: goal.externalTableId,
          externalSelection: goal.externalSelection,
          dataSeries: !goal.dataSeries
            ? undefined
            : {
              update: {
                recipeUsed: goal.dataSeriesRecipeId !== null
                  ? { connect: { id: goal.dataSeriesRecipeId, }, }
                  : { disconnect: true, },
                values: { createMany: { data: dateValuesToDBDateRecord(goal.dataSeries.dateValues) }, },
                ...(goal.dataSeries.unit == null ? {} : { unit: goal.dataSeries.unit }),
              },
            },
          baseline: !goal.baseline
            ? undefined
            : {
              update: {
                recipeUsed: goal.baselineRecipeId !== null
                  ? { connect: { id: goal.baselineRecipeId, }, }
                  : { disconnect: true, },
                values: { createMany: { data: dateValuesToDBDateRecord(goal.baseline.dateValues) }, },
                ...(goal.baseline.unit == null ? {} : { unit: goal.baseline.unit }),
              },
            },
          links: {
            deleteMany: {},
            create: goal.links?.map(link => ({
              url: link.url,
              description: link.description,
            })),
          },
        },
        select: {
          id: true,
        },
      })).id;
    });

    // Prune any orphaned links and comments
    void pruneOrphans();
    // Invalidate old cache
    revalidateTag('goal');
    // Return the edited goal's ID if successful
    return Response.json({ message: "Goal updated", id: goalId },
      { status: 200, headers: { 'Location': `/goal/${goalId}` } }
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