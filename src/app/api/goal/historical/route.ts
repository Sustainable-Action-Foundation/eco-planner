import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { revalidateTag } from "next/cache";
import { cookies } from "next/headers";
import type { LoginData } from "@/lib/session";
import { getSession } from "@/lib/session";
import accessChecker, { hasEditAccess } from "@/lib/accessChecker";
import { ClientError, isHistoricalDelete, isHistoricalUpdate } from "@/types";
import type { AccessControlled, JSONValue } from "@/types";
import { resolveRecipeExternals, upsertRecipe } from "@/functions/recipe/persistence";
import serveTea from "@/lib/i18nServer";
import type { TFunction } from "i18next";
import type { IronSession } from "iron-session";

/** Selects the roadmap access fields and goal metadata needed to authorize a historical write. */
const goalAccessSelection = {
  updatedAt: true,
  historicalId: true,
  roadmap: {
    select: {
      author: { select: { id: true, username: true } },
      editors: { select: { id: true, username: true } },
      viewers: { select: { id: true, username: true } },
      editGroups: { select: { id: true, name: true, users: { select: { id: true, username: true } } } },
      viewGroups: { select: { id: true, name: true, users: { select: { id: true, username: true } } } },
      isPublic: true,
    },
  },
} as const;

/**
 * Authorizes a historical-data write/clear for the goal in `input`: validates the
 * session, that the goal exists and the user has edit access to its roadmap, and
 * that the provided timestamp is not stale.
 *
 * Returns either an error `Response` to return immediately, or the resolved
 * `authorId` and the goal's current `historicalId`.
 */
async function authorizeHistoricalWrite(
  session: IronSession<LoginData>,
  input: { goalId: string, timestamp: number },
  t: TFunction,
): Promise<{ error: Response } | { authorId: string, historicalId: string | null }> {
  if (!session.user?.id) {
    return {
      error: Response.json({ message: t('api:common.unauthorized') },
        { status: 401, headers: { 'Location': '/login' } },
      ),
    };
  }
  const authorId = session.user.id;

  try {
    const [user, currentGoal] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, username: true, isAdmin: true, userGroups: true },
      }),
      prisma.goal.findUnique({
        where: { id: input.goalId },
        select: goalAccessSelection,
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
    const access = accessChecker(currentGoal.roadmap as AccessControlled, session.user);
    if (!hasEditAccess(access)) {
      throw new Error(ClientError.AccessDenied, { cause: 'goal' });
    }

    // If the provided timestamp is not up-to-date, return StaleData
    if (!input.timestamp || currentGoal.updatedAt.getTime() > input.timestamp) {
      throw new Error(ClientError.StaleData, { cause: 'goal' });
    }

    return { authorId, historicalId: currentGoal.historicalId };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === ClientError.BadSession) {
        // Remove session to log out. The client should redirect to login page.
        session.destroy();
        return {
          error: Response.json({ message: ClientError.BadSession },
            { status: 400, headers: { 'Location': '/login' } },
          ),
        };
      }
      if (error.message === ClientError.StaleData) {
        return { error: Response.json({ message: ClientError.StaleData }, { status: 409 }) };
      }
      if (error.message === ClientError.AccessDenied) {
        return { error: Response.json({ message: ClientError.AccessDenied }, { status: 403 }) };
      }
    }
    console.error(error);
    return { error: Response.json({ message: t('api:common.server_error') }, { status: 500 }) };
  }
}

/**
 * Writes (creates or updates) a goal's historical data.
 *
 * The body's `historicalRecipe` carries the external API selection; its single
 * external variable is fetched into a `DataSeries` which becomes the goal's
 * `historical`. The recipe is linked to that series so the selection stays
 * editable. This replaces the previous practice of routing historical writes
 * through the full goal `PUT` handler.
 */
export async function PUT(request: NextRequest) {
  const [session, body] = await Promise.all([
    getSession(await cookies()),
    request.json() as Promise<JSONValue>,
  ]);
  const t = await serveTea("api");

  if (!isHistoricalUpdate(body)) {
    return Response.json({ message: t('api:common.invalid_request_body') }, { status: 400 });
  }

  const auth = await authorizeHistoricalWrite(session, body, t);
  if ("error" in auth) return auth.error;
  const { authorId, historicalId } = auth;

  // Fetch external variable data before opening the transaction, since fetching
  // performs network calls. It is persisted as a DataSeries when the recipe is saved below.
  let historicalExternals;
  try {
    historicalExternals = await resolveRecipeExternals(body.historicalRecipe, body.historicalRecipeId);
  } catch (error) {
    console.error(error);
    return Response.json({ message: t('api:common.server_error') }, { status: 500 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      const historicalResult = await upsertRecipe(tx, authorId, "historical", {
        recipe: body.historicalRecipe, recipeId: body.historicalRecipeId, resolved: historicalExternals,
      });
      // The historical recipe's single external variable becomes the goal's historical DataSeries
      const resolvedHistoricalId = Object.values(historicalResult.dataSeriesIdsByVariable)[0] ?? null;
      const historicalDataSeriesId = resolvedHistoricalId ?? historicalId ?? null;

      // Link the historical recipe to its resulting series so the source stays discoverable
      if (resolvedHistoricalId && typeof historicalResult.recipeId === 'string') {
        await tx.dataSeries.update({
          where: { id: resolvedHistoricalId },
          data: { recipeUsed: { connect: { id: historicalResult.recipeId } } },
        });
      }

      await tx.goal.update({
        where: { id: body.goalId },
        data: {
          historical: historicalDataSeriesId
            ? { connect: { id: historicalDataSeriesId } }
            : { disconnect: true },
        },
      });
    });

    revalidateTag('goal', { expire: 0 });
    return Response.json({ message: t('api:goal.historical_saved'), id: body.goalId }, { status: 200 });
  }
  catch (err) {
    console.error("Error PUT of historical data", err);
    return Response.json({ message: t('api:common.server_error') }, { status: 500 });
  }
}

/**
 * Clears a goal's historical data by disconnecting the `historical` DataSeries.
 */
export async function DELETE(request: NextRequest) {
  const [session, body] = await Promise.all([
    getSession(await cookies()),
    request.json() as Promise<JSONValue>,
  ]);
  const t = await serveTea("api");

  if (!isHistoricalDelete(body)) {
    return Response.json({ message: t('api:common.invalid_request_body') }, { status: 400 });
  }

  const auth = await authorizeHistoricalWrite(session, body, t);
  if ("error" in auth) return auth.error;

  try {
    await prisma.goal.update({
      where: { id: body.goalId },
      data: { historical: { disconnect: true } },
    });

    revalidateTag('goal', { expire: 0 });
    return Response.json({ message: t('api:goal.historical_deleted'), id: body.goalId }, { status: 200 });
  }
  catch (error) {
    console.error(error);
    return Response.json({ message: t('api:common.server_error') }, { status: 500 });
  }
}
