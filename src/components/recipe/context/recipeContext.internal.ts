import type { Recipe } from "@/functions/recipe/recipe";
import type { RecipeVariable } from "@/functions/recipe/types";
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

export type RecipeContextType = {
  recipe: Recipe;
  resultingDataSeries: DateValues | null;
  resultingUnit: string | null | undefined;

  warnings: string[];
  error: string | null;

  clearRecipe: () => void;
  setRecipe: (valueOrSetter: SetStateAction<Recipe>) => Promise<void>;

  equation: Recipe["equation"];
  setEquation: (valueOrSetter: SetStateAction<Recipe["equation"]>) => void;

  variables: Recipe["variables"];
  setVariables: (valueOrSetter: SetStateAction<Recipe["variables"]>) => void;

  getVariable: (variableName: string) => RecipeVariable | undefined;
  setVariable: (variableName: string, newValue: SetStateAction<RecipeVariable>) => void;
};
export const RecipeContext = createContext<RecipeContextType | null>(null);
