import { RecipeEquationError } from "./errors.js";
import { getVariableName } from "./helpers.js";
import { UnparsedRecipe } from "./types.js";
import { validateRecipeType } from "./validation.js";

export function normalizeRecipeVariableNames(recipe: UnparsedRecipe | string, warnings: string[] = []): UnparsedRecipe {
  recipe = validateRecipeType(recipe);

  // Normalize variable names
  const renameMap: Record<string, string> = Object.fromEntries(Object.keys(recipe.variables).map((key, index) => [`${key}`, getVariableName(index)]));
  recipe.eq = recipe.eq.replace(/\$\{([\w-]+)\}/g, (_, varName) => {
    if (renameMap[varName]) {
      return `\${${renameMap[varName]}}`;
    }
    throw new RecipeEquationError(`Variable "${varName}" is used in the equation but not defined in variables.`);
  });
  recipe.variables = Object.fromEntries(Object.entries(recipe.variables).map(([key, variable]) => {
    if (!renameMap[key]) throw new RecipeEquationError(`Variable "${key}" does not exist.`);
    const normalizedKey = renameMap[key] || key; // Use the normalized name or fallback
    return [normalizedKey, variable];
  }));

  return recipe;
}
