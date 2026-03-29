"use client";

import { RecipeError } from "@/functions/recipe/types";
import type { RecipeVariable } from "@/functions/recipe/types";
import type { DateValuesWithUnit } from "@/types";
import { useEffect, useMemo, useState } from "react";
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

  const [recipeEntryPoint, setRecipeEntryPoint] = useState<Recipe>(
    !!initialRecipe
      ? Recipe.from(initialRecipe)
      : Recipe.getEmpty()
  );

  /**
   * The only source of truth is this Recipe instance.
   */
  const recipe = useMemo(() =>
    recipeEntryPoint instanceof Recipe
      ? recipeEntryPoint
      : recipeEntryPoint
        ? Recipe.from(recipeEntryPoint)
        : Recipe.getEmpty()
    , [recipeEntryPoint]);

  const clearRecipe = () => {
    setRecipeEntryPoint(Recipe.getEmpty());
  };

  const setRecipe = async (valueOrSetter: SetStateAction<Recipe>): Promise<void> => {
    let newInstance: Recipe | null;

    const newRecipe = typeof valueOrSetter === "function"
      ? valueOrSetter(recipe.copy()) // Run users function on prev and use result
      : valueOrSetter;

    if (!newRecipe) {
      console.warn("Deprecation warning: you should not delete recipes by setting them to null. This is not allowed type-wise so please check your typing.");
      newInstance = Recipe.getEmpty();
    }
    else if (newRecipe instanceof Recipe) {
      newInstance = Recipe.from(newRecipe);
    }
    else {
      newInstance = Recipe.from(newRecipe);
    }

    if (!newInstance) {
      throw new RecipeError("Failed to set recipe: invalid format");
    }

    // Validate
    const validity = await newInstance.checkValidity();
    if (!validity.good) {
      throw new RecipeError(`Failed to set recipe: ${validity.error || "Recipe is invalid"}`);
    }

    setRecipeEntryPoint(newInstance);
    return;
  };

  const [resultingDataSeriesWithUnit, setResultingDataSeriesWithUnit] = useState<DateValuesWithUnit | null>(null);

  const resultingDataSeries = useMemo(() => {
    if (!resultingDataSeriesWithUnit) return null;
    const { unit, ...dataSeriesFields } = resultingDataSeriesWithUnit;
    return dataSeriesFields;
  }, [resultingDataSeriesWithUnit]);

  const resultingUnit = useMemo(() => {
    if (!resultingDataSeriesWithUnit) return null;
    return resultingDataSeriesWithUnit.unit;
  }, [resultingDataSeriesWithUnit]);

  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const equation = useMemo(() => recipe.equation, [recipe]);
  const setEquation = (valueOrSetter: SetStateAction<Recipe["equation"]>) => {
    const newEquation = typeof valueOrSetter === "function"
      ? valueOrSetter(recipe.equation)
      : valueOrSetter;

    const newRecipe = recipe.copy();
    newRecipe.equation = newEquation;
    setRecipe(newRecipe)
      .catch((e: unknown) => {
        const errorMessage = e instanceof Error ? e.message : String(e);
        setError(errorMessage);
      });
  };

  const getVariable = (variableName: string): RecipeVariable | undefined => {
    return recipe.variables[variableName];
  };
  const setVariable = (variableName: string, newValue: SetStateAction<RecipeVariable>): void => {
    const valueToSet = typeof newValue === "function"
      ? newValue(recipe.variables[variableName])
      : newValue;

    const newRecipe = recipe.copy();
    newRecipe.variables[variableName] = valueToSet;

    setRecipe(newRecipe)
      .catch((e: unknown) => {
        const errorMessage = e instanceof Error ? e.message : String(e);
        setError(errorMessage);
      });
  };

  const variables = useMemo(() => recipe.variables, [recipe]);
  const setVariables = (variablesAction: SetStateAction<Recipe["variables"]>) => {
    const newVariables = typeof variablesAction === "function"
      ? variablesAction(recipe.variables)
      : variablesAction;
    const newRecipe = recipe.copy();
    newRecipe.variables = newVariables;
    setRecipe(newRecipe)
      .catch((e: unknown) => {
        const errorMessage = e instanceof Error ? e.message : String(e);
        setError(errorMessage);
      });
  };

  // Eval on update
  useEffect(() => {
    const warnings: string[] = [];

    async function calculate() {
      if (!recipe) {
        throw new RecipeError("No recipe provided");
      }

      const validity = await recipe.checkValidity();
      if (!validity.good) {
        warnings.push(...(validity.warnings ?? []));
        console.warn("Tried evaluating an invalid recipe in the context provider.", validity.error, validity.warnings);
        throw new RecipeError(validity.error || "Recipe is invalid");
      }

      return await recipe.evaluate(warnings);
    };

    calculate()
      .then(result => {
        setResultingDataSeriesWithUnit(result);
        setWarnings(warnings);
        setError(null);
      })
      .catch((e: unknown) => {
        const errorMessage = e instanceof Error ? e.message : String(e);
        setResultingDataSeriesWithUnit(null);
        setWarnings(warnings);
        setError(errorMessage);
      });
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
        <pre style={{ position: "fixed", top: 0, left: 0, backgroundColor: "white", zIndex: 999, padding: "1rem", border: "1px solid block" }}>
          {recipe.toString()}
        </pre>
      }

      {children}
    </RecipeContext.Provider>
  );
}
