"use client";

import { RecipeError } from "@/functions/recipe/types";
import type { Recipe, RecipeIsh, RecipeVariable } from "@/functions/recipe/types";
import type { DateValuesWithUnit } from "@/types";
import { useEffect, useMemo, useState } from "react";
import { SmartRecipe } from "@/functions/recipe/smartRecipe";
import type { SetStateAction } from "./recipeContext.internal";
import { RecipeContext } from "./recipeContext.internal";

export function RecipeContextProvider({
  initialRecipe,
  children,
}: {
  initialRecipe?: RecipeIsh;
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
    smartRecipeEntryPoint = SmartRecipe.getEmpty();
  };

  const setSmartRecipe = async (valueOrSetter: SetStateAction<RecipeIsh>): Promise<void> => {
    let newInstance: SmartRecipe | null;

    const newRecipe = typeof valueOrSetter === "function"
      ? valueOrSetter(smartRecipe.copy()) // Run users function on prev and use result
      : valueOrSetter;

    if (!newRecipe) {
      console.warn("Deprecation warning: you should not delete recipes by setting them to null. This is not allowed type-wise so please check your typing.");
      newInstance = SmartRecipe.getEmpty();
    }
    else if (newRecipe instanceof SmartRecipe) {
      newInstance = SmartRecipe.fromSmartRecipe(newRecipe);
    }
    else {
      newInstance = SmartRecipe.fromRecipe(newRecipe);
    }

    if (!newInstance) {
      throw new RecipeError("Failed to set recipe: invalid format");
    }

    // Validate
    const validity = await newInstance.checkValidity();
    if (!validity.good) {
      throw new RecipeError(`Failed to set recipe: ${validity.error || "Recipe is invalid"}`);
    }

    smartRecipeEntryPoint = newInstance;
    return;
  };

  // Used to force re-renders when recipe changes
  const [updatePing, setUpdatePing] = useState<number>(0);
  // Safety to avoid overflow
  useEffect(() => {
    if (updatePing > Number.MAX_SAFE_INTEGER - 1) setUpdatePing(0);
  }, [updatePing]);

  const recipe = useMemo(() => { void updatePing; return smartRecipe.toRecipe(); }, [smartRecipe, updatePing]);
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

  const equation = useMemo(() => recipe.eq, [recipe]);
  const setEquation = (valueOrSetter: SetStateAction<Recipe["eq"]>) => {
    const newEquation = typeof valueOrSetter === "function"
      ? valueOrSetter(smartRecipe.equation)
      : valueOrSetter;

    smartRecipe.equation = newEquation;
    setUpdatePing(p => p + 1);
  };

  const getVariable = (variableName: string): RecipeVariable | undefined => {
    return smartRecipe.variables[variableName];
  };
  const setVariable = (variableName: string, newValue: SetStateAction<RecipeVariable>): void => {
    const valueToSet = typeof newValue === "function"
      ? newValue(smartRecipe.variables[variableName])
      : newValue;

    smartRecipe.variables[variableName] = valueToSet;
    setUpdatePing(p => p + 1);
  };

  const variables = useMemo(() => recipe.variables, [recipe]);
  const setVariables = (variablesAction: SetStateAction<Recipe["variables"]>) => {
    const newVariables = typeof variablesAction === "function"
      ? variablesAction(smartRecipe.variables)
      : variablesAction;
    smartRecipe.variables = newVariables;

    setUpdatePing(p => p + 1);
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
  }, [smartRecipe]);

  return (
    <RecipeContext.Provider value={{
      smartRecipe,
      recipe,
      clearRecipe,
      setSmartRecipe,
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
      {children}
    </RecipeContext.Provider>
  );
}
