"use client";

import { Recipe, RecipeError, RecipeVariable } from "@/functions/recipe/types";
import type { DataSeriesValueFieldsWithUnit } from "@/types";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { SmartRecipe } from "@/functions/recipe/smartRecipe";

export type RecipeContextType = {
  smartRecipe: SmartRecipe;
  recipe: Recipe;
  resultingDataSeries: DataSeriesValueFieldsWithUnit | null;
  clearRecipe: () => void;
  setSmartRecipe: (recipe: Recipe | SmartRecipe | null) => Promise<void>;

  equation: Recipe["eq"];
  setEquation: (equation: Recipe["eq"]) => void;

  getVariable: (variableName: string) => RecipeVariable | undefined;
  setVariable: (variableName: string, newValue: RecipeVariable) => void;

  variables: Recipe["variables"];
  setVariables: (variables: Recipe["variables"]) => void;

  warnings: string[];
  error: string | null;
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
  initialRecipe?: Recipe | SmartRecipe;
  children: React.ReactNode;
}) {
  let smartRecipeEntryPoint = initialRecipe;

  /**
   * The only source of truth is this smartRecipe recipe instance.
   */
  const smartRecipe = useMemo(() =>
    smartRecipeEntryPoint instanceof SmartRecipe
      ? smartRecipeEntryPoint
      : smartRecipeEntryPoint
        ? SmartRecipe.fromObject(smartRecipeEntryPoint)
        : SmartRecipe.getEmpty()
    , [smartRecipeEntryPoint]);

  const clearRecipe = () => {
    setSmartRecipe(null)
      .catch(e => { throw e; });
  };

  const setSmartRecipe = async (recipe: Recipe | SmartRecipe | null): Promise<void> => {
    let newInstance: SmartRecipe | null = null;

    if (!recipe) {
      newInstance = SmartRecipe.getEmpty();
      return;
    }
    if (recipe instanceof SmartRecipe) {
      newInstance = SmartRecipe.fromSmartRecipe(recipe);
    }
    else {
      newInstance = SmartRecipe.fromRecipe(recipe);
    }

    if (!newInstance) {
      throw new RecipeError("Failed to set recipe: invalid format");
    }

    // Validate
    const validity = await newInstance.checkValidity();
    if (!validity.good) {
      throw new RecipeError(`Failed to set recipe: ${validity.error || "Recipe is invalid"}`);
    }

    // Update
    smartRecipeEntryPoint = newInstance;
  };

  // Used to force re-renders when recipe changes
  const [updatePing, setUpdatePing] = useState<number>(0);

  // Safety to avoid overflow
  useEffect(() => {
    if (updatePing > Number.MAX_SAFE_INTEGER - 1) setUpdatePing(0);
  }, [updatePing]);

  const recipe = useMemo(() => { void updatePing; return smartRecipe.toRecipe(); }, [smartRecipe, updatePing]);
  const [resultingDataSeries, setResultingDataSeries] = useState<DataSeriesValueFieldsWithUnit | null>(null);

  const equation = useMemo(() => recipe.eq, [recipe]);
  const setEquation = (equation: Recipe["eq"]) => { setUpdatePing(p => p += 1); smartRecipe.equation = equation; };

  const variables = useMemo(() => recipe.variables, [recipe]);
  const setVariables = (variables: Recipe["variables"]) => { setUpdatePing(p => p += 1); smartRecipe.variables = variables; };

  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const getVariable = (variableName: string): RecipeVariable | undefined => {
    return smartRecipe.variables[variableName];
  };
  const setVariable = (variableName: string, newValue: RecipeVariable): void => {
    setUpdatePing(p => p += 1);
    smartRecipe.variables[variableName] = newValue;
  };

  useEffect(() => {
    const warnings: string[] = [];

    async function calculate() {
      if (!smartRecipe) {
        throw new RecipeError("No recipe provided");
      }

      const validity = await smartRecipe.checkValidity();
      if (!validity.good) {
        warnings.push(...(validity.warnings || []));
        console.warn("Tried evaluating an invalid recipe in the context provider.", validity.error, validity.warnings);
        throw new RecipeError(validity.error || "Recipe is invalid");
      }

      return await smartRecipe.evaluate(warnings);
    };

    calculate()
      .then(result => {
        setResultingDataSeries(result);
        setWarnings(warnings);
        setError(null);
      })
      .catch(e => {
        setResultingDataSeries(null);
        setWarnings(warnings);
        setError((e as Error)?.message);
      });
  }, [smartRecipe]);

  return (
    <RecipeContext.Provider value={{
      smartRecipe,
      recipe,
      clearRecipe,
      setSmartRecipe,
      resultingDataSeries,
      equation,
      setEquation,
      getVariable,
      setVariable,
      variables,
      setVariables,
      warnings,
      error,
    }}>
      {children}
    </RecipeContext.Provider>
  );
}
