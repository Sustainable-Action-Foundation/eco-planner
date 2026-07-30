import type { NextRequest } from "next/server";
import { getAccessContextById } from "@/fetchers/getUserAccessContext";
import { accessControlSelection } from "@/fetchers/inclusionSelectors";
import pruneOrphans from "@/functions/pruneOrphans";
import { Recipe } from "@/functions/recipe/recipe";
import { manualDataSeriesCreateData, resolveRecipeExternals, upsertRecipe } from "@/functions/recipe/persistence";
import type { ResolvedExternals, SerializedRecipe } from "@/functions/recipe";
import { dateValuesToDBDateRecord } from "@/functions/recipe/vectorAndMaskUtils";
import { serializeUnit } from "@/functions/unit";
import accessChecker, { hasEditAccess } from "@/lib/accessChecker";
import serveTea from "@/lib/i18nServer";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@PRISMA-NAMESPACE-ONLY";
import { getSession } from "@/lib/session";
import type { BaselineFields, DataSeriesFields, DateValuesWithUnit, GoalCreateFull, GoalUpdateFull, HistoricalFields, JSONValue, LoginData, RecipeSuggestionsFields } from "@/types";
import { ClientError, GoalDataTarget } from "@/types/enums";
import { isGoalCreate, isGoalUpdate } from "@/types/typeguards";
import { revalidateTag } from "next/cache";
import { cookies } from "next/headers";
import type { TFunction } from "i18next";
import type { IronSession } from "iron-session";

/**
 * Authorizes a write to an existing goal (used by Full update and all sectional
 * create/update branches): validates the session, that the goal exists and the
 * user has edit access via its iteration's roadmap, and that the provided
 * timestamp isn't stale. Returns an error `Response` to return immediately, or
 * `{ ok: true, orgId }` — the org owning the goal's roadmap, which also owns any
 * series/recipes created by the write.
 */
async function authorizeGoalWrite(session: IronSession<LoginData>, goalId: string, timestamp: number, t: TFunction): Promise<{ error: Response } | { ok: true, orgId: string }> {
  if (!session.user?.id) {
    return { error: Response.json({ message: t('api:common.unauthorized') }, { status: 401, headers: { 'Location': '/login' } }) };
  }

  try {
    const [accessContext, currentGoal] = await Promise.all([
      getAccessContextById(session.user.id),
      prisma.goals.findUnique({
        where: { id: goalId },
        select: {
          updated_at: true,
          roadmap_iteration: {
            select: {
              published_at: true,
              roadmap: { select: { access_control: { select: accessControlSelection } } },
            },
          },
        },
      }),
    ]);

    // Bad session cookie (no user, or falsely claims super admin) -> log out
    if (!accessContext || (session.user.isSuperAdmin && !accessContext.isSuperAdmin)) {
      throw new Error(ClientError.BadSession, { cause: 'goal' });
    }
    // No goal or no access -> AccessDenied
    if (!currentGoal) {
      throw new Error(ClientError.AccessDenied, { cause: 'goal' });
    }
    const access = accessChecker({
      access_control: currentGoal.roadmap_iteration.roadmap.access_control,
      published_at: currentGoal.roadmap_iteration.published_at,
    }, accessContext);
    if (!hasEditAccess(access)) {
      throw new Error(ClientError.AccessDenied, { cause: 'goal' });
    }
    // Stale data check
    if (!timestamp || new Date(currentGoal.updated_at).getTime() > timestamp) {
      throw new Error(ClientError.StaleData, { cause: 'goal' });
    }

    return { ok: true, orgId: currentGoal.roadmap_iteration.roadmap.access_control.org_id };
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

/**
 * Throws `IllegalParent` unless a client-supplied DataSeries id exists AND is free to
 * be connected: a series belongs to at most one dependent slot (no cross-slot sharing),
 * so it must either be unclaimed or already sit in the very slot being written
 * (`allowedCurrentId`).
 */
async function assertConnectableSeries(tx: Prisma.TransactionClient, id: string, allowedCurrentId?: string | null): Promise<void> {
  if (allowedCurrentId && id === allowedCurrentId) return;
  const found = await tx.dataSeries.findUnique({
    where: { id },
    select: {
      id: true,
      dependent_goal: { select: { id: true } },
      dependent_baseline: { select: { id: true } },
      dependent_historical: { select: { id: true } },
      dependent_effect: { select: { action_id: true } },
    },
  });
  if (!found) throw new Error(ClientError.IllegalParent, { cause: 'goal' });
  if (found.dependent_goal || found.dependent_baseline || found.dependent_historical || found.dependent_effect) {
    throw new Error(ClientError.IllegalParent, { cause: 'goal' });
  }
}

/**
 * Creates a DataSeries row and returns its id. With a recipe id the series is
 * produced by (connected to) that recipe; without one the entry is manual input,
 * producing an inline manual recipe owned by the same org.
 */
async function createDataSeries(tx: Prisma.TransactionClient, authorId: string, orgId: string, data: DateValuesWithUnit, recipeId: string | null | undefined): Promise<string> {
  if (typeof recipeId === 'string') {
    return (await tx.dataSeries.create({
      data: {
        org: { connect: { id: orgId } },
        author: { connect: { id: authorId } },
        recipe_used: { connect: { id: recipeId } },
        values: { createMany: { data: dateValuesToDBDateRecord(data.dateValues) } },
        unit: serializeUnit(data.unit), // db keeps the legacy convention
      },
      select: { id: true },
    })).id;
  }
  return (await tx.dataSeries.create({
    data: manualDataSeriesCreateData(data, orgId, authorId),
    select: { id: true },
  })).id;
}

// ── Per-section appliers ─────────────────────────────────────────────────────
// Each applies one section to an existing goal as flat statements within the
// caller's transaction (no nested connect/disconnect). Shared by the sectional
// writers and updateFullGoal. Connects to client-supplied ids are checked for
// existence and the no-cross-slot-sharing invariant.

/** Applies the data series section: updates the goal's series in place, or connects a verified existing one. */
async function applyDataSeriesSection(tx: Prisma.TransactionClient, authorId: string, orgId: string, goalId: string, section: DataSeriesFields, externals: ResolvedExternals | null): Promise<void> {
  const { recipeId } = await upsertRecipe(tx, authorId, orgId, "data series", {
    recipe: section.dataSeriesRecipe, recipeId: section.dataSeriesRecipeId, resolved: externals,
  });

  if (section.dataSeries) {
    const { data_series_id } = await tx.goals.findUniqueOrThrow({ where: { id: goalId }, select: { data_series_id: true } });
    if (data_series_id) {
      // Update the goal's existing series in place. Values-only input (no recipe sent)
      // is manual entry: overwrite the producing recipe with a fresh manual one so
      // recalculating doesn't resurrect stale data.
      await tx.dataSeries.update({
        where: { id: data_series_id },
        data: {
          recipe_used: typeof recipeId === 'string'
            ? { connect: { id: recipeId } }
            : { update: { recipe: Recipe.fromManualDateValues(section.dataSeries).serialize() } },
          values: { deleteMany: {}, createMany: { data: dateValuesToDBDateRecord(section.dataSeries.dateValues) } },
          unit: serializeUnit(section.dataSeries.unit), // db keeps the legacy convention
        },
      });
    } else {
      // Goal has no series yet: create one and connect it
      const id = await createDataSeries(tx, authorId, orgId, section.dataSeries, recipeId);
      await tx.goals.update({ where: { id: goalId }, data: { data_series: { connect: { id } } } });
    }
  } else if (section.dataSeriesId) {
    const { data_series_id } = await tx.goals.findUniqueOrThrow({ where: { id: goalId }, select: { data_series_id: true } });
    await assertConnectableSeries(tx, section.dataSeriesId, data_series_id);
    await tx.goals.update({ where: { id: goalId }, data: { data_series: { connect: { id: section.dataSeriesId } } } });
  }
}

/** Applies the baseline section: a payload becomes a fresh series (disconnect-then-create), else connect a verified id. */
async function applyBaselineSection(tx: Prisma.TransactionClient, authorId: string, orgId: string, goalId: string, section: BaselineFields, externals: ResolvedExternals | null): Promise<void> {
  const { recipeId } = await upsertRecipe(tx, authorId, orgId, "baseline", {
    recipe: section.baselineRecipe, recipeId: section.baselineRecipeId, resolved: externals,
  });

  const hasPayload = !!section.baseline && Object.keys(section.baseline.dateValues).length > 0;
  if (hasPayload && section.baseline) {
    // Disconnect first so we create a fresh baseline rather than mutating one that
    // may just be a reference to another goal's data series.
    await tx.goals.update({ where: { id: goalId }, data: { baseline: { disconnect: true } } });
    const id = await createDataSeries(tx, authorId, orgId, section.baseline, recipeId);
    await tx.goals.update({ where: { id: goalId }, data: { baseline: { connect: { id } } } });
  } else if (section.baselineId) {
    const { baseline_id } = await tx.goals.findUniqueOrThrow({ where: { id: goalId }, select: { baseline_id: true } });
    await assertConnectableSeries(tx, section.baselineId, baseline_id);
    await tx.goals.update({ where: { id: goalId }, data: { baseline: { connect: { id: section.baselineId } } } });
  }
}

/** Applies the historical section: connects the recipe-materialized series, a payload-created series, or a verified id; else disconnects. */
async function applyHistoricalSection(tx: Prisma.TransactionClient, authorId: string, orgId: string, goalId: string, section: HistoricalFields, externals: ResolvedExternals | null): Promise<void> {
  const result = await upsertRecipe(tx, authorId, orgId, "historical", {
    recipe: section.historicalRecipe, recipeId: section.historicalRecipeId, resolved: externals,
  });
  // The historical recipe's single external variable becomes the goal's historical
  // DataSeries. The materialized series carries its own "external fetch" recipe as
  // recipe_used, so the source selection stays discoverable via getHistoricalSource.
  const resolvedHistoricalId = Object.values(result.dataSeriesIdsByVariable)[0] ?? null;

  const hasPayload = !!section.historical && Object.keys(section.historical.dateValues).length > 0;
  if (hasPayload && section.historical) {
    await tx.goals.update({ where: { id: goalId }, data: { historical: { disconnect: true } } });
    const id = await createDataSeries(tx, authorId, orgId, section.historical, result.recipeId);
    await tx.goals.update({ where: { id: goalId }, data: { historical: { connect: { id } } } });
    return;
  }

  const historicalDataSeriesId = resolvedHistoricalId ?? section.historicalId ?? null;
  if (historicalDataSeriesId) {
    // Verify only client-supplied ids; a recipe-materialized id provably exists and is fresh.
    if (!resolvedHistoricalId) {
      const { historical_id } = await tx.goals.findUniqueOrThrow({ where: { id: goalId }, select: { historical_id: true } });
      await assertConnectableSeries(tx, historicalDataSeriesId, historical_id);
    }
    await tx.goals.update({ where: { id: goalId }, data: { historical: { connect: { id: historicalDataSeriesId } } } });
  } else {
    await tx.goals.update({ where: { id: goalId }, data: { historical: { disconnect: true } } });
  }
}

/**
 * Applies the recipe-suggestions section: replaces the goal's suggested recipes
 * with a freshly-created set. `undefined` leaves them untouched; `null`/`[]` clears
 * them. Any recipe is accepted (templates are the main use); externals are
 * materialized like any other recipe. Previously-suggested recipes left fully
 * orphaned by the replace are deleted.
 */
async function applyRecipeSuggestionsSection(tx: Prisma.TransactionClient, authorId: string, orgId: string, goalId: string, recipes: SerializedRecipe[] | null | undefined, resolvedList: ResolvedExternals[]): Promise<void> {
  if (recipes === undefined) return; // Field omitted: leave suggestions unchanged.
  const list = recipes ?? [];

  const before = (await tx.goals.findUniqueOrThrow({
    where: { id: goalId },
    select: { recipe_suggestions: { select: { id: true } } },
  })).recipe_suggestions.map(r => r.id);

  // Create each suggested recipe (materializing its externals) and collect the new ids.
  const newIds: string[] = [];
  for (let i = 0; i < list.length; i++) {
    const { recipeId } = await upsertRecipe(tx, authorId, orgId, "recipe suggestion", {
      recipe: list[i], recipeId: null, resolved: resolvedList[i] ?? null,
    });
    if (recipeId) newIds.push(recipeId);
  }

  // Point the goal at exactly the new set, disconnecting the old ones.
  await tx.goals.update({ where: { id: goalId }, data: { recipe_suggestions: { set: newIds.map(id => ({ id })) } } });

  // Delete previously-suggested recipes the replace left with no remaining references.
  for (const oldId of before) {
    const info = await tx.recipes.findUnique({
      where: { id: oldId },
      select: {
        derived_data_series: { select: { id: true } },
        _count: { select: { suggested_by_goals: true, source_data_series: true } },
      },
    });
    if (info && !info.derived_data_series && info._count.suggested_by_goals === 0 && info._count.source_data_series === 0) {
      await tx.recipes.delete({ where: { id: oldId } });
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

function writeDataSeriesSection(authorId: string, orgId: string, goalId: string, section: DataSeriesFields, t: TFunction): Promise<Response> {
  return writeSection(goalId, section.dataSeriesRecipe, section.dataSeriesRecipeId,
    (tx, externals) => applyDataSeriesSection(tx, authorId, orgId, goalId, section, externals), t);
}

function writeBaselineSection(authorId: string, orgId: string, goalId: string, section: BaselineFields, t: TFunction): Promise<Response> {
  return writeSection(goalId, section.baselineRecipe, section.baselineRecipeId,
    (tx, externals) => applyBaselineSection(tx, authorId, orgId, goalId, section, externals), t);
}

function writeHistoricalSection(authorId: string, orgId: string, goalId: string, section: HistoricalFields, t: TFunction): Promise<Response> {
  return writeSection(goalId, section.historicalRecipe, section.historicalRecipeId,
    (tx, externals) => applyHistoricalSection(tx, authorId, orgId, goalId, section, externals), t);
}

/**
 * Writes the recipe-suggestions section. Unlike the other sections it carries an
 * array of recipes, so it resolves a list of externals (one per recipe) before its
 * own transaction rather than going through {@link writeSection}.
 */
async function writeRecipeSuggestionsSection(authorId: string, orgId: string, goalId: string, section: RecipeSuggestionsFields, t: TFunction): Promise<Response> {
  let resolvedList: ResolvedExternals[];
  try { resolvedList = await resolveSuggestionExternals(section.recipeSuggestions); }
  catch (err) { return clientErrorResponse(err, t); }

  try {
    await prisma.$transaction((tx) => applyRecipeSuggestionsSection(tx, authorId, orgId, goalId, section.recipeSuggestions, resolvedList));
    void pruneOrphans();
    revalidateTag('goal', { expire: 0 });
    return Response.json({ message: t('api:goal.goal_updated'), id: goalId }, { status: 200, headers: { 'Location': `/goal/${goalId}` } });
  }
  catch (err) { return clientErrorResponse(err, t); }
}

/**
 * Creates a brand-new goal (Full POST): authorizes against the target roadmap
 * iteration, then creates the goal with all of its sections in one transaction.
 */
async function createFullGoal(session: IronSession<LoginData>, authorId: string, formData: GoalCreateFull, t: TFunction): Promise<Response> {
  let orgId: string;

  // Auth control (edit access to the parent iteration's roadmap)
  try {
    const [accessContext, iteration] = await Promise.all([
      getAccessContextById(authorId),
      prisma.roadmapIterations.findUnique({
        where: { id: formData.iterationId },
        select: {
          published_at: true,
          roadmap: { select: { access_control: { select: accessControlSelection } } },
        },
      }),
    ]);

    if (!accessContext || (session.user?.isSuperAdmin && !accessContext.isSuperAdmin)) {
      throw new Error(ClientError.BadSession, { cause: 'goal' });
    }
    if (!iteration) {
      throw new Error(ClientError.IllegalParent, { cause: 'goal' });
    }
    const access = accessChecker({ access_control: iteration.roadmap.access_control, published_at: iteration.published_at }, accessContext);
    if (!hasEditAccess(access)) {
      throw new Error(ClientError.IllegalParent, { cause: 'goal' });
    }
    orgId = iteration.roadmap.access_control.org_id;
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
      const { recipeId: dataSeriesRecipeId } = await upsertRecipe(tx, authorId, orgId, "data series", {
        recipe: formData.dataSeriesRecipe, recipeId: formData.dataSeriesRecipeId, resolved: dataSeriesExternals,
      });
      const { recipeId: baselineRecipeId } = await upsertRecipe(tx, authorId, orgId, "baseline", {
        recipe: formData.baselineRecipe, recipeId: formData.baselineRecipeId, resolved: baselineExternals,
      });
      const historicalResult = await upsertRecipe(tx, authorId, orgId, "historical", {
        recipe: formData.historicalRecipe, recipeId: formData.historicalRecipeId, resolved: historicalExternals,
      });
      const historicalRecipeId = historicalResult.recipeId;

      // Create each section's DataSeries as its own statement, then connect by id.
      const dataSeriesId = await createDataSeries(tx, authorId, orgId, formData.dataSeries, dataSeriesRecipeId);

      let baselineId: string | null = null;
      if (formData.baseline) {
        baselineId = await createDataSeries(tx, authorId, orgId, formData.baseline, baselineRecipeId);
      } else if (formData.baselineId) {
        await assertConnectableSeries(tx, formData.baselineId);
        baselineId = formData.baselineId;
      }

      // The historical recipe's single external variable becomes the goal's historical
      // DataSeries; the materialized series carries its own "external fetch" recipe.
      const resolvedHistoricalId = Object.values(historicalResult.dataSeriesIdsByVariable)[0] ?? null;

      // Like applyHistoricalSection: a payload becomes a fresh series, else the
      // recipe-materialized series or a verified client-supplied id is connected.
      const hasHistoricalPayload = !!formData.historical && Object.keys(formData.historical.dateValues).length > 0;
      let historicalDataSeriesId: string | null;
      if (hasHistoricalPayload && formData.historical) {
        historicalDataSeriesId = await createDataSeries(tx, authorId, orgId, formData.historical, historicalRecipeId);
      } else {
        historicalDataSeriesId = resolvedHistoricalId ?? formData.historicalId ?? null;
        if (historicalDataSeriesId && !resolvedHistoricalId) await assertConnectableSeries(tx, historicalDataSeriesId);
      }

      // Create goal, connecting the (just-created/verified) section series by id
      const createdId = (await tx.goals.create({
        data: {
          name: formData.name,
          description: formData.description,
          indicator_parameter: formData.indicatorParameter,
          is_featured: formData.isFeatured,
          author: { connect: { id: authorId } },
          roadmap_iteration: { connect: { id: formData.iterationId } },
          data_series: { connect: { id: dataSeriesId } },
          baseline: baselineId ? { connect: { id: baselineId } } : undefined,
          historical: historicalDataSeriesId ? { connect: { id: historicalDataSeriesId } } : undefined,
        },
        select: { id: true },
      })).id;
      goalId = createdId;

      // Create and connect any suggested recipes now that the goal exists.
      await applyRecipeSuggestionsSection(tx, authorId, orgId, createdId, formData.recipeSuggestions, suggestionExternals);
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
  const orgId = auth.orgId;

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
      goalId = (await tx.goals.update({
        where: { id: goal.goalId },
        data: {
          name: goal.name,
          description: goal.description,
          indicator_parameter: goal.indicatorParameter,
          is_featured: goal.isFeatured,
        },
        select: { id: true },
      })).id;

      await applyDataSeriesSection(tx, authorId, orgId, goal.goalId, goal, dataSeriesExternals);
      await applyBaselineSection(tx, authorId, orgId, goal.goalId, goal, baselineExternals);
      await applyHistoricalSection(tx, authorId, orgId, goal.goalId, goal, historicalExternals);
      await applyRecipeSuggestionsSection(tx, authorId, orgId, goal.goalId, goal.recipeSuggestions, suggestionExternals);
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
      return writeDataSeriesSection(authorId, auth.orgId, formData.goalId, formData, t);
    }
    case GoalDataTarget.Baseline: {
      const auth = await authorizeGoalWrite(session, formData.goalId, formData.timestamp, t);
      if ("error" in auth) return auth.error;
      return writeBaselineSection(authorId, auth.orgId, formData.goalId, formData, t);
    }
    case GoalDataTarget.Historical: {
      const auth = await authorizeGoalWrite(session, formData.goalId, formData.timestamp, t);
      if ("error" in auth) return auth.error;
      return writeHistoricalSection(authorId, auth.orgId, formData.goalId, formData, t);
    }
    case GoalDataTarget.RecipeSuggestions: {
      const auth = await authorizeGoalWrite(session, formData.goalId, formData.timestamp, t);
      if ("error" in auth) return auth.error;
      return writeRecipeSuggestionsSection(authorId, auth.orgId, formData.goalId, formData, t);
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
      return writeDataSeriesSection(authorId, auth.orgId, goal.goalId, goal, t);
    }
    case GoalDataTarget.Baseline: {
      const auth = await authorizeGoalWrite(session, goal.goalId, goal.timestamp, t);
      if ("error" in auth) return auth.error;
      return writeBaselineSection(authorId, auth.orgId, goal.goalId, goal, t);
    }
    case GoalDataTarget.Historical: {
      const auth = await authorizeGoalWrite(session, goal.goalId, goal.timestamp, t);
      if ("error" in auth) return auth.error;
      return writeHistoricalSection(authorId, auth.orgId, goal.goalId, goal, t);
    }
    case GoalDataTarget.RecipeSuggestions: {
      const auth = await authorizeGoalWrite(session, goal.goalId, goal.timestamp, t);
      if ("error" in auth) return auth.error;
      return writeRecipeSuggestionsSection(authorId, auth.orgId, goal.goalId, goal, t);
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
    const [accessContext, currentGoal] = await Promise.all([
      getAccessContextById(session.user.id),
      prisma.goals.findUnique({
        where: { id: goal.id },
        select: {
          roadmap_iteration: {
            select: {
              published_at: true,
              roadmap: { select: { access_control: { select: accessControlSelection } } },
            },
          },
        },
      }),
    ]);

    // If no user is found or the found user falsely claims to be a super admin, they have a bad session cookie and should be logged out
    if (!accessContext || (session.user.isSuperAdmin && !accessContext.isSuperAdmin)) {
      throw new Error(ClientError.BadSession, { cause: 'goal' });
    }

    // Deleting a goal is a content edit and requires edit access to its iteration.
    // Also covers goals that don't exist at all.
    const access = accessChecker(
      currentGoal ? { access_control: currentGoal.roadmap_iteration.roadmap.access_control, published_at: currentGoal.roadmap_iteration.published_at } : null,
      accessContext,
    );
    if (!currentGoal || !hasEditAccess(access)) {
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
    const deletedGoal = await prisma.goals.delete({
      where: {
        id: goal.id,
      },
      select: {
        id: true,
        roadmap_iteration_id: true,
      },
    });
    // Invalidate old cache
    revalidateTag('goal', 'max');
    return Response.json({ message: t('api:goal.goal_deleted'), id: deletedGoal.id },
      // Redirect to the parent iteration
      { status: 200, headers: { 'Location': `/roadmapIteration/${deletedGoal.roadmap_iteration_id}` } },
    );
  }
  catch (err) {
    console.error(err);
    return Response.json({ message: t('api:common.server_error') },
      { status: 500 },
    );
  }
}
