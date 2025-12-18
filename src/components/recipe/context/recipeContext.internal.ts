import { SmartRecipe } from "@/functions/recipe/smartRecipe";
import { Recipe, RecipeIsh, RecipeVariable } from "@/functions/recipe/types";
import { DataSeriesValueFields } from "@/types";
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
  smartRecipe: SmartRecipe;
  recipe: Recipe;
  resultingDataSeries: DataSeriesValueFields | null;
  resultingUnit: string | null | undefined;

  warnings: string[];
  error: string | null;

  clearRecipe: () => void;
  setSmartRecipe: (valueOrSetter: SetStateAction<RecipeIsh>) => Promise<void>;

  equation: Recipe["eq"];
  setEquation: (valueOrSetter: SetStateAction<Recipe["eq"]>) => void;

  getVariable: (variableName: string) => RecipeVariable | undefined;
  setVariable: (variableName: string, newValue: SetStateAction<RecipeVariable>) => void;

  variables: Recipe["variables"];
  setVariables: (valueOrSetter: SetStateAction<Recipe["variables"]>) => void;
};
export const RecipeContext = createContext<RecipeContextType | null>(null);
