import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@PRISMA-NAMESPACE-ONLY";
import { Recipe, fetchExternalVariableData, externalSelectionKey } from "@/functions/recipe";
import { RecipeDataTypes } from "@/functions/recipe/types/enums";
import getTableContent from "@/lib/api/getTableContent";
import type { DataSeriesVariable, ExternalSource, RecipeVariable, ResolvedExternals, SerializedRecipe } from "@/functions/recipe";
import { dateValuesToDBDateRecord } from "@/functions/recipe/vectorAndMaskUtils";
import { serializeUnit } from "@/functions/unit";
import type { DateValuesWithUnit } from "@/types";

/** True if two external selections are equivalent (order-insensitive). */
function sameExternalSource(a: ExternalSource, b: ExternalSource): boolean {
  return externalSelectionKey(a.dataset, a.tableId, a.selection) === externalSelectionKey(b.dataset, b.tableId, b.selection);
}

/**
 * Builds the nested create data for a hand-entered data series: the series plus
 * its producing inline manual recipe (`meta.isManual`), both owned by `orgId`.
 * Usable in any nested `create:` position for a DataSeries relation.
 */
export function manualDataSeriesCreateData(dateValues: DateValuesWithUnit, orgId: string, authorId: string) {
  return {
    org: { connect: { id: orgId } },
    author: { connect: { id: authorId } },
    unit: serializeUnit(dateValues.unit), // db keeps the legacy convention
    values: { createMany: { data: dateValuesToDBDateRecord(dateValues.dateValues) } },
    recipe_used: {
      create: {
        recipe: Recipe.fromManualDateValues(dateValues).serialize(),
        org: { connect: { id: orgId } },
      },
    },
  };
}

/**
 * Decides, for every edit-time `External` variable in a recipe, whether its data
 * must be fetched. Selections that are unchanged from the currently-stored recipe
 * reuse the existing `DataSeries` (external data is only re-fetched when the
 * selection actually changes).
 *
 * Run BEFORE opening the DB transaction, since fetching performs network calls.
 */
export async function resolveRecipeExternals(
  serializedRecipe: SerializedRecipe,
  existingRecipeId: string | null | undefined,
): Promise<ResolvedExternals> {
  const resolved: ResolvedExternals = new Map();
  const warnings: string[] = [];

  // Map the currently-stored materialized externals by variable id, to detect unchanged selections.
  const storedByVariable = new Map<string, { dataSeriesId: string, source: ExternalSource }>();
  if (existingRecipeId) {
    const existing = await prisma.recipes.findUnique({ where: { id: existingRecipeId }, select: { recipe: true } });
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

      const data = await fetchExternalVariableData(variable, warnings, getTableContent);
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
export async function materializeRecipeExternals(
  tx: Prisma.TransactionClient,
  serializedRecipe: SerializedRecipe,
  authorId: string,
  orgId: string,
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
      // The fetched series is produced by its own single-variable "external fetch"
      // recipe: the values are inlined (like a manual recipe) and the externalSource
      // meta keeps the selection discoverable/re-editable (see getHistoricalSource).
      const fetchRecipeVariable: DataSeriesVariable = {
        id: variable.id,
        name: variable.name,
        type: RecipeDataTypes.DataSeries,
        unit: fetched.unit,
        template: variable.template,
        pick: variable.pick,
        dataSeriesId: null,
        value: fetched.dateValues,
        externalSource: resolvedVariable.source,
      };
      dataSeriesId = (await tx.dataSeries.create({
        data: {
          org: { connect: { id: orgId } },
          author: { connect: { id: authorId } },
          values: { createMany: { data: dateValuesToDBDateRecord(fetched.dateValues) } },
          unit: serializeUnit(fetched.unit), // db keeps the legacy convention
          recipe_used: {
            create: {
              org: { connect: { id: orgId } },
              recipe: new Recipe({
                name: variable.name,
                equation: `\${${variable.id}}`,
                variables: [fetchRecipeVariable],
                unit: fetched.unit,
              }).serialize(),
            },
          },
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
 * Handles the create/update/link lifecycle for one recipe (e.g. a goal's
 * dataSeries, baseline or historical recipe), materializing any external
 * variables it contains. Must be called inside the transaction.
 */
export async function upsertRecipe(
  tx: Prisma.TransactionClient,
  authorId: string,
  orgId: string,
  label: string,
  input: { recipe: SerializedRecipe | null | undefined, recipeId: string | null | undefined, resolved: ResolvedExternals | null },
): Promise<{ recipeId: string | null | undefined, dataSeriesIdsByVariable: Record<string, string> }> {
  let recipe = input.recipe;
  let recipeId = input.recipeId;
  let dataSeriesIdsByVariable: Record<string, string> = {};

  // New recipe data: materialize its externals, then create or update
  if (recipe) {
    const materialized = await materializeRecipeExternals(tx, recipe, authorId, orgId, input.resolved ?? new Map() as ResolvedExternals);
    recipe = materialized.serializedRecipe;
    dataSeriesIdsByVariable = materialized.dataSeriesIdsByVariable;

    // Every DataSeries the recipe's variables reference (the just-materialized
    // external ones plus any pre-existing references) is a source dependency.
    const sourceConnect = [...new Set(
      Recipe.from(recipe).variables
        .filter(variable => variable.type === RecipeDataTypes.DataSeries && !!variable.dataSeriesId)
        .map(variable => (variable as { dataSeriesId: string }).dataSeriesId),
    )].map(id => ({ id }));

    if (recipeId) {
      await tx.recipes.update({ where: { id: recipeId }, data: { recipe, source_data_series: { set: sourceConnect } } });
    } else {
      recipeId = (await tx.recipes.create({
        data: {
          recipe,
          org: { connect: { id: orgId } },
          source_data_series: { connect: sourceConnect },
        },
        select: { id: true },
      })).id;
    }
  }
  // No new recipe data + existing recipe ID = link (if it still exists)
  else if (recipeId) {
    const existingRecipe = await tx.recipes.findUnique({ where: { id: recipeId }, select: { id: true } });
    if (!existingRecipe) {
      console.warn(`Goal save: tried linking goal with a ${label} recipe (${recipeId}) but not found, unlinking...`);
      recipeId = null;
    }
  }

  return { recipeId, dataSeriesIdsByVariable };
}
