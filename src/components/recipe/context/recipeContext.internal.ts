import { Recipe } from "@/functions/recipe-parser/types";
import { DataSeriesValueFields } from "@/types";
import { createContext } from "react";

export type RecipeContextType = {
  recipe: Recipe | null;
  setRecipe: React.Dispatch<React.SetStateAction<Recipe | null>>;
  warnings: string[];
  error: string | null;
  resultingDataSeries: Partial<DataSeriesValueFields> | null;
  resultingUnit: string | null | undefined;
};

export const RecipeContext = createContext<RecipeContextType | null>(null);
