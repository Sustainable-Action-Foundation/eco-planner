import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@PRISMA-NAMESPACE-ONLY";
import { revalidateTag } from "next/cache";
import { cookies } from "next/headers";
import type { AccessControlled, BaselineFields, DataSeriesFields, DateValuesWithUnit, GoalCreateFull, GoalUpdateFull, HistoricalFields, JSONValue, LoginData, RecipeSuggestionsFields } from "@/types";
import { ClientError, GoalDataTarget } from "@/types/enums";
import { isGoalCreate, isGoalUpdate } from "@/types/typeguards";
import { getSession } from "@/lib/session";
import accessChecker, { hasEditAccess } from "@/lib/accessChecker";
import pruneOrphans from "@/functions/pruneOrphans";
import { dateValuesToDBDateRecord } from "@/functions/recipe/vectorAndMaskUtils";
import { resolveRecipeExternals, upsertRecipe } from "@/functions/recipe/persistence";
import type { ResolvedExternals, SerializedRecipe } from "@/functions/recipe";
import type { TFunction } from "i18next";
import serveTea from "@/lib/i18nServer";
import type { IronSession } from "iron-session";

/**
 * Authorizes a write to an existing goal (used by Full update and all sectional
 * create/update branches): validates the session, that the goal exists and the
 * user has edit access to its roadmap, and that the provided timestamp isn't stale.
 * Returns an error `Response` to return immediately, or `{ ok: true }`.
 */
async function authorizeGoalWrite(session: IronSession<LoginData>, goalId: string, timestamp: number, t: TFunction): Promise<{ error: Response } | { ok: true }> {
  if (!session.user?.id) {
    return { error: Response.json({ message: t('api:common.unauthorized') }, { status: 401, headers: { 'Location': '/login' } }) };
  }

  try {
    const [user, currentGoal] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, username: true, isAdmin: true, userGroups: true },
      }),
      prisma.goal.findUnique({
        where: { id: goalId },
        select: {
          updatedAt: true,
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
        },
      }),
    ]);

    // Bad session cookie (no user, or falsely claims admin) -> log out
    if (!user || (session.user.isAdmin && !user.isAdmin)) {
      throw new Error(ClientError.BadSession, { cause: 'goal' });
    }
    // No goal or no access -> AccessDenied
    if (!currentGoal) {
      throw new Error(ClientError.AccessDenied, { cause: 'goal' });
    }
    const access = accessChecker(currentGoal.roadmap as AccessControlled, session.user);
    if (!hasEditAccess(access)) {
      throw new Error(ClientError.AccessDenied, { cause: 'goal' });
    }
    // Stale data check
    if (!timestamp || new Date(currentGoal.updatedAt).getTime() > timestamp) {
      throw new Error(ClientError.StaleData, { cause: 'goal' });
    }

    return { ok: true };
  }
  catch (err) {
    if (err instanceof Error) {
      if (err.message === ClientError.BadSession) {
        session.destroy();
        return { error: Response.json({ message: ClientError.BadSession }, { status: 400, headers: { 'Location': '/login' } }) };
      }
      if (err.message === ClientError.StaleData) {
        return { error: Response.json({ message: ClientError.StaleData }, { status: 409 }) };
      }
      if (err.message === ClientError.AccessDenied) {
        return { error: Response.json({ message: ClientError.AccessDenied }, { status: 403 }) };
      }
    }
    console.error(err);
    return { error: Response.json({ message: t('api:common.server_error') }, { status: 500 }) };
  }
}

/** Resolves a recipe's external variables before a transaction, or null when there's no recipe. */
function resolveSectionExternals(recipe: SerializedRecipe | null | undefined, recipeId: string | null | undefined): Promise<ResolvedExternals | null> {
  return recipe
    ? resolveRecipeExternals(recipe, recipeId)
    : Promise.resolve(null);
}

/**
 * Resolves the external variables of every suggested recipe before a transaction.
 * Suggestions are always created fresh (no existing recipe id), so each is resolved
 * against `null`. The result is index-aligned with `recipes`.
 */
function resolveSuggestionExternals(recipes: SerializedRecipe[] | null | undefined): Promise<ResolvedExternals[]> {
  return Promise.all((recipes ?? []).map(recipe => resolveRecipeExternals(recipe, null)));
}

/** Maps a thrown `ClientError.IllegalParent` to a 403; anything else is logged and returned as a 500. */
function clientErrorResponse(err: unknown, t: TFunction): Response {
  if (err instanceof Error && err.message === ClientError.IllegalParent) {
    return Response.json({ message: ClientError.IllegalParent }, { status: 403 });
  }
  console.error(err);
  return Response.json({ message: t('api:common.server_error') }, { status: 500 });
}

/** Throws `IllegalParent` if a client-supplied DataSeries id doesn't exist, so we connect only to real records. */
async function assertDataSeriesExists(tx: Prisma.TransactionClient, id: string): Promise<void> {
  const found = await tx.dataSeries.findUnique({ where: { id }, select: { id: true } });
  if (!found) throw new Error(ClientError.IllegalParent, { cause: 'goal' });
}

/** Creates a DataSeries row (values + optional unit + optional recipe link) and returns its id. */
async function createDataSeries(tx: Prisma.TransactionClient, authorId: string, data: DateValuesWithUnit, recipeId: string | null | undefined): Promise<string> {
  return (await tx.dataSeries.create({
    data: {
      author: { connect: { id: authorId } },
      recipeUsed: typeof recipeId === 'string' ? { connect: { id: recipeId } } : undefined,
      values: { createMany: { data: dateValuesToDBDateRecord(data.dateValues) } },
      ...(data.unit == null ? {} : { unit: data.unit }),
    },
    select: { id: true },
  })).id;
}

// ── Per-section appliers ─────────────────────────────────────────────────────
// Each applies one section to an existing goal as flat statements within the
// caller's transaction (no nested connect/disconnect). Shared by the sectional
// writers and updateFullGoal. Connects to client-supplied ids are existence-checked.

/** Applies the data series section: updates the goal's series in place, or connects a verified existing one. */
async function applyDataSeriesSection(tx: Prisma.TransactionClient, authorId: string, goalId: string, section: DataSeriesFields, externals: ResolvedExternals | null): Promise<void> {
  const { recipeId } = await upsertRecipe(tx, authorId, "data series", {
    recipe: section.dataSeriesRecipe, recipeId: section.dataSeriesRecipeId, resolved: externals,
  });

  if (section.dataSeries) {
    const { dataSeriesId } = await tx.goal.findUniqueOrThrow({ where: { id: goalId }, select: { dataSeriesId: true } });
    if (dataSeriesId) {
      // Update the goal's existing series in place
      await tx.dataSeries.update({
        where: { id: dataSeriesId },
        data: {
          recipeUsed: recipeId === undefined
            ? undefined
            : typeof recipeId === 'string'
              ? { connect: { id: recipeId } }
              : { disconnect: true },
          values: { deleteMany: {}, createMany: { data: dateValuesToDBDateRecord(section.dataSeries.dateValues) } },
          unit: section.dataSeries.unit,
        },
      });
    } else {
      // Goal has no series yet: create one and connect it
      const id = await createDataSeries(tx, authorId, section.dataSeries, recipeId);
      await tx.goal.update({ where: { id: goalId }, data: { dataSeries: { connect: { id } } } });
    }
  } else if (section.dataSeriesId) {
    await assertDataSeriesExists(tx, section.dataSeriesId);
    await tx.goal.update({ where: { id: goalId }, data: { dataSeries: { connect: { id: section.dataSeriesId } } } });
  }
}

/** Applies the baseline section: a payload becomes a fresh series (disconnect-then-create), else connect a verified id. */
async function applyBaselineSection(tx: Prisma.TransactionClient, authorId: string, goalId: string, section: BaselineFields, externals: ResolvedExternals | null): Promise<void> {
  const { recipeId } = await upsertRecipe(tx, authorId, "baseline", {
    recipe: section.baselineRecipe, recipeId: section.baselineRecipeId, resolved: externals,
  });

  const hasPayload = !!section.baseline && Object.keys(section.baseline.dateValues).length > 0;
  if (hasPayload && section.baseline) {
    // Disconnect first so we create a fresh baseline rather than mutating one that
    // may just be a reference to another goal's data series.
    await tx.goal.update({ where: { id: goalId }, data: { baseline: { disconnect: true } } });
    const id = await createDataSeries(tx, authorId, section.baseline, recipeId);
    await tx.goal.update({ where: { id: goalId }, data: { baseline: { connect: { id } } } });
  } else if (section.baselineId) {
    await assertDataSeriesExists(tx, section.baselineId);
    await tx.goal.update({ where: { id: goalId }, data: { baseline: { connect: { id: section.baselineId } } } });
  }
}

/** Applies the historical section: connects the recipe-materialized series, a payload-created series, or a verified id; else disconnects. */
async function applyHistoricalSection(tx: Prisma.TransactionClient, authorId: string, goalId: string, section: HistoricalFields, externals: ResolvedExternals | null): Promise<void> {
  const result = await upsertRecipe(tx, authorId, "historical", {
    recipe: section.historicalRecipe, recipeId: section.historicalRecipeId, resolved: externals,
  });
  // The historical recipe's single external variable becomes the goal's historical DataSeries
  const resolvedHistoricalId = Object.values(result.dataSeriesIdsByVariable)[0] ?? null;
  // Link the historical recipe to its resulting series so the source stays discoverable
  if (resolvedHistoricalId && typeof result.recipeId === 'string') {
    await tx.dataSeries.update({ where: { id: resolvedHistoricalId }, data: { recipeUsed: { connect: { id: result.recipeId } } } });
  }

  const hasPayload = !!section.historical && Object.keys(section.historical.dateValues).length > 0;
  if (hasPayload && section.historical) {
    await tx.goal.update({ where: { id: goalId }, data: { historical: { disconnect: true } } });
    const id = await createDataSeries(tx, authorId, section.historical, result.recipeId);
    await tx.goal.update({ where: { id: goalId }, data: { historical: { connect: { id } } } });
    return;
  }

  const historicalDataSeriesId = resolvedHistoricalId ?? section.historicalId ?? null;
  if (historicalDataSeriesId) {
    // Verify only client-supplied ids; a recipe-materialized id provably exists.
    if (!resolvedHistoricalId) await assertDataSeriesExists(tx, historicalDataSeriesId);
    await tx.goal.update({ where: { id: goalId }, data: { historical: { connect: { id: historicalDataSeriesId } } } });
  } else {
    await tx.goal.update({ where: { id: goalId }, data: { historical: { disconnect: true } } });
  }
}

/**
 * Applies the recipe-suggestions section: replaces the goal's suggested recipes
 * with a freshly-created set. `undefined` leaves them untouched; `null`/`[]` clears
 * them. Any recipe is accepted (templates are the main use); externals are
 * materialized like any other recipe. Previously-suggested recipes left fully
 * orphaned by the replace are deleted.
 */
async function applyRecipeSuggestionsSection(tx: Prisma.TransactionClient, authorId: string, goalId: string, recipes: SerializedRecipe[] | null | undefined, resolvedList: ResolvedExternals[]): Promise<void> {
  if (recipes === undefined) return; // Field omitted: leave suggestions unchanged.
  const list = recipes ?? [];

  const before = (await tx.goal.findUniqueOrThrow({
    where: { id: goalId },
    select: { recipeSuggestions: { select: { id: true } } },
  })).recipeSuggestions.map(r => r.id);

  // Create each suggested recipe (materializing its externals) and collect the new ids.
  const newIds: string[] = [];
  for (let i = 0; i < list.length; i++) {
    const { recipeId } = await upsertRecipe(tx, authorId, "recipe suggestion", {
      recipe: list[i], recipeId: null, resolved: resolvedList[i] ?? null,
    });
    if (recipeId) newIds.push(recipeId);
  }

  // Point the goal at exactly the new set, disconnecting the old ones.
  await tx.goal.update({ where: { id: goalId }, data: { recipeSuggestions: { set: newIds.map(id => ({ id })) } } });

  // Delete previously-suggested recipes the replace left with no remaining references.
  for (const oldId of before) {
    const counts = (await tx.recipe.findUnique({
      where: { id: oldId },
      select: { _count: { select: { suggestedByGoals: true, derivedDataSeries: true, sourceDataSeries: true } } },
    }))?._count;
    if (counts?.suggestedByGoals === 0 && counts.derivedDataSeries === 0 && counts.sourceDataSeries === 0) {
      await tx.recipe.delete({ where: { id: oldId } });
    }
  }
}

/**
 * ## Per-section writers
 *
 * Shared by sectional POST (create the section) and PUT (replace the section);
 * both apply one section to an already-authorized, existing goal. Each returns
 * the Response to send. Section field shapes come from @type {DataSeriesFields | BaselineFields | HistoricalFields}.
 */

/** Wraps a single-section apply in its own transaction and standard success/error responses. */
async function writeSection(
  goalId: string,
  recipe: SerializedRecipe | null | undefined,
  recipeId: string | null | undefined,
  apply: (tx: Prisma.TransactionClient, externals: ResolvedExternals | null) => Promise<void>,
  t: TFunction,
): Promise<Response> {
  let externals: ResolvedExternals | null;
  try { externals = await resolveSectionExternals(recipe, recipeId); }
  catch (err) { return clientErrorResponse(err, t); }

  try {
    await prisma.$transaction((tx) => apply(tx, externals));
    revalidateTag('goal', { expire: 0 });
    return Response.json({ message: t('api:goal.goal_updated'), id: goalId }, { status: 200, headers: { 'Location': `/goal/${goalId}` } });
  }
  catch (err) { return clientErrorResponse(err, t); }
}

function writeDataSeriesSection(authorId: string, goalId: string, section: DataSeriesFields, t: TFunction): Promise<Response> {
  return writeSection(goalId, section.dataSeriesRecipe, section.dataSeriesRecipeId,
    (tx, externals) => applyDataSeriesSection(tx, authorId, goalId, section, externals), t);
}

function writeBaselineSection(authorId: string, goalId: string, section: BaselineFields, t: TFunction): Promise<Response> {
  return writeSection(goalId, section.baselineRecipe, section.baselineRecipeId,
    (tx, externals) => applyBaselineSection(tx, authorId, goalId, section, externals), t);
}

function writeHistoricalSection(authorId: string, goalId: string, section: HistoricalFields, t: TFunction): Promise<Response> {
  return writeSection(goalId, section.historicalRecipe, section.historicalRecipeId,
    (tx, externals) => applyHistoricalSection(tx, authorId, goalId, section, externals), t);
}

/**
 * Writes the recipe-suggestions section. Unlike the other sections it carries an
 * array of recipes, so it resolves a list of externals (one per recipe) before its
 * own transaction rather than going through {@link writeSection}.
 */
async function writeRecipeSuggestionsSection(authorId: string, goalId: string, section: RecipeSuggestionsFields, t: TFunction): Promise<Response> {
  let resolvedList: ResolvedExternals[];
  try { resolvedList = await resolveSuggestionExternals(section.recipeSuggestions); }
  catch (err) { return clientErrorResponse(err, t); }

  try {
    await prisma.$transaction((tx) => applyRecipeSuggestionsSection(tx, authorId, goalId, section.recipeSuggestions, resolvedList));
    void pruneOrphans();
    revalidateTag('goal', { expire: 0 });
    return Response.json({ message: t('api:goal.goal_updated'), id: goalId }, { status: 200, headers: { 'Location': `/goal/${goalId}` } });
  }
  catch (err) { return clientErrorResponse(err, t); }
}

/**
 * Creates a brand-new goal (Full POST): authorizes against the target roadmap,
 * then creates the goal with all of its sections in one transaction.
 */
async function createFullGoal(session: IronSession<LoginData>, authorId: string, formData: GoalCreateFull, t: TFunction): Promise<Response> {
  // Auth control (access to the parent roadmap)
  try {
    const [user, roadmap] = await Promise.all([
      prisma.user.findUnique({
        where: { id: authorId },
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

    if (!user || (session.user?.isAdmin && !user.isAdmin)) {
      throw new Error(ClientError.BadSession, { cause: 'goal' });
    }
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
    if (!hasEditAccess(accessChecker(accessFields, session.user))) {
      throw new Error(ClientError.IllegalParent, { cause: 'goal' });
    }
    // TODO: Access checks for goals used in recipe
  }
  catch (err) {
    if (err instanceof Error) {
      if (err.message === ClientError.BadSession) {
        session.destroy();
        return Response.json({ message: ClientError.BadSession }, { status: 400, headers: { 'Location': '/login' } });
      }
      if (err.message === ClientError.IllegalParent) {
        return Response.json({ message: ClientError.IllegalParent }, { status: 403 });
      }
    }
    console.error(err);
    return Response.json({ message: t('api:common.server_error') }, { status: 500 });
  }

  let goalId: string | undefined = undefined;

  // Fetch external variable data for all recipes before opening the transaction (network calls).
  let dataSeriesExternals: ResolvedExternals | null = null;
  let baselineExternals: ResolvedExternals | null = null;
  let historicalExternals: ResolvedExternals | null = null;
  let suggestionExternals: ResolvedExternals[] = [];
  try {
    [dataSeriesExternals, baselineExternals, historicalExternals, suggestionExternals] = await Promise.all([
      resolveSectionExternals(formData.dataSeriesRecipe, formData.dataSeriesRecipeId),
      resolveSectionExternals(formData.baselineRecipe, formData.baselineRecipeId),
      resolveSectionExternals(formData.historicalRecipe, formData.historicalRecipeId),
      resolveSuggestionExternals(formData.recipeSuggestions),
    ]);
  }
  catch (err) { console.error(err); return Response.json({ message: t('api:common.server_error') }, { status: 500 }); }

  try {
    await prisma.$transaction(async (tx) => {
      // Create/update recipes first, materializing any external variables into DataSeries.
      // Keep the resulting ids in locals — mutating formData inside the transaction would
      // leak rolled-back ids into any retry of this callback.
      const { recipeId: dataSeriesRecipeId } = await upsertRecipe(tx, authorId, "data series", {
        recipe: formData.dataSeriesRecipe, recipeId: formData.dataSeriesRecipeId, resolved: dataSeriesExternals,
      });
      const { recipeId: baselineRecipeId } = await upsertRecipe(tx, authorId, "baseline", {
        recipe: formData.baselineRecipe, recipeId: formData.baselineRecipeId, resolved: baselineExternals,
      });
      const historicalResult = await upsertRecipe(tx, authorId, "historical", {
        recipe: formData.historicalRecipe, recipeId: formData.historicalRecipeId, resolved: historicalExternals,
      });
      const historicalRecipeId = historicalResult.recipeId;

      // Create each section's DataSeries as its own statement, then connect by id.
      const dataSeriesId = await createDataSeries(tx, authorId, formData.dataSeries, dataSeriesRecipeId);

      let baselineId: string | null = null;
      if (formData.baseline) {
        baselineId = await createDataSeries(tx, authorId, formData.baseline, baselineRecipeId);
      } else if (formData.baselineId) {
        await assertDataSeriesExists(tx, formData.baselineId);
        baselineId = formData.baselineId;
      }

      // The historical recipe's single external variable becomes the goal's historical DataSeries
      const resolvedHistoricalId = Object.values(historicalResult.dataSeriesIdsByVariable)[0] ?? null;
      // Link the historical recipe to its resulting series so the source stays discoverable
      if (resolvedHistoricalId && typeof historicalRecipeId === 'string') {
        await tx.dataSeries.update({
          where: { id: resolvedHistoricalId },
          data: { recipeUsed: { connect: { id: historicalRecipeId } } },
        });
      }

      // Like applyHistoricalSection: a payload becomes a fresh series, else the
      // recipe-materialized series or a verified client-supplied id is connected.
      const hasHistoricalPayload = !!formData.historical && Object.keys(formData.historical.dateValues).length > 0;
      let historicalDataSeriesId: string | null;
      if (hasHistoricalPayload && formData.historical) {
        historicalDataSeriesId = await createDataSeries(tx, authorId, formData.historical, historicalRecipeId);
      } else {
        historicalDataSeriesId = resolvedHistoricalId ?? formData.historicalId ?? null;
        if (historicalDataSeriesId && !resolvedHistoricalId) await assertDataSeriesExists(tx, historicalDataSeriesId);
      }

      // Create goal, connecting the (just-created/verified) section series by id
      const createdId = (await tx.goal.create({
        data: {
          name: formData.name,
          description: formData.description,
          indicatorParameter: formData.indicatorParameter,
          isFeatured: formData.isFeatured,
          author: { connect: { id: authorId } },
          roadmap: { connect: { id: formData.roadmapId } },
          dataSeries: { connect: { id: dataSeriesId } },
          baseline: baselineId ? { connect: { id: baselineId } } : undefined,
          historical: historicalDataSeriesId ? { connect: { id: historicalDataSeriesId } } : undefined,
        },
        select: { id: true },
      })).id;
      goalId = createdId;

      // Create and connect any suggested recipes now that the goal exists.
      await applyRecipeSuggestionsSection(tx, authorId, createdId, formData.recipeSuggestions, suggestionExternals);
    });

    revalidateTag('goal', { expire: 0 });
    return Response.json({ message: t('api:goal.goal_created'), id: goalId },
      { status: 201, headers: { 'Location': `/goal/${goalId}` } },
    );
  }
  catch (err) {
    console.error(err);
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return Response.json({ message: t('api:goal.roadmap_not_found') }, { status: 400 });
    }
    return Response.json({ message: t('api:common.server_error') }, { status: 500 });
  }
}

/**
 * Updates every section of an existing goal at once (Full PUT).
 */
async function updateFullGoal(session: IronSession<LoginData>, authorId: string, goal: GoalUpdateFull, t: TFunction): Promise<Response> {
  const auth = await authorizeGoalWrite(session, goal.goalId, goal.timestamp, t);
  if ("error" in auth) return auth.error;

  let goalId: string | undefined = undefined;

  // Fetch external variable data for all recipes before opening the transaction (network calls).
  let dataSeriesExternals: ResolvedExternals | null = null;
  let baselineExternals: ResolvedExternals | null = null;
  let historicalExternals: ResolvedExternals | null = null;
  let suggestionExternals: ResolvedExternals[] = [];
  try {
    [dataSeriesExternals, baselineExternals, historicalExternals, suggestionExternals] = await Promise.all([
      resolveSectionExternals(goal.dataSeriesRecipe, goal.dataSeriesRecipeId),
      resolveSectionExternals(goal.baselineRecipe, goal.baselineRecipeId),
      resolveSectionExternals(goal.historicalRecipe, goal.historicalRecipeId),
      resolveSuggestionExternals(goal.recipeSuggestions),
    ]);
  }
  catch (err) { console.error(err); return Response.json({ message: t('api:common.server_error') }, { status: 500 }); }

  try {
    await prisma.$transaction(async (tx) => {
      // Update the goal's own fields; the section relations are applied
      // below by the same per-section appliers the sectional writers use, keeping
      // every connect/disconnect a flat statement (no nested connect/disconnect).
      goalId = (await tx.goal.update({
        where: { id: goal.goalId },
        data: {
          name: goal.name,
          description: goal.description,
          indicatorParameter: goal.indicatorParameter,
          isFeatured: goal.isFeatured,
        },
        select: { id: true },
      })).id;

      await applyDataSeriesSection(tx, authorId, goal.goalId, goal, dataSeriesExternals);
      await applyBaselineSection(tx, authorId, goal.goalId, goal, baselineExternals);
      await applyHistoricalSection(tx, authorId, goal.goalId, goal, historicalExternals);
      await applyRecipeSuggestionsSection(tx, authorId, goal.goalId, goal.recipeSuggestions, suggestionExternals);
    });

    // Prune any orphaned comments
    void pruneOrphans();
    revalidateTag('goal', { expire: 0 });
    return Response.json({ message: t('api:goal.goal_updated'), id: goalId },
      { status: 200, headers: { 'Location': `/goal/${goalId}` } },
    );
  }
  catch (err) { console.error(err); return Response.json({ message: t('api:common.server_error') }, { status: 500 }); }
}

/**
 * Handles POST requests to the goal API. The body is a discriminated union
 * (see {@link GoalCreateInput}): `Full` creates a new goal, while the sectional
 * targets add one section to an existing goal.
 */
export async function POST(request: NextRequest) {
  const [session, formData] = await Promise.all([
    getSession(await cookies()),
    request.json() as Promise<JSONValue>,
  ]);
  const t = await serveTea("api");

  if (!session.user?.id) {
    return Response.json({ message: t('api:common.unauthorized') }, { status: 401, headers: { 'Location': '/login' } });
  }
  const authorId = session.user.id;

  if (!isGoalCreate(formData)) {
    console.error("formData failed validation");
    return Response.json({ message: t('api:common.invalid_request_body') }, { status: 400 });
  }

  switch (formData.target) {
    case GoalDataTarget.Full: {
      return createFullGoal(session, authorId, formData, t);
    }
    case GoalDataTarget.DataSeries: {
      const auth = await authorizeGoalWrite(session, formData.goalId, formData.timestamp, t);
      if ("error" in auth) return auth.error;
      return writeDataSeriesSection(authorId, formData.goalId, formData, t);
    }
    case GoalDataTarget.Baseline: {
      const auth = await authorizeGoalWrite(session, formData.goalId, formData.timestamp, t);
      if ("error" in auth) return auth.error;
      return writeBaselineSection(authorId, formData.goalId, formData, t);
    }
    case GoalDataTarget.Historical: {
      const auth = await authorizeGoalWrite(session, formData.goalId, formData.timestamp, t);
      if ("error" in auth) return auth.error;
      return writeHistoricalSection(authorId, formData.goalId, formData, t);
    }
    case GoalDataTarget.RecipeSuggestions: {
      const auth = await authorizeGoalWrite(session, formData.goalId, formData.timestamp, t);
      if ("error" in auth) return auth.error;
      return writeRecipeSuggestionsSection(authorId, formData.goalId, formData, t);
    }
    default: {
      const exhaustive: never = formData; // Never used to cause type error if the switch isn't exhaustive.
      console.error("Received goal create with unrecognized target:", exhaustive);
      throw new Error(`Unhandled goal create target. Now switch case for this target: "${String(exhaustive["target"])}"`);
    }
  }
}

/**
 * Handles PUT requests to the goal API. The body is a discriminated union
 * (see {@link GoalUpdateInput}): `Full` updates the whole goal, while the
 * sectional targets replace one section of an existing goal.
 */
export async function PUT(request: NextRequest) {
  const [session, goal] = await Promise.all([
    getSession(await cookies()),
    request.json() as Promise<JSONValue>,
  ]);
  const t = await serveTea("api");

  if (!session.user?.id) {
    return Response.json({ message: t('api:common.unauthorized') }, { status: 401, headers: { 'Location': '/login' } });
  }
  const authorId = session.user.id;

  if (!isGoalUpdate(goal)) {
    return Response.json({ message: t('api:common.invalid_request_body') }, { status: 400 });
  }

  switch (goal.target) {
    case GoalDataTarget.Full: {
      return updateFullGoal(session, authorId, goal, t);
    }
    case GoalDataTarget.DataSeries: {
      const auth = await authorizeGoalWrite(session, goal.goalId, goal.timestamp, t);
      if ("error" in auth) return auth.error;
      return writeDataSeriesSection(authorId, goal.goalId, goal, t);
    }
    case GoalDataTarget.Baseline: {
      const auth = await authorizeGoalWrite(session, goal.goalId, goal.timestamp, t);
      if ("error" in auth) return auth.error;
      return writeBaselineSection(authorId, goal.goalId, goal, t);
    }
    case GoalDataTarget.Historical: {
      const auth = await authorizeGoalWrite(session, goal.goalId, goal.timestamp, t);
      if ("error" in auth) return auth.error;
      return writeHistoricalSection(authorId, goal.goalId, goal, t);
    }
    case GoalDataTarget.RecipeSuggestions: {
      const auth = await authorizeGoalWrite(session, goal.goalId, goal.timestamp, t);
      if ("error" in auth) return auth.error;
      return writeRecipeSuggestionsSection(authorId, goal.goalId, goal, t);
    }
    default: {
      const exhaustive: never = goal; // Never used to cause type error if the switch isn't exhaustive.
      console.error("Received goal update with unrecognized target:", exhaustive);
      throw new Error(`Unhandled goal update target. Now switch case for this target: "${String(exhaustive["target"])}"`);
    }
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
  }
  catch (err) {
    if (err instanceof Error) {
      if (err.message === ClientError.BadSession) {
        // Remove session to log out. The client should redirect to login page.
        session.destroy();
        return Response.json({ message: ClientError.BadSession },
          { status: 400, headers: { 'Location': '/login' } },
        );
      }
      if (err.message === ClientError.AccessDenied) {
        return Response.json({ message: ClientError.AccessDenied },
          { status: 403 },
        );
      }
    }
    // If no matching error is thrown, log the error and return a generic error message
    console.error(err);
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
  }
  catch (err) {
    console.error(err);
    return Response.json({ message: t('api:common.server_error') },
      { status: 500 },
    );
  }
}
