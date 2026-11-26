import { Recipe } from "@/functions/recipe/recipe";
import { RecipeDataTypes } from "@/functions/recipe/types/enums";

/*
 * The second half of "sources and the viewer" (see `inclusionSelectors.ts`). The query leaves out
 * the source series the viewer may not get (`visibleSourceSeriesWHERE`), but the recipe next to
 * them is one JSON value written by the author of the computed series, and it says what it reads:
 * the source's series id, the label the form gave the variable (the copied goal's name) and an
 * equation that refers to the variable by that label. No query can cut that out of the JSON, so
 * the readers do it on the query's result, before it leaves the cached reader.
 *
 * Plain module (no `server-only`): the unit tests import it.
 */

/** What a withheld recipe is replaced by: valid for `Recipe.from`, evaluates to nothing, says nothing */
const withheldRecipe: string = Recipe.getEmpty().serialize();

type JSONObject = Record<string, unknown>;

function isObject(value: unknown): value is JSONObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A stored recipe as an object: the column holds a serialized string (what the app writes) or a plain object (hand-written SQL) */
function storedRecipeObject(recipe: unknown): JSONObject | null {
  if (typeof recipe !== "string") return isObject(recipe) ? recipe : null;
  try {
    const parsed: unknown = JSON.parse(recipe);
    return isObject(parsed) ? parsed : null;
  }
  catch {
    return null;
  }
}

/**
 * Whether a recipe reads a stored series that is not among those delivered with it.
 *
 * Fetched statistics are the exception: a variable that carries the selection it was fetched
 * with (`externalSource`, or an `External` variable) names a public table, and its materialized
 * series fills no slot, so it is delivered only to editors (`visibleSourceSeriesWHERE`). Everyone
 * else still needs the recipe for the source line under the graph.
 *
 * A recipe that cannot be read at all counts as reading one: nothing can evaluate or edit it
 * either, and what it names is unknown.
 */
export function readsUndeliveredSeries(recipe: unknown, deliveredIds: ReadonlySet<string>): boolean {
  const stored = storedRecipeObject(recipe);
  if (!stored || !Array.isArray(stored.variables)) return true;

  return stored.variables.some((variable: unknown) => {
    if (!isObject(variable)) return true;
    const id = variable.dataSeriesId;
    // Scalars, inline (manual) series and unfilled templates read no stored series
    if (typeof id !== "string" || id === "") return false;
    if (deliveredIds.has(id)) return false;
    return !(variable.type === RecipeDataTypes.External || isObject(variable.externalSource));
  });
}

/** A series' recipe as the selections carry it: `recipe_used: { recipe, source_data_series }` */
function isCarriedRecipe(value: unknown): value is { recipe: unknown, source_data_series: { id: string }[] } {
  return isObject(value) && "recipe" in value && Array.isArray(value.source_data_series);
}

function visit(node: unknown): void {
  if (Array.isArray(node)) {
    for (const item of node) visit(item);
    return;
  }
  if (!isObject(node) || node instanceof Date) return;

  for (const [key, value] of Object.entries(node)) {
    // Date records: the bulk of every payload, and nothing in them to look at
    if (key === "values") continue;
    if (key === "recipe_used" && isCarriedRecipe(value)) {
      const delivered = new Set(value.source_data_series.map(source => source.id));
      if (readsUndeliveredSeries(value.recipe, delivered)) value.recipe = withheldRecipe;
      continue;
    }
    visit(value);
  }
}

/**
 * Replaces, anywhere in a reader's result, the recipe of a series that reads a source the viewer
 * did not get with an empty recipe. The series keeps its own values: they are its own. Every
 * reader whose selection carries `recipe_used` returns through this (in place; returns its
 * argument), inside the cached scope, so what is cached per viewer is already without it.
 *
 * An edit form given the empty recipe has nothing to evaluate and refuses to save the series,
 * which is the point: someone who may edit the goal but not see what it is computed from cannot
 * recompute it from a part of its sources. The stored recipe is untouched, and
 * `/api/recalculate` reads it through `getOneRecipe`, never through these selections.
 */
export function withoutHiddenSources<T>(result: T): T {
  visit(result);
  return result;
}
