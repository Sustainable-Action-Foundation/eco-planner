import { getOneRecipe } from "@/fetchers";
import { clientSafeGetOneDataSeries } from "@/fetchers/client";
import { getAccessContextById } from "@/fetchers/getUserAccessContext";
import { dateValuesToDBDateRecord } from "@/functions/recipe/vectorAndMaskUtils";
import { Recipe } from "@/functions/recipe/recipe";
import { RecipeError } from "@/functions/recipe/types/errors";
import { editableDataSeriesWHERE } from "@/lib/accessFilters";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { UnitFlags } from "@/types/enums";
import { ClientError } from "@/types/consts";
import { isDateValues } from "@/types/typeguards";
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
    const accessContext = await getAccessContextById(session.user.id);

    // If no user is found or the found user falsely claims to be a super admin, they have a bad session cookie and should be logged out
    if (!accessContext || (session.user.isSuperAdmin && !accessContext.isSuperAdmin)) {
      throw new Error(ClientError.BadSession, { cause: 'goal' });
    }

    // Get the data series, requiring edit access via any of its dependent slots
    const dataSeries = await prisma.dataSeries.findUnique({
      where: {
        id: requestJson.dataSeriesId,
        AND: [editableDataSeriesWHERE(accessContext)],
      },
      select: {
        id: true,
        recipe_used_id: true,
      },
    });

    // Also covers series that don't exist at all
    if (!dataSeries) {
      throw new Error(ClientError.AccessDenied);
    }

    // Fetch recipe
    const dbRecipe = await getOneRecipe(dataSeries.recipe_used_id);
    if (!dbRecipe) {
      return Response.json({ message: "Recipe was not found." },
        { status: 404 },
      );
    }

    // Try to recalculate the data series
    const recipe = Recipe.from(dbRecipe.recipe);
    const warnings: string[] = [];
    const evaluationResult = await recipe.evaluate(warnings, { dataSeriesGetter: clientSafeGetOneDataSeries })
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
        // Unitless -> remove unit
        // Missing -> omit (keep current unit)
        // real unit -> update unit
        ...(evaluationResult.unit === UnitFlags.Unitless
          ? { unit: null }
          : evaluationResult.unit === UnitFlags.Missing
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
  }
  catch (err) {
    if (err instanceof Error) {
      if (err.message === ClientError.BadSession) {
        // Remove session to log out. The client should redirect to login page.
        session.destroy();
        return Response.json({ message: ClientError.BadSession },
          { status: 400, headers: { 'Location': '/login' } },
        );
      } else if (err.message === ClientError.AccessDenied) {
        return Response.json({ message: ClientError.AccessDenied },
          { status: 403 },
        );
      } else if (err instanceof RecipeError) {
        return Response.json({ message: err.message },
          { status: 500 },
        );
      }
    }
    console.error(err);
    return Response.json({ message: "Internal server error" },
      { status: 500 },
    );
  }
}