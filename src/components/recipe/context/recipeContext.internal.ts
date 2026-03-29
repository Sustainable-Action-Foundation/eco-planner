import type { SmartRecipe } from "@/functions/recipe/recipe";
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
  recipe: SmartRecipe;
  resultingDataSeries: DateValues | null;
  resultingUnit: string | null | undefined;

  warnings: string[];
  error: string | null;

  clearRecipe: () => void;
  setRecipe: (valueOrSetter: SetStateAction<SmartRecipe>) => Promise<void>;

  equation: SmartRecipe["equation"];
  setEquation: (valueOrSetter: SetStateAction<SmartRecipe["equation"]>) => void;

  variables: SmartRecipe["variables"];
  setVariables: (valueOrSetter: SetStateAction<SmartRecipe["variables"]>) => void;

  getVariable: (variableName: string) => RecipeVariable | undefined;
  setVariable: (variableName: string, newValue: SetStateAction<RecipeVariable>) => void;
};
export const RecipeContext = createContext<RecipeContextType | null>(null);
