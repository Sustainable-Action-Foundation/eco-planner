"use client";

import { Recipe } from "@/functions/recipe-parser/types";
import type { DataSeriesValueFields } from "@/types";
import { createContext, useContext, useEffect, useState } from "react";
 
import { evaluateRecipe, cleanRecipe } from "@/functions/parseRecipe";
 
type RecipeContextType = {
  recipe: Recipe | null;
  setRecipe: React.Dispatch<React.SetStateAction<Recipe | null>>;
  warnings: string[];
  error: string | null;
  resultingDataSeries: Partial<DataSeriesValueFields> | null;
  resultingUnit: string | null | undefined;
}

export const RecipeContext = createContext<RecipeContextType | null>(null);
export function useRecipe() {
  const context = useContext(RecipeContext);
  if (!context) {
    throw new Error("useRecipe must be used within a RecipeContextProvider");
  }
  return context;
}

export function RecipeContextProvider({
  initialRecipe,
  children,
}: {
  initialRecipe?: Recipe;
  children: React.ReactNode;
}) {
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [resultingDataSeries, setResultingDataSeries] = useState<Partial<DataSeriesValueFields> | null>(null);
  const [resultingUnit, setResultingUnit] = useState<string | null | undefined>(null);

  useEffect(() => {
    if (initialRecipe) {
      setRecipe(initialRecipe);
    }
  }, [initialRecipe]);

  useEffect(() => {
    if (!recipe) {
      setResultingDataSeries(null);
      setResultingUnit(null);
      setError(null);
      setWarnings([]);
      return;
    }

    async function calculate() {
      try {
        const currentWarnings: string[] = [];
        const evaluatedRecipe = await evaluateRecipe(cleanRecipe(recipe), currentWarnings);
        setResultingDataSeries(evaluatedRecipe.dataSeries);
        setResultingUnit(evaluatedRecipe.unit)
        setWarnings(currentWarnings);
        setError(null);
      } catch (e: unknown) {
        setResultingDataSeries(null);
        setError((e as Error)?.message);
        setWarnings([]);
      }
    }
    calculate().catch(e => { throw e; });
  }, [recipe]);

  return (
    <RecipeContext.Provider value={{ recipe, setRecipe, warnings, error, resultingDataSeries, resultingUnit }}>
      {children}
    </RecipeContext.Provider>
  );
}
 