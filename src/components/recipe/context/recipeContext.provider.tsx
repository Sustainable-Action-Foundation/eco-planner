"use client";

import { RecipeError } from "@/functions/recipe/types";
import type { RecipeVariable } from "@/functions/recipe/types";
import type { DateValuesWithUnit } from "@/types";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Recipe } from "@/functions/recipe/recipe";
import type { SetStateAction } from "./recipeContext.internal";
import { RecipeContext } from "./recipeContext.internal";
import { useSearchParams } from "next/navigation";

export function RecipeContextProvider({
  initialRecipe,
  children,
}: {
  initialRecipe?: Recipe;
  children: React.ReactNode;
}) {
  const searchParams = useSearchParams();
  const isDebug = useMemo(() => searchParams.get("debug") === "true", [searchParams]);

  const [recipe, setRecipeState] = useState<Recipe>(() =>
    initialRecipe
      ? Recipe.from(initialRecipe)
      : Recipe.getEmpty()
  );
  const [resultingSeries, setResultingSeries] = useState<DateValuesWithUnit | null>(null);

  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setErrorState] = useState<string | null>(null);

  const setError = useCallback((reason: unknown) => {
    const errorMessage = reason instanceof Error ? reason.message : String(reason);
    setErrorState(errorMessage);
  }, []);

  const clearRecipe = useCallback(() => {
    setRecipeState(Recipe.getEmpty());
  }, []);

  const setRecipe = useCallback(async (valueOrSetter: SetStateAction<Recipe>): Promise<void> => {
    const currentRecipe = recipe;

    const newRecipe = typeof valueOrSetter === "function"
      ? valueOrSetter(currentRecipe.copy())
      : valueOrSetter;

    let nextRecipe: Recipe;

    if (!newRecipe) {
      console.warn("Deprecation warning: you should not delete recipes by setting them to null. This is not allowed type-wise so please check your typing.");
      nextRecipe = Recipe.getEmpty();
    }
    else {
      nextRecipe = Recipe.from(newRecipe);
    }

    // Validate
    const validity = await nextRecipe.checkValidity();
    if (!validity.good) {
      console.warn("Warning produced after validity check in setRecipe:", validity.warnings);
      throw new RecipeError(`Failed to set recipe: ${validity.error || "Recipe is invalid"}`);
    }

    setRecipeState(nextRecipe);
  }, [recipe]);

  const runRecipeUpdate = useCallback((recipeUpdater: (nextRecipe: Recipe) => void): void => {
    const nextRecipe = recipe.copy();
    recipeUpdater(nextRecipe);
    setRecipe(nextRecipe)
      .catch(setError);
  }, [recipe, setRecipe, setError]);

  // Data series and unit
  const {
    dataSeriesFields: resultingDataSeries,
    unit: resultingUnit,
  } = useMemo(() => {
    if (!resultingSeries) return { dataSeriesFields: null, unit: null };
    const { unit, ...dataSeriesFields } = resultingSeries;
    return { dataSeriesFields, unit };
  }, [resultingSeries]);

  const equation = useMemo(() => recipe.equation, [recipe]);
  const setEquation = useCallback((valueOrSetter: SetStateAction<Recipe["equation"]>) => {
    runRecipeUpdate((nextRecipe) => {
      nextRecipe.equation = typeof valueOrSetter === "function"
        ? valueOrSetter(nextRecipe.equation)
        : valueOrSetter;
    });
  }, [runRecipeUpdate]);

  const getVariable = useCallback((variableName: string): RecipeVariable | undefined => {
    return recipe.variables[variableName];
  }, [recipe]);
  const setVariable = useCallback((variableName: string, newValue: SetStateAction<RecipeVariable>): void => {
    runRecipeUpdate((nextRecipe) => {
      nextRecipe.variables[variableName] = typeof newValue === "function"
        ? newValue(nextRecipe.variables[variableName])
        : newValue;
    });
  }, [runRecipeUpdate]);

  const variables = useMemo(() => recipe.variables, [recipe]);
  const setVariables = useCallback((variablesAction: SetStateAction<Recipe["variables"]>) => {
    runRecipeUpdate((nextRecipe) => {
      nextRecipe.variables = typeof variablesAction === "function"
        ? variablesAction(nextRecipe.variables)
        : variablesAction;
    });
  }, [runRecipeUpdate]);

  // Eval on update
  useEffect(() => {
    let isActive = true;
    const nextWarnings: string[] = [];

    async function calculate() {
      const validity = await recipe.checkValidity();
      if (!validity.good) {
        nextWarnings.push(...(validity.warnings ?? []));
        console.warn("Tried evaluating an invalid recipe in the context provider.", validity.error, validity.warnings);
        throw new RecipeError(validity.error || "Recipe is invalid");
      }

      return await recipe.evaluate(nextWarnings);
    };

    calculate()
      .then(result => {
        if (!isActive) return;
        setResultingSeries(result);
        setWarnings(nextWarnings);
        setErrorState(null);
      })
      .catch((e: unknown) => {
        if (!isActive) return;
        const errorMessage = e instanceof Error ? e.message : String(e);
        setResultingSeries(null);
        setWarnings(nextWarnings);
        setErrorState(errorMessage);
      });

    return () => {
      isActive = false;
    };
  }, [recipe]);

  return (
    <RecipeContext.Provider value={{
      recipe,
      clearRecipe,
      setRecipe: setRecipe,
      resultingDataSeries,
      resultingUnit,
      equation,
      setEquation,
      getVariable,
      setVariable,
      variables,
      setVariables,
      warnings,
      error,
    }}>
      {isDebug &&
        <pre style={{ position: "fixed", top: 0, left: 16, backgroundColor: "white", zIndex: 999, padding: "1rem", border: "1px solid black" }}>
          {recipe.toString()}
        </pre>
      }

      {children}
    </RecipeContext.Provider>
  );
}
