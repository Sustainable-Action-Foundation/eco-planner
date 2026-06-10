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
  // Serialize async recipe updates so rapid edits cannot overwrite each other.
  const recipeUpdateQueueRef = useRef<Promise<void>>(Promise.resolve());
  const recipeUpdateGenerationRef = useRef<number>(0);

  /** 
   * Canonical recipe for this context
   */
  const canonicalRecipeRef = useRef<Recipe>(initialRecipe
    ? Recipe.from(initialRecipe)
    : Recipe.getEmpty(),
  );

  /** 
   * Update to push to UI
   */
  const [publishedRecipe, setPublishedRecipe] = useState<Recipe>(initialRecipe
    ? Recipe.from(initialRecipe)
    : Recipe.getEmpty());

  const equation = useMemo(() => publishedRecipe.equation, [publishedRecipe]);
  const variables = useMemo(() => publishedRecipe.variables, [publishedRecipe]);
  const getVariable = useCallback((
    variableId: string,
    expectedType?: RecipeDataTypes,
  ) => {
    const variable = publishedRecipe.variableMap[variableId];
    if (!variable) return undefined;
    if (expectedType && variable.type !== expectedType) return undefined;
    return variable;
  }, [publishedRecipe]);

  const clearRecipe = useCallback(() => {
    recipeUpdateGenerationRef.current += 1;
    recipeUpdateQueueRef.current = Promise.resolve();
    canonicalRecipeRef.current = Recipe.getEmpty();
    setPublishedRecipe(Recipe.getEmpty());
  }, []);

  const applyRecipeUpdate = useCallback((recipeUpdate: SetStateAction<Recipe>): Promise<void> => {
    const generationAtSchedule = recipeUpdateGenerationRef.current;

    const queuedUpdate = async (): Promise<void> => {
      if (generationAtSchedule !== recipeUpdateGenerationRef.current) return;

      const baseRecipe = canonicalRecipeRef.current;
      const candidateRecipe = typeof recipeUpdate === "function"
        ? recipeUpdate(baseRecipe.copy())
        : recipeUpdate;

      let validatedRecipe: Recipe;

      if (!candidateRecipe) {
        console.warn("Deprecation warning: you should not delete recipes by setting them to null. This is not allowed type-wise so please check your typing.");
        validatedRecipe = Recipe.getEmpty();
      }
      else {
        validatedRecipe = Recipe.from(candidateRecipe);
      }

      // Validate
      const validity = await validatedRecipe.checkValidity();
      if (generationAtSchedule !== recipeUpdateGenerationRef.current) return;

      if (!validity.good) {
        if (validity.warnings?.length)
          console.warn("Warning produced after validity check in applyRecipeUpdate:", validity.warnings);
        setWarnings(validity.warnings ?? []);
        setError(validity.error || "Recipe is invalid");
      }

      canonicalRecipeRef.current = validatedRecipe;
      setPublishedRecipe(validatedRecipe);
    };

    const nextQueuedUpdate = recipeUpdateQueueRef.current.then(queuedUpdate);
    recipeUpdateQueueRef.current = nextQueuedUpdate.catch(() => undefined);
    return nextQueuedUpdate;
  }, []);

  const updateEquation = useCallback((equationUpdate: SetStateAction<Recipe["equation"]>) => {
    applyRecipeUpdate((current) => {
      const nextEquation = typeof equationUpdate === "function"
        ? equationUpdate(current.equation)
        : equationUpdate;
      const recipeWithUpdatedEquation = current.copy();
      recipeWithUpdatedEquation.equation = nextEquation;
      return recipeWithUpdatedEquation;
    })
      .catch((e: unknown) => {
        const errorMessage = e instanceof Error ? e.message : String(e);
        console.error("Failed to update equation:", errorMessage);
        setError(errorMessage);
      });
  }, [applyRecipeUpdate]);

  const upsertVariable = useCallback((variableId: string, variableUpdate: SetStateAction<RecipeVariable> | null): void => {
    applyRecipeUpdate((current) => {
      const candidateRecipe = current.copy();
      const existingVariable = candidateRecipe.variableMap[variableId];

      if (variableUpdate === null) {
        if (!existingVariable) {
          console.info(`Variable "${variableId}" not deleted because it does not exist.`);
          return current;
        }
        candidateRecipe.variables = candidateRecipe.variables.filter(variable => variable.id !== variableId);
        return candidateRecipe;
      }

      const nextVariable = typeof variableUpdate === "function"
        ? variableUpdate(candidateRecipe.variableMap[variableId])
        : variableUpdate;

      if (!nextVariable) {
        throw new RecipeError(`upsertVariable was called with null or undefined variableUpdate for variable "${variableId}". To delete a variable, set variableUpdate to null explicitly.`);
      }

      // Avoid updating on no change
      if (Recipe.isVariableEqual(existingVariable, nextVariable)) {
        console.info(`Variable "${variableId}" not updated because the new value is the same as the old value.`);
        return current;
      }

      candidateRecipe.variables = candidateRecipe.variableMap[variableId]
        // Update existing variable
        ? candidateRecipe.variables.map(v => v.id === variableId
          ? { ...nextVariable, template: false }
          : v,
        )
        // Or append new variable
        : [...candidateRecipe.variables, { ...nextVariable, template: false }];
      return candidateRecipe;
    })
      .catch((e: unknown) => {
        const errorMessage = e instanceof Error ? e.message : String(e);
        console.error(`Failed to upsert variable "${variableId}":`, errorMessage);
        setError(errorMessage);
      });
  }, [applyRecipeUpdate]);

  const replaceVariables = useCallback((variablesUpdate: SetStateAction<RecipeVariable[]>) => {
    applyRecipeUpdate((current) => {
      const candidateRecipe = current.copy();
      const oldVars = candidateRecipe.variables;
      const nextVars = typeof variablesUpdate === "function"
        ? variablesUpdate(oldVars)
        : variablesUpdate;

      if (Recipe.areVariablesEqual(oldVars, nextVars)) {
        console.info(`Variables not updated because the new value is the same as the old value.`);
        return current;
      }

      candidateRecipe.variables = nextVars.map(v => ({ ...v, template: false }));
      return candidateRecipe;
    })
      .catch((e: unknown) => {
        const errorMessage = e instanceof Error ? e.message : String(e);
        console.error("Failed to replace variables:", errorMessage);
        setError(errorMessage);
      });
  }, [applyRecipeUpdate]);

  const debouncedRecipe = useDebounce(publishedRecipe, 500)[0];

  // Evaluate recipe and update resulting data and unit, whenever recipe changes
  useEffect(() => {
    let isEffectActive = true;

    if (debouncedRecipe.isTemplate()) {
      return () => {
        setResultingDataSeries(null);
        setResultingUnit(null);
        setWarnings([]);
        setError(null);
      };
    }

    const warnings: string[] = [];
    debouncedRecipe.evaluate(warnings)
      .then(result => {
        if (!isEffectActive) return;

        setResultingDataSeries(result?.dateValues ?? null);
        setResultingUnit(result?.unit ?? null);
        setWarnings(warnings);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!isEffectActive) return;

        const errorMessage = e instanceof Error ? e.message : String(e);
        console.warn("Failed to evaluate recipe:", errorMessage);

        setResultingDataSeries(null);
        setResultingUnit(null);
        setWarnings(warnings);
        setError(errorMessage);
      });

    return () => {
      isEffectActive = false;
    };
  }, [debouncedRecipe]);

  return (
    <RecipeContext.Provider value={{
      recipe: publishedRecipe,
      clearRecipe,
      applyRecipeUpdate,
      resultingDataSeries,
      resultingUnit,
      equation,
      updateEquation,
      getVariable,
      upsertVariable,
      variables,
      replaceVariables,
      warnings,
      error,
    }}>
      {isDebug ? <div
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
        </div> : null}

      {children}
    </RecipeContext.Provider>
  );
}
