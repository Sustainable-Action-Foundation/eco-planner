import type { Recipe } from "@/functions/recipe/recipe";
import type { RecipeDataTypes, RecipeVariable } from "@/functions/recipe/types";
import type { DateValues } from "@/types";
import { createContext } from "react";

/** 
 * A function exposing a previous version of itself to assist in updating its value
 */
type Historic<T> = (prev: T) => T;
/** 
 * A value or function used on setters
 */
export type SetStateAction<T> = T | Historic<T>;

type VariableByType<TType extends RecipeDataTypes> = Extract<RecipeVariable, { type: TType }>;

export type GetVariable = {
  (variableId: string): RecipeVariable | undefined;
  <TType extends RecipeDataTypes>(variableId: string, expectedType: TType): VariableByType<TType> | undefined;
};

export type RecipeContextType = {
  recipe: Recipe;
  resultingDataSeries: DateValues | null;
  resultingUnit: string | null | undefined;

  warnings: string[];
  error: string | null;

  clearRecipe: () => void;
  applyRecipeUpdate: (recipeUpdate: SetStateAction<Recipe>) => Promise<void>;

  equation: Recipe["equation"];
  updateEquation: (equationUpdate: SetStateAction<Recipe["equation"]>) => void;

  variables: RecipeVariable[];
  replaceVariables: (variablesUpdate: SetStateAction<RecipeVariable[]>) => void;

  getVariable: GetVariable;
  upsertVariable: (variableId: string, variableUpdate: SetStateAction<RecipeVariable> | null) => void;
};
export const RecipeContext = createContext<RecipeContextType | null>(null);
