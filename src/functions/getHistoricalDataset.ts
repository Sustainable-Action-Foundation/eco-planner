import { Recipe } from "@/functions/recipe";
import { RecipeDataTypes } from "@/functions/recipe/types/enums";
import type { ExternalSource } from "@/functions/recipe";
import { ExternalDataset } from "@/lib/api/utility";
import type { DatasetData, DatasetKeys } from "@/lib/api/apiTypes";
import type { Goal } from "@/types";

type HistoricalSource = {
  /** The recipe variable id, reused so the equation stays stable across edits. */
  id: string;
  name: string;
  dataset: DatasetKeys | null;
  tableId: string | null;
  selection: ExternalSource["selection"];
};

/**
 * Recovers the external API selection behind a historical data recipe.
 *
 * Stored historical recipes contain a `DataSeries` variable carrying
 * `externalSource` meta (the External variable having been materialized on save);
 * unsaved/edit-time recipes may still contain a raw `External` variable. Both are
 * normalized to a {@link HistoricalSource} here.
 */
export function getHistoricalSourceFromRecipe(recipe: Recipe | null | undefined): HistoricalSource | null {
  if (!recipe) return null;

  try {
    const variable = recipe.variables.find(
      v => v.type === RecipeDataTypes.External || (v.type === RecipeDataTypes.DataSeries && !!v.externalSource),
    );
    if (!variable) return null;

    if (variable.type === RecipeDataTypes.External) {
      return { id: variable.id, name: variable.name, dataset: variable.dataset, tableId: variable.tableId, selection: variable.selection };
    }
    if (variable.type === RecipeDataTypes.DataSeries && variable.externalSource) {
      const { dataset, tableId, selection } = variable.externalSource;
      return { id: variable.id, name: variable.name, dataset, tableId, selection };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Recovers the external API selection behind a goal's historical data.
 *
 * Thin wrapper over {@link getHistoricalSourceFromRecipe} for the persisted-goal
 * case; deserializes the stored recipe JSON before delegating.
 */
export function getHistoricalSource(goal: Pick<Goal, "historical">): HistoricalSource | null {
  const recipeJson = goal.historical?.recipe_used?.recipe;
  if (!recipeJson) return null;

  try {
    return getHistoricalSourceFromRecipe(Recipe.from(recipeJson));
  } catch {
    return null;
  }
}

/**
 * Derives the external data source attribution (for source links/labels) from a
 * historical data recipe, without re-fetching anything.
 */
export function getHistoricalDatasetFromRecipe(
  recipe: Recipe | null | undefined,
): { dataset: DatasetData | null, label: string | null } {
  const source = getHistoricalSourceFromRecipe(recipe);
  if (!source) return { dataset: null, label: null };

  return {
    dataset: source.dataset ? ExternalDataset.getDatasetByAlternateName(source.dataset) : null,
    label: source.name || null,
  };
}

/**
 * Derives the external data source attribution (for source links/labels) for a
 * goal's historical data, without re-fetching anything.
 */
export function getHistoricalDataset(
  goal: Pick<Goal, "historical">,
): { dataset: DatasetData | null, label: string | null } {
  const source = getHistoricalSource(goal);
  if (!source) return { dataset: null, label: null };

  return {
    dataset: source.dataset ? ExternalDataset.getDatasetByAlternateName(source.dataset) : null,
    label: source.name || null,
  };
}