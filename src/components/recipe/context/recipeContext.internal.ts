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
  setRecipe: (valueOrSetter: SetStateAction<Recipe>) => Promise<void>;

  equation: Recipe["equation"];
  setEquation: (valueOrSetter: SetStateAction<Recipe["equation"]>) => void;

  variables: RecipeVariable[];
  setVariables: (valueOrSetter: SetStateAction<RecipeVariable[]>) => void;

  getVariable: GetVariable;
  setVariable: (variableId: string, newValue: SetStateAction<RecipeVariable> | null) => void;
};
export const RecipeContext = createContext<RecipeContextType | null>(null);
