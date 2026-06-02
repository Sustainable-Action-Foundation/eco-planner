import { getOneRecipe } from "@/fetchers";
import { dateValuesToDBDateRecord } from "@/functions/recipe/vectorAndMaskUtils";
import { Recipe } from "@/functions/recipe/recipe";
import { RecipeError } from "@/functions/recipe/types";
import accessChecker, { hasEditAccess } from "@/lib/accessChecker";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ClientError, isDateValues } from "@/types";
import { revalidateTag } from "next/cache";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const [session, requestJson] = await Promise.all([
    getSession(await cookies()),
    (request.json() as Promise<{ dataSeriesId: string }>).catch(() => null),
  ]);

  // Validate request
  if (!requestJson?.dataSeriesId) {
    return Response.json({ message: 'Missing required input parameters' },
      { status: 400 },
    );
  }

  // Validate session
  if (!session.user?.id) {
    return Response.json({ message: 'Unauthorized' },
      { status: 401, headers: { 'Location': '/login' } },
    );
  }

  try {
    const roadmapAccessSelect = {
      author: { select: { id: true, username: true } },
      editors: { select: { id: true, username: true } },
      viewers: { select: { id: true, username: true } },
      editGroups: { include: { users: { select: { id: true, username: true } } } },
      viewGroups: { include: { users: { select: { id: true, username: true } } } },
      isPublic: true,
    };

    // Get user and data series
    const [user, dataSeries] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, username: true, isAdmin: true, userGroups: true },
      }),
      prisma.dataSeries.findUnique({
        where: { id: requestJson.dataSeriesId },
        select: {
          id: true,
          authorId: true,
          recipeUsedId: true,
          dependentGoals: {
            select: {
              roadmap: { select: roadmapAccessSelect },
            },
          },
          dependentBaselines: {
            select: {
              roadmap: { select: roadmapAccessSelect },
            },
          },
          dependentEffects: {
            select: {
              action: { select: { roadmap: { select: roadmapAccessSelect } } },
              goal: { select: { roadmap: { select: roadmapAccessSelect } } },
            },
          },
        },
      }),
    ]);

    // If no user is found or the found user falsely claims to be an admin, they have a bad session cookie and should be logged out
    if (!user || (session.user.isAdmin && !user.isAdmin)) {
      throw new Error(ClientError.BadSession, { cause: 'goal' });
    }

    if (!dataSeries) {
      throw new Error(ClientError.AccessDenied);
    }

    const hasEditRoadmapAccess = (roadmap: typeof dataSeries.dependentGoals[number]['roadmap']) => {
      const accessLevel = accessChecker(roadmap, session.user);
      return hasEditAccess(accessLevel);
    };

    const hasEditAccessToDataSeries =
      user.isAdmin ||
      dataSeries.authorId === user.id ||
      dataSeries.dependentGoals.some((goal) => hasEditRoadmapAccess(goal.roadmap)) ||
      dataSeries.dependentBaselines.some((goal) => hasEditRoadmapAccess(goal.roadmap)) ||
      dataSeries.dependentEffects.some((effect) =>
        hasEditRoadmapAccess(effect.action.roadmap) && hasEditRoadmapAccess(effect.goal.roadmap),
      );

    if (!hasEditAccessToDataSeries) {
      throw new Error(ClientError.AccessDenied);
    }

    // Nothing beside the recipe has the information needed to recalculate the goal's data series now after the great recipe implementation.
    if (!dataSeries.recipeUsedId) {
      return Response.json({ message: "Data series has no recipe to recalculate from" },
        { status: 400 },
      );
    }

    // Fetch recipe
    const dbRecipe = await getOneRecipe(dataSeries.recipeUsedId);
    if (!dbRecipe) {
      return Response.json({ message: "Recipe was not found." },
        { status: 404 },
      );
    }

    // Try to recalculate the data series
    const recipe = Recipe.from(dbRecipe.recipe);
    const warnings: string[] = [];
    const evaluationResult = await recipe.evaluate(warnings)
      .catch((err: unknown) => {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error(`Error evaluating recipe ${dbRecipe.id} for data series ${requestJson.dataSeriesId}:`, { err });
        if (err instanceof Error) {
          throw new RecipeError(`Failed to evaluate recipe: ${errorMessage}`);
        }
        else {
          throw new RecipeError('Failed to evaluate recipe due to an unknown error.');
        }
      });

    if (!evaluationResult) {
      return Response.json({ message: "Recipe evaluation failed." },
        { status: 500 },
      );
    }

    if (!evaluationResult.dateValues) {
      return Response.json({ message: "Recipe evaluation did not return any data." },
        { status: 500 },
      );
    }

    if (warnings.length > 0) {
      // If there are warnings, log them
      console.warn(`Recalculate data series ${requestJson.dataSeriesId} with recipe "${recipe.name}" (${dbRecipe.id}) (${JSON.stringify(recipe)})\nproduced warnings:\n${warnings.join('\n')}`);
    }

    if (!isDateValues(evaluationResult.dateValues)) {
      return Response.json({ message: "Failed to update data series. The recipe used may have caused the issue." },
        { status: 500 },
      );
    };

    const updatedDataSeries = await prisma.dataSeries.update({
      where: { id: requestJson.dataSeriesId },
      data: {
        values: { createMany: { data: dateValuesToDBDateRecord(evaluationResult.dateValues) } },
        // Unit === null -> remove unit
        // Unit === undefined -> omit (keep current unit)
        // Unit === string -> update unit
        ...(evaluationResult.unit === null
          ? { unit: null }
          : typeof evaluationResult.unit === "undefined"
            ? {}
            : { unit: evaluationResult.unit }
        ),
      },
    });

    // Invalidate old cache
    revalidateTag('dataSeries', 'max');
    return Response.json({ message: "Data series updated", id: updatedDataSeries.id },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === ClientError.BadSession) {
        // Remove session to log out. The client should redirect to login page.
        session.destroy();
        return Response.json({ message: ClientError.BadSession },
          { status: 400, headers: { 'Location': '/login' } },
        );
      } else if (error.message === ClientError.AccessDenied) {
        return Response.json({ message: ClientError.AccessDenied },
          { status: 403 },
        );
      } else if (error instanceof RecipeError) {
        return Response.json({ message: error.message },
          { status: 500 },
        );
      }
    }
    console.error(error);
    return Response.json({ message: "Internal server error" },
      { status: 500 },
    );
  }
}