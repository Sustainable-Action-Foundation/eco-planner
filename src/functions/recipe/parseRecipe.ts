import type { Recipe, RecipeVariable } from "@/functions/recipe/types";
import { isRecipe, RecipeError } from "@/functions/recipe/types";
import { DateValuesWithUnit, JSONValue } from "@/types";
import { SmartRecipe } from "@/functions/recipe/smartRecipe";

export function recipeFromUnknown(recipe: JSONValue): Recipe {
  if (typeof recipe === "string") {
    try {
      recipe = JSON.parse(recipe) as JSONValue;
    } catch (error) {
      throw new RecipeError(`Failed to parse recipe from string: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (!isRecipe(recipe)) {
    console.error(recipe);
    throw new RecipeError("Invalid recipe format. Expected an object following the Recipe type.");
  }

  return {
    name: recipe.name,
    eq: recipe.eq.trim(),
    variables: recipe.variables,
  };
}

/**
 * Cleans up a user made recipe from the form into a db friendly Recipe
 * Throws a somewhat user-friendly RecipeError if the recipe is invalid, so catching and displaying any errors is recommended.
 */
export function cleanRecipe(recipe: JSONValue): Recipe {
  if (!isRecipe(recipe)) {
    throw new RecipeError("Invalid recipe format. Did not match the Recipe type.");
  }

  const parsedRecipe: Recipe = {} as Recipe;

  /** 
   * Cast and clean variables
   */
  const parsedVariables: Record<string, RecipeVariable> = { ...recipe.variables };

  /** 
   * Return the parsed recipe
   */
  parsedRecipe.eq = recipe.eq.trim();
  parsedRecipe.variables = parsedVariables;
  return parsedRecipe;
}
/** 
 * Returning null means the evaluation was cancelled without errors.
 */
export async function evaluateRecipe(recipe: Recipe, warnings: string[]): Promise<DateValuesWithUnit | null> {
  const smartRecipe = SmartRecipe.fromRecipe(recipe);
  return await smartRecipe.evaluate(warnings);
}