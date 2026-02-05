import clientSafeGetOneDataSeries from "@/fetchers/clientSafeGetOneDataSeries";
import getOneGoal from "@/fetchers/getOneGoal";
import getOneRecipe from "@/fetchers/getOneRecipe";
import { dateValuesToDBDateRecord } from "@/functions/recipe/extractors";
import { SmartRecipe } from "@/functions/recipe/smartRecipe";
import { RecipeError } from "@/functions/recipe/types";
import accessChecker, { hasEditAccess } from "@/lib/accessChecker";
import { getSession } from "@/lib/session";
import prisma from "@/prismaClient";
import { AccessControlled, ClientError, isDateValues } from "@/types";
import { revalidateTag } from "next/cache";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const [session, requestJson] = await Promise.all([
    getSession(await cookies()),
    (request.json() as Promise<{ dataSeriesId: string }>).catch(() => null),
  ]);

  // Validate request
  if (!requestJson || !requestJson.dataSeriesId) {
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
    // Get user and goal
    const [user, dataSeries] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, username: true, isAdmin: true, userGroups: true }
      }),
      
    ]);

    // If no user is found or the found user falsely claims to be an admin, they have a bad session cookie and should be logged out
    if (!user || (session.user.isAdmin && !user.isAdmin)) {
      throw new Error(ClientError.BadSession, { cause: 'goal' });
    }

    // If no goal is found or if user does not have access, return 403
    // It's fine if the user doesn't have access to the related goals, since a user with access to them created this goal in the first place.
    if (!goal) {
      throw new Error(ClientError.AccessDenied)
    }
    const accessFields: AccessControlled = {
      author: goal.roadmap.author,
      editors: goal.roadmap.editors,
      viewers: goal.roadmap.viewers,
      editGroups: goal.roadmap.editGroups,
      viewGroups: goal.roadmap.viewGroups,
      isPublic: goal.roadmap.isPublic,
    };
    const accessLevel = accessChecker(accessFields, session.user);
    if (!hasEditAccess(accessLevel)) {
      throw new Error(ClientError.AccessDenied)
    }

    // Nothing beside the recipe has the information needed to recalculate the goal's data series now after the great recipe implementation.
    if (!goal.dataSeries?.recipeUsedId) {
      return Response.json({ message: "Data series has no recipe to recalculate from" },
        { status: 400 }
      );
    }

    // Fetch recipe
    const dbRecipe = await getOneRecipe(goal.dataSeries.recipeUsedId);
    if (!dbRecipe) {
      return Response.json({ message: "Recipe was not found." },
        { status: 404 }
      );
    }

    // Try to recalculate the data series
    const recipe = SmartRecipe.fromObject(dbRecipe.recipe);
    const warnings: string[] = [];
    const evaluationResult = await recipe.evaluate(warnings)
      .catch((e) => {
        console.log(`Error evaluating recipe ${dbRecipe.id} for data series ${requestJson.dataSeriesId}:`, e);
        if (e instanceof Error) {
          throw new RecipeError(`Failed to evaluate recipe: ${e.message}`);
        }
        else {
          throw new RecipeError('Failed to evaluate recipe due to an unknown error.');
        }
      });

    if (!evaluationResult) {
      return Response.json({ message: "Recipe evaluation failed." },
        { status: 500 }
      );
    }

    if (!evaluationResult.dateValues) {
      return Response.json({ message: "Recipe evaluation did not return any data." },
        { status: 500 }
      );
    }

    if (warnings.length > 0) {
      // If there are warnings, log them
      console.warn(`Recalculate data series ${requestJson.dataSeriesId} with recipe "${recipe.name}" (${dbRecipe.id}) (${JSON.stringify(recipe)})\nproduced warnings:\n${warnings.join('\n')}`);
    }

    if (!isDateValues(evaluationResult.dateValues)) {
      return Response.json({ message: "Failed to update data series. The recipe used may have caused the issue." },
        { status: 500 }
      );
    };

    const updatedDataSeries = await prisma.dataSeries.update({
      where: { id: requestJson.dataSeriesId },
      data: {
        values: { createMany: { data: dateValuesToDBDateRecord(evaluationResult.dateValues), }, },
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
    revalidateTag('dataSeries');
    return Response.json({ message: "Data series updated", id: updatedDataSeries.id },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.message == ClientError.BadSession) {
        // Remove session to log out. The client should redirect to login page.
        session.destroy();
        return Response.json({ message: ClientError.BadSession },
          { status: 400, headers: { 'Location': '/login' } }
        );
      } else if (error.message == ClientError.AccessDenied) {
        return Response.json({ message: ClientError.AccessDenied },
          { status: 403 }
        );
      } else if (error instanceof RecipeError) {
        return Response.json({ message: error.message },
          { status: 500 }
        );
      }
    }
    console.log(error);
    return Response.json({ message: "Internal server error" },
      { status: 500 }
    );
  }
}