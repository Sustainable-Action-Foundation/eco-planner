import { NextRequest } from "next/server";
import prisma from "@/prismaClient";
import { revalidateTag } from "next/cache";
import { cookies } from "next/headers";
import { getSession } from "@/lib/session";
import accessChecker, { hasEditAccess } from "@/lib/accessChecker";
import { AccessControlled, ClientError, GoalCreateInput, GoalUpdateInput, JSONValue, DataSeriesValueFields, isPartialDataSeriesValueFields, isFullDataSeriesValueFields } from "@/types";
import { goalInclusionSelection } from "@/fetchers/inclusionSelectors";
import { Prisma } from "@prisma/client";
import crypto from 'crypto';
import dataSeriesPrep from "./dataSeriesPrep";
import pruneOrphans from "@/functions/pruneOrphans";
import { cleanRecipe, evaluateRecipe } from "@/functions/parseRecipe";

// Type guards
function isGoalCreate(goal: JSONValue): goal is GoalCreateInput {
  return (
    (
      typeof goal === "object" &&
      goal !== null &&
      !Array.isArray(goal)
    ) &&

    // name: string | null | undefined;
    (
      typeof goal.name === 'string' ||
      goal.name === null ||
      goal.description === undefined
    ) &&

    // description: string | null | undefined;
    (
      typeof goal.description === 'string' ||
      goal.description === null ||
      goal.description === undefined
    ) &&

    // indicatorParameter: string;
    (
      typeof goal.indicatorParameter === 'string'
    ) &&

    // isFeatured: boolean | undefined;
    (
      typeof goal.isFeatured === 'boolean' ||
      goal.isFeatured === undefined
    ) &&

    // externalDataset: string | null | undefined;
    (
      typeof goal.externalDataset === 'string' ||
      goal.externalDataset === undefined ||
      goal.externalDataset === null
    ) &&

    // externalTableId: string | null | undefined;
    (
      typeof goal.externalTableId === 'string' ||
      goal.externalTableId === undefined ||
      goal.externalTableId === null
    ) &&

    // externalSelection: string | null | undefined;
    (
      typeof goal.externalSelection === 'string' ||
      goal.externalSelection === undefined ||
      goal.externalSelection === null
    ) &&

    // recipeUsed: Recipe | null | undefined;
    (
      typeof goal.recipe === 'string' ||
      goal.recipe === undefined ||
      goal.recipe === null
    ) &&

    // rawDataSeries: DataSeriesValueFields | string[] | undefined;
    (
      goal.rawDataSeries === undefined ||
      isPartialDataSeriesValueFields(goal.rawDataSeries) ||
      (
        Array.isArray(goal.rawDataSeries) &&
        goal.rawDataSeries.every((entry: JSONValue) => (
          typeof entry === 'string'
        ))
      )
    ) &&

    // rawDataSeriesUnit: string | null | undefined;
    (
      typeof goal.rawDataSeriesUnit === 'string' ||
      goal.rawDataSeriesUnit === undefined ||
      goal.rawDataSeriesUnit === null
    ) &&

    // rawBaselineDataSeries: DataSeriesValueFields | string[] | undefined;
    (
      goal.rawBaselineDataSeries === undefined ||
      isPartialDataSeriesValueFields(goal.rawBaselineDataSeries) ||
      (
        Array.isArray(goal.rawBaselineDataSeries) &&
        goal.rawBaselineDataSeries.every((entry: JSONValue) => (
          typeof entry === 'string'
        ))
      )
    ) &&

    // rawBaselineDataSeriesUnit: string | null | undefined;
    (
      typeof goal.rawBaselineDataSeriesUnit === 'string' ||
      goal.rawBaselineDataSeriesUnit === undefined ||
      goal.rawBaselineDataSeriesUnit === null
    ) &&

    // roadmapId: string;
    (
      typeof goal.roadmapId === 'string'
    ) &&

    // rawTags: string[] | null | undefined;
    (
      goal.rawTags === undefined ||
      goal.rawTags === null ||
      (
        Array.isArray(goal.rawTags) &&
        goal.rawTags.every((entry: JSONValue) => (
          typeof entry === 'string'
        ))
      )
    ) &&

    // TODO: Deprecated - will be moved to description
    // links: { url: string, description?: string | null }[] | null | undefined;
    (
      goal.links === undefined ||
      goal.links === null ||
      (
        Array.isArray(goal.links) &&
        goal.links.every((entry: JSONValue) => (
          (
            typeof entry === 'object' &&
            entry !== null &&
            !Array.isArray(entry)
          ) &&

          typeof entry.url === 'string' &&
          (
            typeof entry.description === 'string' ||
            entry.description === undefined ||
            entry.description === null
          )
        ))
      )
    )
  );
}

function isGoalUpdate(goal: JSONValue): goal is GoalUpdateInput {
  return (
    (
      typeof goal === "object" &&
      goal !== null &&
      !Array.isArray(goal)
    ) &&

    // goalId: string;
    (
      typeof goal.goalId === 'string'
    ) &&

    // timestamp: number;
    (
      typeof goal.timestamp === 'number'
    ) &&

    // name: string | null | undefined;
    (
      typeof goal.name === 'string' ||
      goal.name === null ||
      goal.description === undefined
    ) &&

    // description: string | null | undefined;
    (
      typeof goal.description === 'string' ||
      goal.description === null ||
      goal.description === undefined
    ) &&

    // indicatorParameter: string | undefined;
    (
      typeof goal.indicatorParameter === 'string' ||
      goal.indicatorParameter === undefined
    ) &&

    // isFeatured: boolean | undefined;
    (
      typeof goal.isFeatured === 'boolean' ||
      goal.isFeatured === undefined
    ) &&

    // externalDataset: string | null | undefined;
    (
      typeof goal.externalDataset === 'string' ||
      goal.externalDataset === undefined ||
      goal.externalDataset === null
    ) &&

    // externalTableId: string | null | undefined;
    (
      typeof goal.externalTableId === 'string' ||
      goal.externalTableId === undefined ||
      goal.externalTableId === null
    ) &&

    // externalSelection: string | null | undefined;
    (
      typeof goal.externalSelection === 'string' ||
      goal.externalSelection === undefined ||
      goal.externalSelection === null
    ) &&

    // recipeUsed: Recipe | null | undefined;
    (
      typeof goal.recipe === 'string' ||
      goal.recipe === undefined ||
      goal.recipe === null
    ) &&

    // rawDataSeries: DataSeriesValueFields | string[] | undefined;
    (
      goal.rawDataSeries === undefined ||
      isPartialDataSeriesValueFields(goal.rawDataSeries) ||
      (
        Array.isArray(goal.rawDataSeries) &&
        goal.rawDataSeries.every((entry: JSONValue) => (
          typeof entry === 'string'
        ))
      )
    ) &&

    // rawDataSeriesUnit: string | null | undefined;
    (
      typeof goal.rawDataSeriesUnit === 'string' ||
      goal.rawDataSeriesUnit === undefined ||
      goal.rawDataSeriesUnit === null
    ) &&

    // rawBaselineDataSeries: DataSeriesValueFields | string[] | undefined;
    (
      goal.rawBaselineDataSeries === undefined ||
      isPartialDataSeriesValueFields(goal.rawBaselineDataSeries) ||
      (
        Array.isArray(goal.rawBaselineDataSeries) &&
        goal.rawBaselineDataSeries.every((entry: JSONValue) => (
          typeof entry === 'string'
        ))
      )
    ) &&

    // rawBaselineDataSeriesUnit: string | null | undefined;
    (
      typeof goal.rawBaselineDataSeriesUnit === 'string' ||
      goal.rawBaselineDataSeriesUnit === undefined ||
      goal.rawBaselineDataSeriesUnit === null
    ) &&

    // roadmapId?: never;
    (
      goal.roadmapId === undefined
    ) &&

    // rawTags: string[] | null | undefined;
    (
      goal.rawTags === undefined ||
      goal.rawTags === null ||
      (
        Array.isArray(goal.rawTags) &&
        goal.rawTags.every((entry: JSONValue) => (
          typeof entry === 'string'
        ))
      )
    ) &&

    // TODO: Deprecated - will be moved to description
    // links: { url: string, description?: string | null }[] | null | undefined;
    (
      goal.links === undefined ||
      goal.links === null ||
      (
        Array.isArray(goal.links) &&
        goal.links.every((entry: JSONValue) => (
          (
            typeof entry === 'object' &&
            entry !== null &&
            !Array.isArray(entry)
          ) &&

          typeof entry.url === 'string' &&
          (
            typeof entry.description === 'string' ||
            entry.description === undefined ||
            entry.description === null
          )
        ))
      )
    )

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
    // Data series parsing
    let parsedDataSeries: Partial<DataSeriesValueFields> | undefined | null = undefined;
    let parsedDataSeriesUnit: string | null = null;
    if (formData.recipeUsed) {
      // TODO: If the recipe is invalid, return an error UNLESS explicitly marked as incomplete somehow (needs to be added to form and here), in which case dataValues should be set to undefined

      const warnings: string[] = [];
      const resolvedRecipe = await evaluateRecipe(cleanRecipe(formData.recipeUsed), warnings);
      if (!resolvedRecipe) {
        return Response.json({ message: 'Recipe evaluation canceled' }, { status: 400 }); // TODO: canceled eval indicates a bad recipe so therefor I think 400 is appropriate but I'm not sure
      }
      const { dataSeries, unit } = resolvedRecipe;

      if (warnings.length) {
        console.warn("Warnings while evaluating recipe for new goal:");
        for (const warning of warnings) {
          console.warn(warning);
        }
      }

      parsedDataSeries = dataSeries;
      parsedDataSeriesUnit = unit !== undefined ? unit : '';
    }
    // TODO: DEPRECATE - raw data series should be made into data series before posting to the API and use 1:1 recipes instead 
    else if (formData.rawDataSeries) {
      parsedDataSeries = dataSeriesPrep(formData.rawDataSeries);
      parsedDataSeriesUnit = formData.rawDataSeriesUnit !== undefined ? formData.rawDataSeriesUnit : '';
    }

    // Non full data series is an error
    if (parsedDataSeries && !isFullDataSeriesValueFields(parsedDataSeries)) {
      parsedDataSeries = null;
    }

    // If the data series is invalid, return an error
    if (parsedDataSeries === null) {
      return Response.json({ message: 'Bad data series' },
        { status: 400 }
      );
    }

    // Baseline data series parsing
    let parsedBaselineDataSeries: Partial<DataSeriesValueFields> | undefined | null = undefined;
    let parsedBaselineDataSeriesUnit: string | null = null;
    if (formData.rawBaselineDataSeries) {
      parsedBaselineDataSeries = dataSeriesPrep(formData.rawBaselineDataSeries);
    }

    // Non full data series is an error
    if (parsedBaselineDataSeries && !isFullDataSeriesValueFields(parsedBaselineDataSeries)) {
      parsedBaselineDataSeries = null;
    }

    // If the baseline data series is invalid, return an error
    if (parsedBaselineDataSeries === null) {
      return Response.json({ message: 'Bad baseline data series' },
        { status: 400 }
      );
    }

    // TODO: formData.rawBaselineDataSeriesUnit may never be set or read from the form. Is it even settable in the form?
    // If null, set to null
    if (formData.rawBaselineDataSeriesUnit === null) {
      parsedBaselineDataSeriesUnit = null;
    }
    // If a non empty string is provided, use it
    else if (typeof formData.rawBaselineDataSeriesUnit === 'string' && formData.rawBaselineDataSeriesUnit.trim().length) {
      parsedBaselineDataSeriesUnit = formData.rawBaselineDataSeriesUnit.trim();
    }
    // Fall back to data series unit no matter its value
    else {
      parsedBaselineDataSeriesUnit = parsedDataSeriesUnit;
    }

    const recipeHash = formData.recipeUsed ? crypto.createHash('sha256').update(JSON.stringify(formData.recipeUsed)).digest('hex') : undefined;

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
        dataSeries: parsedDataSeries ? {
          create: {
            ...parsedDataSeries,
            unit: parsedDataSeriesUnit,
            authorId: session.user.id,
          },
        } : undefined,
        baselineDataSeries: parsedBaselineDataSeries ? {
          create: {
            ...parsedBaselineDataSeries,
            unit: parsedBaselineDataSeriesUnit,
            authorId: session.user.id,
          }
        } : undefined,
        recipeUsed: formData.recipeUsed ? {
          create: {
            hash: recipeHash as string,
            recipe: formData.recipeUsed,
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
    // Data series parsing
    let parsedDataSeries: Partial<DataSeriesValueFields> | undefined | null = undefined;
    let parsedDataSeriesUnit: string | null = null;
    if (goal.recipeUsed) {
      // TODO: If the recipe is invalid, return an error UNLESS explicitly marked as incomplete somehow (needs to be added to form and here), in which case dataValues should be set to undefined

      const warnings: string[] = [];
      const resolvedRecipe = await evaluateRecipe(cleanRecipe(goal.recipeUsed), warnings);
      if (!resolvedRecipe) {
        return Response.json({ message: 'Recipe evaluation canceled' }, { status: 400 }); // TODO: canceled eval indicates a bad recipe so therefor I think 400 is appropriate but I'm not sure
      }

      const { dataSeries, unit } = resolvedRecipe;

      if (warnings.length) {
        console.warn("Warnings while evaluating recipe for new goal:");
        for (const warning of warnings) {
          console.warn(warning);
        }
      }

      parsedDataSeries = dataSeries;
      parsedDataSeriesUnit = unit !== undefined ? unit : '';
    }
    // TODO: DEPRECATE - raw data series should be made into data series before posting to the API and use 1:1 recipes instead 
    else if (goal.rawDataSeries) {
      parsedDataSeries = dataSeriesPrep(goal.rawDataSeries);
      parsedDataSeriesUnit = goal.rawDataSeriesUnit !== undefined ? goal.rawDataSeriesUnit : '';
    }

    // Non full data series is an error
    if (parsedDataSeries && !isFullDataSeriesValueFields(parsedDataSeries)) {
      parsedDataSeries = null;
    }

    // If the data series is invalid, return an error
    if (parsedDataSeries === null) {
      return Response.json({ message: 'Bad data series' },
        { status: 400 }
      );
    }

    // Baseline data series parsing
    const shouldRemoveBaseline = goal.rawBaselineDataSeries === null;
    let parsedBaselineDataSeries: Partial<DataSeriesValueFields> | undefined | null = undefined;
    let parsedBaselineDataSeriesUnit: string | null = null;

    if (shouldRemoveBaseline) {
      parsedBaselineDataSeries = null;
    }
    // Calculate new baseline
    else {
      if (goal.rawBaselineDataSeries) {
        parsedBaselineDataSeries = dataSeriesPrep(goal.rawBaselineDataSeries);
      }

      // Non full data series is an error
      if (parsedBaselineDataSeries && !isFullDataSeriesValueFields(parsedBaselineDataSeries)) {
        parsedBaselineDataSeries = null;
      }
      // Note: May be null to indicate deletion of baseline

      // TODO: formData.rawBaselineDataSeriesUnit may never be set or read from the form. Is it even settable in the form?
      // If null, set to null
      if (goal.rawBaselineDataSeriesUnit === null) {
        parsedBaselineDataSeriesUnit = null;
      }
      // If a non empty string is provided, use it
      else if (typeof goal.rawBaselineDataSeriesUnit === 'string' && goal.rawBaselineDataSeriesUnit.trim().length) {
        parsedBaselineDataSeriesUnit = goal.rawBaselineDataSeriesUnit.trim();
      }
      // Fall back to data series unit no matter its value
      else {
        parsedBaselineDataSeriesUnit = parsedDataSeriesUnit;
      }

      if (parsedBaselineDataSeries === null) {
        return Response.json({ message: 'Bad baseline data series' },
          { status: 400 }
        );
      }
    }

    const recipeHash = goal.recipeUsed ? crypto.createHash('sha256').update(JSON.stringify(goal.recipeUsed)).digest('hex') : undefined;

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
        ...(
          parsedDataSeries === undefined ? {} : parsedDataSeries ? {
            dataSeries: {
              upsert: {
                create: {
                  ...parsedDataSeries,
                  unit: parsedDataSeriesUnit,
                  authorId: session.user.id,
                },
                update: {
                  ...parsedDataSeries,
                  unit: parsedDataSeriesUnit,
                }
              }
            }
          } : {}
        ),
        ...(
          parsedBaselineDataSeries === undefined ? {} : shouldRemoveBaseline ? {
            // Remove baseline case
            baselineDataSeries: {
              delete: true,
            }
          } : {
            // Updated baseline case
            baselineDataSeries: {
              upsert: {
                create: {
                  ...parsedBaselineDataSeries,
                  unit: parsedBaselineDataSeriesUnit,
                  authorId: session.user.id,
                },
                update: {
                  ...parsedBaselineDataSeries,
                  unit: parsedBaselineDataSeriesUnit,
                }
              }
            }
          }
        ),
        // Connect, disconnect, or create recipe
        ...(goal.recipeUsed ? {
          recipeUsed: {
            connectOrCreate: {
              where: {
                hash: recipeHash as string,
              },
              create: {
                hash: recipeHash as string,
                recipe: goal.recipeUsed,
              }
            }
          }
        } : goal.recipeUsed === null ? {
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