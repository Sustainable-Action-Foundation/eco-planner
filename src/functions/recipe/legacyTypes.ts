import type { JSONValue } from "@/types";
import { RecipeDataTypes } from "@/functions/recipe/types/enums";

type JSONObject = Partial<{ [key: string]: JSONValue }>;

function isJSONObject(value: JSONValue | undefined): value is JSONObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Variable `type` spellings that nothing writes any more but stored recipes
 * still carry, mapped to the value they mean today. Reading only:
 * {@link withCurrentVariableTypes} applies it where stored recipes are parsed
 * (`Recipe.from`), and serializing always writes the current value.
 *
 * - `dataSeries`: the value of `RecipeDataTypes.DataSeries` until 2026-07-30,
 *   when it became `data-series`. Stored recipes were not rewritten, and the
 *   SQL that gave every recipe-less series an inline manual recipe wrote the old
 *   spelling literally. `scripts/maintenance/rewrite-legacy-recipe-types.ts`
 *   rewrites the stored rows.
 *
 * When a stored value is renamed, add the old spelling here; the type guards
 * stay strict and only ever know the current values.
 */
export const legacyRecipeDataTypes: ReadonlyMap<string, RecipeDataTypes> = new Map([
  ["dataSeries", RecipeDataTypes.DataSeries],
]);

/**
 * A recipe object as it was stored, with every variable `type` in its current
 * spelling. Nothing else is touched or validated: the result still has to pass
 * `isRecipe`. Returns the input itself when there is nothing to rewrite, and
 * never mutates it.
 */
export function withCurrentVariableTypes(recipe: JSONValue): JSONValue {
  if (!isJSONObject(recipe) || !Array.isArray(recipe.variables)) return recipe;

  let rewritten = false;
  const variables = recipe.variables.map((variable) => {
    if (!isJSONObject(variable) || typeof variable.type !== "string") return variable;
    const current = legacyRecipeDataTypes.get(variable.type);
    if (current === undefined) return variable;
    rewritten = true;
    return { ...variable, type: current };
  });

  return rewritten ? { ...recipe, variables } : recipe;
}
