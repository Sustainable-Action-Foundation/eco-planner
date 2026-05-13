import type { NextRequest } from "next/server";
import prisma, { Prisma } from "@/prismaClient";
import { revalidateTag } from "next/cache";
import { cookies } from "next/headers";
import { getSession } from "@/lib/session";
import accessChecker, { hasEditAccess } from "@/lib/accessChecker";
import { ClientError, isGoalCreate, isGoalUpdate } from "@/types";
import type { AccessControlled, JSONValue } from "@/types";
import { goalInclusionSelection } from "@/fetchers/inclusionSelectors";
import pruneOrphans from "@/functions/pruneOrphans";
import { dateValuesToDBDateRecord } from "@/functions/recipe/vectorAndMaskUtils";
import serveTea from "@/lib/i18nServer";


/**
 * Handles POST requests to the goal API
 */
export async function POST(request: NextRequest) {
  const [session, formData] = await Promise.all([
    getSession(await cookies()),
    request.json() as Promise<JSONValue>,
  ]);
  const t = await serveTea("api");

  // Validate session
  if (!session.user?.id) {
    return Response.json({ message: t('api:common.unauthorized') },
      { status: 401, headers: { 'Location': '/login' } },
    );
  }

  // Validate form data type
  if (!isGoalCreate(formData)) {
    console.error("formData failed validation");
    return Response.json({ message: t('api:common.invalid_request_body') },
      { status: 400 },
    );
  }

  // Auth control
  try {
    const [user, roadmap] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, username: true, isAdmin: true, userGroups: true },
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
        },
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
      if (error.message === ClientError.BadSession) {
        // Remove session to log out. The client should redirect to login page.
        session.destroy();
        return Response.json({ message: ClientError.BadSession },
          { status: 400, headers: { 'Location': '/login' } },
        );
      }
      if (error.message === ClientError.IllegalParent) {
        return Response.json({ message: ClientError.IllegalParent },
          { status: 403 },
        );
      }
    }
    // If no matching error is thrown, log the error and return a generic error message
    console.error(error);
    return Response.json({ message: t('api:common.server_error') },
      { status: 500 },
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
          where: { id: formData.dataSeriesRecipeId },
          data: { recipe: formData.dataSeriesRecipe },
        });
      }
      // New recipe data + no existing recipe ID = create
      else if (formData.dataSeriesRecipe) {
        formData.dataSeriesRecipeId = (await prisma.recipe.create({
          data: { recipe: formData.dataSeriesRecipe },
          select: { id: true },
        })).id;
      }
      // No new recipe data + existing recipe ID = link (if exists)
      else if (!formData.dataSeriesRecipe && formData.dataSeriesRecipeId) {
        const existingRecipe = await prisma.recipe.findUnique({
          where: { id: formData.dataSeriesRecipeId },
          select: { id: true },
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
          where: { id: formData.baselineRecipeId },
          data: { recipe: formData.baselineRecipe },
        });
      }
      // New recipe data + no existing recipe ID = create
      else if (formData.baselineRecipe) {
        formData.baselineRecipeId = (await prisma.recipe.create({
          data: { recipe: formData.baselineRecipe },
          select: { id: true },
        })).id;
      }
      // No new recipe data + existing recipe ID = link (if exists)
      else if (!formData.baselineRecipe && formData.baselineRecipeId) {
        const existingRecipe = await prisma.recipe.findUnique({
          where: { id: formData.baselineRecipeId },
          select: { id: true },
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
              author: { connect: { id: session.user?.id } },
              recipeUsed: typeof formData.dataSeriesRecipeId === 'string'
                ? { connect: { id: formData.dataSeriesRecipeId } }
                : undefined,
              values: { createMany: { data: dateValuesToDBDateRecord(formData.dataSeries.dateValues) } },
              unit: formData.dataSeries.unit,
            },
          },
          baseline: formData.baseline
            ? {
              connectOrCreate: {
                where: { id: formData.baselineId ?? "" },
                create: {
                  author: { connect: { id: session.user?.id } },
                  recipeUsed: typeof formData.baselineRecipeId === 'string'
                    ? { connect: { id: formData.baselineRecipeId } }
                    : undefined,
                  values: { createMany: { data: dateValuesToDBDateRecord(formData.baseline.dateValues) } },
                  unit: formData.baseline.unit,
                },
              },
            }
            : formData.baselineId
              ? {
                connect: { id: formData.baselineId },
              }
              : undefined,
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
    revalidateTag('goal', 'max');
    // Return the new goal's ID if successful
    return Response.json({ message: t('api:goal.goal_created'), id: goalId },
      { status: 201, headers: { 'Location': `/goal/${goalId}` } },
    );
  }
  catch (error) {
    console.error(error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return Response.json({ message: t('api:goal.roadmap_not_found') },
        { status: 400 },
      );
    }
    return Response.json({ message: t('api:common.server_error') },
      { status: 500 },
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
  const t = await serveTea("api");

  // Validate session
  if (!session.user?.id) {
    return Response.json({ message: t('api:common.unauthorized') },
      { status: 401, headers: { 'Location': '/login' } },
    );
  }

  // Validate input
  if (!isGoalUpdate(goal)) {
    return Response.json({ message: t('api:common.invalid_request_body') },
      { status: 400 },
    );
  }

  // Get user, current goal
  try {
    const [user, currentGoal] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, username: true, isAdmin: true, userGroups: true },
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
      if (error.message === ClientError.BadSession) {
        // Remove session to log out. The client should redirect to login page.
        session.destroy();
        return Response.json({ message: ClientError.BadSession },
          { status: 400, headers: { 'Location': '/login' } },
        );
      }
      if (error.message === ClientError.StaleData) {
        return Response.json({ message: ClientError.StaleData },
          { status: 409 },
        );
      }
      if (error.message === ClientError.IllegalParent) {
        return Response.json({ message: ClientError.IllegalParent },
          { status: 403 },
        );
      }
      if (error.message === ClientError.AccessDenied) {
        return Response.json({ message: ClientError.AccessDenied },
          { status: 403 },
        );
      }
    }
    // If no matching error is thrown, log the error and return a generic error message
    console.error(error);
    return Response.json({ message: t('api:common.server_error') },
      { status: 500 },
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
          where: { id: goal.dataSeriesRecipeId },
          data: { recipe: goal.dataSeriesRecipe },
        });
      }
      // New recipe data + no existing recipe ID = create
      else if (goal.dataSeriesRecipe) {
        goal.dataSeriesRecipeId = (await prisma.recipe.create({
          data: { recipe: goal.dataSeriesRecipe },
          select: { id: true },
        })).id;
      }
      // No new recipe data + existing recipe ID = link (if exists)
      else if (!goal.dataSeriesRecipe && goal.dataSeriesRecipeId) {
        const existingRecipe = await prisma.recipe.findUnique({
          where: { id: goal.dataSeriesRecipeId },
          select: { id: true },
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
          where: { id: goal.baselineRecipeId },
          data: { recipe: goal.baselineRecipe },
        });
      }
      // New recipe data + no existing recipe ID = create
      else if (goal.baselineRecipe) {
        goal.baselineRecipeId = (await prisma.recipe.create({
          data: { recipe: goal.baselineRecipe },
          select: { id: true },
        })).id;
      }
      // No new recipe data + existing recipe ID = link (if exists)
      else if (!goal.baselineRecipe && goal.baselineRecipeId) {
        const existingRecipe = await prisma.recipe.findUnique({
          where: { id: goal.baselineRecipeId },
          select: { id: true },
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
          dataSeries: goal.dataSeries ? {
            upsert: {
              create: {
                author: { connect: { id: session.user?.id } },
                recipeUsed: typeof goal.dataSeriesRecipeId === 'string'
                  ? { connect: { id: goal.dataSeriesRecipeId } }
                  : undefined,
                values: { createMany: { data: dateValuesToDBDateRecord(goal.dataSeries.dateValues) } },
                ...(goal.dataSeries.unit == null ? {} : { unit: goal.dataSeries.unit }),
              },
              update: {
                recipeUsed: goal.dataSeriesRecipeId === undefined
                  ? undefined
                  : typeof goal.dataSeriesRecipeId === 'string'
                    ? { connect: { id: goal.dataSeriesRecipeId } }
                    : { disconnect: true },
                values: {
                  deleteMany: {},
                  createMany: { data: dateValuesToDBDateRecord(goal.dataSeries.dateValues) },
                },
                unit: goal.dataSeries.unit,
              },
            },
          } : goal.dataSeriesId ? {
            connect: { id: goal.dataSeriesId },
          } : undefined,
          baseline: goal.baseline
            ? {
              disconnect: {},
              create: {
                author: { connect: { id: session.user?.id } },
                recipeUsed: typeof goal.baselineRecipeId === 'string'
                  ? { connect: { id: goal.baselineRecipeId } }
                  : undefined,
                values: { createMany: { data: dateValuesToDBDateRecord(goal.baseline.dateValues) } },
                unit: goal.baseline.unit,
              },
            } : goal.baselineId ? {
              connect: { id: goal.baselineId },
            } : undefined,
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
    revalidateTag('goal', 'max');
    // Return the edited goal's ID if successful
    return Response.json({ message: t('api:goal.goal_updated'), id: goalId },
      { status: 200, headers: { 'Location': `/goal/${goalId}` } },
    );
  } catch (error) {
    console.error(error);
    return Response.json({ message: t('api:common.server_error') },
      { status: 500 },
    );
  }
}

/**
 * Handles DELETE requests to the goal API
 */
export async function DELETE(request: NextRequest) {
  const [session, goal] = await Promise.all([
    getSession(await cookies()),
    request.json() as Promise<JSONValue>,
  ]);
  const t = await serveTea("api");

  // Validate session
  if (!session.user?.id) {
    return Response.json({ message: t('api:common.unauthorized') },
      { status: 401, headers: { 'Location': '/login' } },
    );
  }

  // Validate request body
  if (!goal || !(typeof goal === 'object') || Array.isArray(goal) || typeof goal.id !== 'string' || goal.id.length === 0) {
    return Response.json({ message: t('api:common.missing_input') },
      { status: 400 },
    );
  }

  try {
    const [user, currentGoal] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, username: true, isAdmin: true, userGroups: true },
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
            ],
          }),
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
      if (error.message === ClientError.BadSession) {
        // Remove session to log out. The client should redirect to login page.
        session.destroy();
        return Response.json({ message: ClientError.BadSession },
          { status: 400, headers: { 'Location': '/login' } },
        );
      }
      if (error.message === ClientError.AccessDenied) {
        return Response.json({ message: ClientError.AccessDenied },
          { status: 403 },
        );
      }
    }
    // If no matching error is thrown, log the error and return a generic error message
    console.error(error);
    return Response.json({ message: t('api:common.server_error') },
      { status: 500 },
    );
  }

  // Delete the goal
  try {
    const deletedGoal = await prisma.goal.delete({
      where: {
        id: goal.id,
      },
      select: {
        id: true,
        roadmap: {
          select: {
            id: true,
          },
        },
      },
    });
    // Invalidate old cache
    revalidateTag('goal', 'max');
    return Response.json({ message: t('api:goal.goal_deleted'), id: deletedGoal.id },
      // Redirect to the parent roadmap
      { status: 200, headers: { 'Location': `/roadmap/${deletedGoal.roadmap.id}` } },
    );
  } catch (error) {
    console.error(error);
    return Response.json({ message: t('api:common.server_error') },
      { status: 500 },
    );
  }
}