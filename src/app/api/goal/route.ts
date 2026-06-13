import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@PRISMA-NAMESPACE-ONLY";
import { revalidateTag } from "next/cache";
import { cookies } from "next/headers";
import { getSession } from "@/lib/session";
import accessChecker, { hasEditAccess } from "@/lib/accessChecker";
import { ClientError, isGoalCreate, isGoalUpdate } from "@/types";
import type { AccessControlled, DateValuesWithUnit, JSONValue } from "@/types";
import { goalInclusionSelection } from "@/fetchers/inclusionSelectors";
import pruneOrphans from "@/functions/pruneOrphans";
import { dateValuesToDBDateRecord } from "@/functions/recipe/vectorAndMaskUtils";
import { Recipe, RecipeDataTypes, fetchExternalVariableData } from "@/functions/recipe";
import type { DataSeriesVariable, ExternalSource, RecipeVariable, SerializedRecipe } from "@/functions/recipe";
import serveTea from "@/lib/i18nServer";

/**
 * Per external variable, either freshly fetched data (selection is new or changed) or a reference to the already-stored series (selection unchanged).
 */
type ResolvedExternals = Map<string, { source: ExternalSource } & (
  | { data: DateValuesWithUnit, reuseDataSeriesId?: undefined }
  | { reuseDataSeriesId: string, data?: undefined }
)>;

/** True if two external selections are equivalent (order-insensitive). */
function sameExternalSource(a: ExternalSource, b: ExternalSource): boolean {
  if (a.dataset !== b.dataset || a.tableId !== b.tableId) return false;
  const normalize = (selection: ExternalSource["selection"]) => JSON.stringify(
    [...selection]
      .map(item => ({ variableCode: item.variableCode, valueCodes: [...item.valueCodes].sort() }))
      .sort((x, y) => x.variableCode.localeCompare(y.variableCode)),
  );
  return normalize(a.selection) === normalize(b.selection);
}

/**
 * Decides, for every edit-time `External` variable in a recipe, whether its data
 * must be fetched. Selections that are unchanged from the currently-stored recipe
 * reuse the existing `DataSeries` (external data is only re-fetched when the
 * selection actually changes).
 *
 * Run BEFORE opening the DB transaction, since fetching performs network calls.
 */
async function resolveRecipeExternals(
  serializedRecipe: SerializedRecipe,
  existingRecipeId: string | null | undefined,
): Promise<ResolvedExternals> {
  const resolved: ResolvedExternals = new Map();
  const warnings: string[] = [];

  // Map the currently-stored materialized externals by variable id, to detect unchanged selections.
  const storedByVariable = new Map<string, { dataSeriesId: string, source: ExternalSource }>();
  if (existingRecipeId) {
    const existing = await prisma.recipe.findUnique({ where: { id: existingRecipeId }, select: { recipe: true } });
    if (existing) {
      for (const variable of Recipe.from(existing.recipe).variables) {
        if (variable.type === RecipeDataTypes.DataSeries && variable.externalSource && variable.dataSeriesId) {
          storedByVariable.set(variable.id, { dataSeriesId: variable.dataSeriesId, source: variable.externalSource });
        }
      }
    }
  }

  await Promise.all(
    Recipe.from(serializedRecipe).variables.map(async (variable) => {
      if (variable.type !== RecipeDataTypes.External) return;
      const source: ExternalSource = { dataset: variable.dataset, tableId: variable.tableId, selection: variable.selection };

      // Selection unchanged from what is already stored: keep the existing series, don't re-fetch.
      const stored = storedByVariable.get(variable.id);
      if (stored && sameExternalSource(stored.source, source)) {
        resolved.set(variable.id, { reuseDataSeriesId: stored.dataSeriesId, source });
        return;
      }

      const data = await fetchExternalVariableData(variable, warnings);
      resolved.set(variable.id, { data, source });
    }),
  );

  if (warnings.length) console.warn("Warnings while resolving external variables:", warnings);
  return resolved;
}

/**
 * Within a transaction, rewrites each `External` variable into a
 * `DataSeriesVariable` that keeps the original selection as `externalSource` meta,
 * creating a `DataSeries` for freshly-fetched data or reusing the existing one
 * for unchanged selections. Stored recipes therefore contain no `External`
 * variables (so evaluate/recalculate read the stored series rather than
 * re-fetching), while staying re-editable via the meta.
 */
async function materializeRecipeExternals(
  tx: Prisma.TransactionClient,
  serializedRecipe: SerializedRecipe,
  authorId: string,
  resolved: ResolvedExternals,
): Promise<{ serializedRecipe: SerializedRecipe, dataSeriesIdsByVariable: Record<string, string> }> {
  const recipe = Recipe.from(serializedRecipe);
  const dataSeriesIdsByVariable: Record<string, string> = {};
  const newVariables: RecipeVariable[] = [];

  for (const variable of recipe.variables) {
    const resolvedVariable = variable.type === RecipeDataTypes.External ? resolved.get(variable.id) : undefined;
    if (variable.type !== RecipeDataTypes.External || !resolvedVariable) {
      newVariables.push(variable);
      continue;
    }

    let dataSeriesId: string;
    if (resolvedVariable.data) {
      const fetched = resolvedVariable.data;
      dataSeriesId = (await tx.dataSeries.create({
        data: {
          author: { connect: { id: authorId } },
          values: { createMany: { data: dateValuesToDBDateRecord(fetched.dateValues) } },
          ...(fetched.unit == null ? {} : { unit: fetched.unit }),
        },
        select: { id: true },
      })).id;
    }
    else {
      dataSeriesId = resolvedVariable.reuseDataSeriesId;
    }
    dataSeriesIdsByVariable[variable.id] = dataSeriesId;

    const materialized: DataSeriesVariable = {
      id: variable.id,
      name: variable.name,
      type: RecipeDataTypes.DataSeries,
      unit: variable.unit,
      template: variable.template,
      pick: variable.pick,
      dataSeriesId,
      value: undefined,
      externalSource: resolvedVariable.source,
    };
    newVariables.push(materialized);
  }

  recipe.variables = newVariables;
  return { serializedRecipe: recipe.serialize(), dataSeriesIdsByVariable };
}

/**
 * Handles the create/update/link lifecycle for one of a goal's recipes
 * (dataSeries, baseline or historical), materializing any external variables it
 * contains. Must be called inside the transaction.
 */
async function upsertGoalRecipe(
  tx: Prisma.TransactionClient,
  authorId: string,
  label: string,
  input: { recipe: SerializedRecipe | null | undefined, recipeId: string | null | undefined, resolved: ResolvedExternals | null },
): Promise<{ recipeId: string | null | undefined, dataSeriesIdsByVariable: Record<string, string> }> {
  let recipe = input.recipe;
  let recipeId = input.recipeId;
  let dataSeriesIdsByVariable: Record<string, string> = {};

  // New recipe data: materialize its externals, then create or update
  if (recipe) {
    const materialized = await materializeRecipeExternals(tx, recipe, authorId, input.resolved ?? new Map() as ResolvedExternals);
    recipe = materialized.serializedRecipe;
    dataSeriesIdsByVariable = materialized.dataSeriesIdsByVariable;

    if (recipeId) {
      await tx.recipe.update({ where: { id: recipeId }, data: { recipe } });
    } else {
      recipeId = (await tx.recipe.create({ data: { recipe }, select: { id: true } })).id;
    }
  }
  // No new recipe data + existing recipe ID = link (if it still exists)
  else if (recipeId) {
    const existingRecipe = await tx.recipe.findUnique({ where: { id: recipeId }, select: { id: true } });
    if (!existingRecipe) {
      console.warn(`Goal save: tried linking goal with a ${label} recipe (${recipeId}) but not found, unlinking...`);
      recipeId = null;
    }
  }

  return { recipeId, dataSeriesIdsByVariable };
}


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
  const authorId = session.user.id;

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

  // Fetch external variable data for all recipes before opening the transaction,
  // since fetching performs network calls. They are persisted as DataSeries
  // (and the external variables rewritten) when the recipes are saved below.
  let dataSeriesExternals: ResolvedExternals | null = null;
  let baselineExternals: ResolvedExternals | null = null;
  let historicalExternals: ResolvedExternals | null = null;
  try {
    [dataSeriesExternals, baselineExternals, historicalExternals] = await Promise.all([
      formData.dataSeriesRecipe ? resolveRecipeExternals(formData.dataSeriesRecipe, formData.dataSeriesRecipeId) : Promise.resolve(null),
      formData.baselineRecipe ? resolveRecipeExternals(formData.baselineRecipe, formData.baselineRecipeId) : Promise.resolve(null),
      formData.historicalRecipe ? resolveRecipeExternals(formData.historicalRecipe, formData.historicalRecipeId) : Promise.resolve(null),
    ]);
  } catch (error) {
    console.error(error);
    return Response.json({ message: t('api:common.server_error') },
      { status: 500 },
    );
  }

  // Parse form data
  try {
    await prisma.$transaction(async (prisma) => {
      // Create/update recipes first, materializing any external variables into DataSeries
      formData.dataSeriesRecipeId = (await upsertGoalRecipe(prisma, authorId, "data series", {
        recipe: formData.dataSeriesRecipe, recipeId: formData.dataSeriesRecipeId, resolved: dataSeriesExternals,
      })).recipeId;
      formData.baselineRecipeId = (await upsertGoalRecipe(prisma, authorId, "baseline", {
        recipe: formData.baselineRecipe, recipeId: formData.baselineRecipeId, resolved: baselineExternals,
      })).recipeId;
      const historicalResult = await upsertGoalRecipe(prisma, authorId, "historical", {
        recipe: formData.historicalRecipe, recipeId: formData.historicalRecipeId, resolved: historicalExternals,
      });
      formData.historicalRecipeId = historicalResult.recipeId;
      // The historical recipe's single external variable becomes the goal's historical DataSeries
      const historicalDataSeriesId = Object.values(historicalResult.dataSeriesIdsByVariable)[0] ?? formData.historicalId ?? null;
      // Link the historical recipe to its resulting series so the source stays discoverable
      if (historicalDataSeriesId && typeof formData.historicalRecipeId === 'string') {
        await prisma.dataSeries.update({
          where: { id: historicalDataSeriesId },
          data: { recipeUsed: { connect: { id: formData.historicalRecipeId } } },
        });
      }

      // Create goal
      goalId = (await prisma.goal.create({
        data: {
          name: formData.name,
          description: formData.description,
          indicatorParameter: formData.indicatorParameter,
          isFeatured: formData.isFeatured,
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
          historical: historicalDataSeriesId
            ? { connect: { id: historicalDataSeriesId } }
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
    revalidateTag('goal', { expire: 0 });
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
  const authorId = session.user.id;

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

  // Fetch external variable data for all recipes before opening the transaction,
  // since fetching performs network calls. They are persisted as DataSeries
  // (and the external variables rewritten) when the recipes are saved below.
  let dataSeriesExternals: ResolvedExternals | null = null;
  let baselineExternals: ResolvedExternals | null = null;
  let historicalExternals: ResolvedExternals | null = null;
  try {
    [dataSeriesExternals, baselineExternals, historicalExternals] = await Promise.all([
      goal.dataSeriesRecipe ? resolveRecipeExternals(goal.dataSeriesRecipe, goal.dataSeriesRecipeId) : Promise.resolve(null),
      goal.baselineRecipe ? resolveRecipeExternals(goal.baselineRecipe, goal.baselineRecipeId) : Promise.resolve(null),
      goal.historicalRecipe ? resolveRecipeExternals(goal.historicalRecipe, goal.historicalRecipeId) : Promise.resolve(null),
    ]);
  } catch (error) {
    console.error(error);
    return Response.json({ message: t('api:common.server_error') },
      { status: 500 },
    );
  }

  try {
    let historicalDataSeriesId: string | null = null;
    await prisma.$transaction(async (prisma) => {
      // Do recipes before goal update, materializing any external variables into DataSeries
      goal.dataSeriesRecipeId = (await upsertGoalRecipe(prisma, authorId, "data series", {
        recipe: goal.dataSeriesRecipe, recipeId: goal.dataSeriesRecipeId, resolved: dataSeriesExternals,
      })).recipeId;
      goal.baselineRecipeId = (await upsertGoalRecipe(prisma, authorId, "baseline", {
        recipe: goal.baselineRecipe, recipeId: goal.baselineRecipeId, resolved: baselineExternals,
      })).recipeId;
      const historicalResult = await upsertGoalRecipe(prisma, authorId, "historical", {
        recipe: goal.historicalRecipe, recipeId: goal.historicalRecipeId, resolved: historicalExternals,
      });
      goal.historicalRecipeId = historicalResult.recipeId;
      // The historical recipe's single external variable becomes the goal's historical DataSeries
      const resolvedHistoricalId = Object.values(historicalResult.dataSeriesIdsByVariable)[0] ?? null;
      historicalDataSeriesId = resolvedHistoricalId ?? goal.historicalId ?? null;
      // Link the historical recipe to its resulting series so the source stays discoverable
      if (resolvedHistoricalId && typeof goal.historicalRecipeId === 'string') {
        await prisma.dataSeries.update({
          where: { id: resolvedHistoricalId },
          data: { recipeUsed: { connect: { id: goal.historicalRecipeId } } },
        });
      }

      const hasNonEmptyBaselinePayload = !!goal.baseline && Object.keys(goal.baseline.dateValues).length > 0;

      // If the goal is updating its baseline, we need to disconnect it from the current one and create a new one
      // to avoid updating or deleting a baseline which actually is just a reference to another goal's data series
      // This cannot for some reason be done in the main query before the connectOrCreate, so instead it's done here in a separate query beforehand
      if (hasNonEmptyBaselinePayload) {
        await prisma.goal.update({
          where: { id: goal.goalId },
          data: {
            baseline: {
              disconnect: true,
            },
          },
        });
      }

      // Update goal
      goalId = (await prisma.goal.update({
        where: { id: goal.goalId },
        data: {
          name: goal.name,
          description: goal.description,
          indicatorParameter: goal.indicatorParameter,
          isFeatured: goal.isFeatured,
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
          baseline: hasNonEmptyBaselinePayload && goal.baseline
            ? {
              connectOrCreate: {
                where: { id: goal.baselineId ?? "" },
                create: {
                  author: { connect: { id: session.user?.id } },
                  recipeUsed: typeof goal.baselineRecipeId === 'string'
                    ? { connect: { id: goal.baselineRecipeId } }
                    : undefined,
                  values: { createMany: { data: dateValuesToDBDateRecord(goal.baseline.dateValues) } },
                  unit: goal.baseline.unit,
                },
              },
            } : goal.baselineId ? {
              connect: { id: goal.baselineId },
            } : undefined,
          historical: historicalDataSeriesId
            ? { connect: { id: historicalDataSeriesId } }
            : undefined,
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
    revalidateTag('goal', { expire: 0 });
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