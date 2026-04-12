"use client";

import { RecipeError } from "@/functions/recipe/types";
import type { RecipeDataTypes, RecipeVariable, SerializedRecipe } from "@/functions/recipe/types";
import type { DateValues, UnitString } from "@/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Recipe } from "@/functions/recipe/recipe";
import type { SetStateAction } from "./recipeContext.internal";
import { RecipeContext } from "./recipeContext.internal";
import { useSearchParams } from "next/navigation";
import { useDebounce } from "use-debounce";

export function RecipeContextProvider({
  initialRecipe,
  children,
}: {
  initialRecipe?: SerializedRecipe;
  children: React.ReactNode;
}) {
  const searchParams = useSearchParams();
  const isDebug = useMemo(() => searchParams.get("debug") === "true", [searchParams]);

  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const [resultingDataSeries, setResultingDataSeries] = useState<DateValues | null>(null);
  const [resultingUnit, setResultingUnit] = useState<UnitString | null>(null);

  /** 
   * Canonical recipe for this context
   */
  const recipeRef = useRef<Recipe>(initialRecipe
    ? Recipe.from(initialRecipe)
    : Recipe.getEmpty()
  );

  /** 
   * Update to push to UI
   */
  const [outputRecipe, setOutputRecipe] = useState<Recipe>(initialRecipe
    ? Recipe.from(initialRecipe)
    : Recipe.getEmpty());

  const equation = useMemo(() => outputRecipe.equation, [outputRecipe]);
  const variables = useMemo(() => outputRecipe.variables, [outputRecipe]);
  const getVariable = useCallback((
    variableId: string,
    expectedType?: RecipeDataTypes,
  ) => {
    const variable = outputRecipe.variableMap[variableId];
    if (!variable) return undefined;
    if (expectedType && variable.type !== expectedType) return undefined;
    return variable;
  }, [outputRecipe]);

  const clearRecipe = useCallback(() => {
    recipeRef.current = Recipe.getEmpty();
    setOutputRecipe(Recipe.getEmpty());
  }, []);

  const setRecipe = useCallback(async (valueOrSetter: SetStateAction<Recipe>): Promise<void> => {
    const currentRecipe = recipeRef.current;

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
      if (validity.warnings?.length)
        console.warn("Warning produced after validity check in setRecipe:", validity.warnings);
      setWarnings(validity.warnings ?? []);
      setError(validity.error || "Recipe is invalid");
    }

    recipeRef.current = nextRecipe;
    setOutputRecipe(nextRecipe);
  }, []);

  const setEquation = useCallback((valueOrSetter: SetStateAction<Recipe["equation"]>) => {
    const currentRecipe = recipeRef.current;
    const newEquation = typeof valueOrSetter === "function"
      ? valueOrSetter(currentRecipe.equation)
      : valueOrSetter;

    setRecipe((current) => {
      const next = current.copy();
      next.equation = newEquation;
      return next;
    })
      .catch((e: unknown) => {
        const errorMessage = e instanceof Error ? e.message : String(e);
        console.error("Failed to set equation:", errorMessage);
        setError(errorMessage);
      });
  }, [setRecipe]);

  const setVariable = useCallback((variableId: string, newValue: SetStateAction<RecipeVariable> | null): void => {
    setRecipe((current) => {
      const next = current.copy();
      const oldVar = next.variableMap[variableId];

      if (newValue === null) {
        if (!oldVar) {
          console.info(`Variable "${variableId}" not deleted because it does not exist.`);
          return current;
        }
        next.variables = next.variables.filter(variable => variable.id !== variableId);
        return next;
      }

      const newVar = typeof newValue === "function"
        ? newValue(next.variableMap[variableId])
        : newValue;

      if (!newVar) {
        throw new RecipeError(`setVariable was called with null or undefined newValue for variable "${variableId}". To delete a variable, set newValue to null explicitly.`);
      }

      // Avoid updating on no change
      if (Recipe.isVariableEqual(oldVar, newVar)) {
        console.info(`Variable "${variableId}" not updated because the new value is the same as the old value.`);
        return current;
      }

      next.variableMap[variableId] = newVar;
      return next;
    })
      .catch((e: unknown) => {
        const errorMessage = e instanceof Error ? e.message : String(e);
        console.error(`Failed to set variable "${variableId}":`, errorMessage);
        setError(errorMessage);
      });
  }, [setRecipe]);

  const setVariables = useCallback((variablesAction: SetStateAction<RecipeVariable[]>) => {
    setRecipe((current) => {
      const next = current.copy();
      const oldVars = next.variables;
      const newVars = typeof variablesAction === "function"
        ? variablesAction(oldVars)
        : variablesAction;

      if (Recipe.isVariablesEqual(oldVars, newVars)) {
        console.info(`Variables not updated because the new value is the same as the old value.`);
        return current;
      }

      next.variables = newVars;
      return next;
    })
      .catch((e: unknown) => {
        const errorMessage = e instanceof Error ? e.message : String(e);
        console.error("Failed to set variables:", errorMessage);
        setError(errorMessage);
      });
  }, [setRecipe]);

  const updatedDebounce = useDebounce(outputRecipe, 500)[0];

  // Evaluate recipe and update resulting data and unit, whenever recipe changes
  useEffect(() => {
    let isCurrent = true;

    if (updatedDebounce.isTemplate()) {
      return () => {
        setResultingDataSeries(null);
        setResultingUnit(null);
        setWarnings([]);
        setError(null);
      };
    }

    const warnings: string[] = [];
    updatedDebounce.evaluate(warnings)
      .then(result => {
        if (!isCurrent) return;

        setResultingDataSeries(result?.dateValues ?? null);
        setResultingUnit(result?.unit ?? null);
        setWarnings(warnings);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!isCurrent) return;

        const errorMessage = e instanceof Error ? e.message : String(e);
        console.warn("Failed to evaluate recipe:", errorMessage);

        setResultingDataSeries(null);
        setResultingUnit(null);
        setWarnings(warnings);
        setError(errorMessage);
      });

    return () => {
      isCurrent = false;
    };
  }, [updatedDebounce]);

  return (
    <RecipeContext.Provider value={{
      recipe: outputRecipe,
      clearRecipe,
      setRecipe,
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
      {isDebug && (
        <div
          style={{
            display: "flex",
            flexDirection: "column-reverse",
            alignItems: "flex-end",
            position: "fixed",
            right: 24,
            bottom: 24,
            zIndex: 9999,
            pointerEvents: "none",
          }}
        >
          <pre
            style={{
              position: "relative",
              background: "white",
              padding: "1rem",
              border: "1px solid #bbb",
              borderRadius: 10,
              boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
              maxWidth: 420,
              maxHeight: "40vh",
              overflow: "auto",
              fontSize: "0.95em",
              fontFamily: "monospace",
              opacity: 0.97,
              marginBottom: 12,
              pointerEvents: "auto",
            }}
          >
            {JSON.stringify({
              equation,
              variables,
              resultingUnit,
              resultingDataSeries,
              error,
              warnings,
            }, null, 2)}
          </pre>
        </div>
      )}

      {children}
    </RecipeContext.Provider>
  );
}
