"use client";

import { RecipeError } from "@/functions/recipe/types";
import type { RecipeDataTypes, RecipeVariable, SerializedRecipe } from "@/functions/recipe/types";
import { externalSelectionKey } from "@/functions/recipe/extractors";
import getTableContent from "@/lib/api/getTableContent";
import type { ApiSelectionItem, ApiTableContent } from "@/lib/api/apiTypes";
import { clientSafeGetOneDataSeries } from "@/fetchers/client";
import type { DataSeries, DateValues, Unit } from "@/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SetStateAction } from "react";
import { Recipe } from "@/functions/recipe/recipe";
import { RecipeContext } from "./recipeContext.internal";
import { UnitFlags } from "@/types/enums";
import { useDebounce } from "use-debounce";

/** Compact summary of a recipe in a given state, for the debug panel. */
function summarizeRecipe(recipe: Recipe) {
  const variableTypeCounts = recipe.variables.reduce<Record<string, number>>((counts, variable) => {
    counts[variable.type] = (counts[variable.type] ?? 0) + 1;
    return counts;
  }, {});
  return {
    name: recipe.name,
    equation: recipe.equation,
    variableCount: recipe.variables.length,
    variableTypeCounts,
    isTemplate: recipe.isTemplate(),
    isSuggested: recipe.isSuggestedRecipe(),
  };
}

export function RecipeContextProvider({
  initialRecipe,
  availableDataSeries,
  children,
}: {
  initialRecipe?: SerializedRecipe;
  /** Source data series already loaded with the recipe (its `sourceDataSeries`),
   * used as canon so evaluation reads them instead of re-fetching. */
  availableDataSeries?: DataSeries[];
  children: React.ReactNode;
}) {
  // Debug panel: toggled with Alt+D (no search param, so editor state is preserved).
  const [isDebug, setIsDebug] = useState(false);
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.altKey && (event.code === "KeyD" || event.key.toLowerCase() === "d")) {
        event.preventDefault();
        setIsDebug(previous => !previous);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const [resultingDataSeries, setResultingDataSeries] = useState<DateValues | null>(null);
  const [resultingUnit, setResultingUnit] = useState<Unit>(UnitFlags.Missing);
  // Serialize async recipe updates so rapid edits cannot overwrite each other.
  const recipeUpdateQueueRef = useRef<Promise<void>>(Promise.resolve());
  const recipeUpdateGenerationRef = useRef<number>(0);

  // Cache external dataset fetches for this editing session, keyed on the
  // selection. Unrelated edits (equation, other variables) reuse the cached data;
  // an external variable is only re-fetched when its own selection changes.
  const externalContentCacheRef = useRef<Map<string, Promise<ApiTableContent | null>>>(new Map());
  const getCachedExternalContent = useCallback(
    (tableId: string, dataset: string, selection: ApiSelectionItem[]) => {
      const key = externalSelectionKey(dataset, tableId, selection);
      const cache = externalContentCacheRef.current;
      const cached = cache.get(key);
      if (cached) return cached;

      const request = getTableContent(tableId, dataset, selection).catch((err: unknown) => {
        cache.delete(key); // Don't cache failures, so a later attempt can retry.
        throw err;
      });
      cache.set(key, request);
      return request;
    },
    [],
  );

  // Resolve data series (and materialized external data) from those loaded with
  // the recipe; fall back to a DB read only if one is missing.
  const availableDataSeriesMap = useMemo(
    () => new Map((availableDataSeries ?? []).map(dataSeries => [dataSeries.id, dataSeries])),
    [availableDataSeries],
  );
  const getDataSeries = useCallback(
    (dataSeriesId: string): Promise<DataSeries | null> => {
      const available = availableDataSeriesMap.get(dataSeriesId);
      if (available) return Promise.resolve(available);
      return clientSafeGetOneDataSeries(dataSeriesId);
    },
    [availableDataSeriesMap],
  );

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
  // Build the variable map once per published recipe; the getter rebuilds it on every access.
  const variableMap = useMemo(() => publishedRecipe.variableMap, [publishedRecipe]);
  const getVariable = useCallback((
    variableId: string,
    expectedType?: RecipeDataTypes,
  ) => {
    const variable = variableMap[variableId];
    if (!variable) return undefined;
    if (expectedType && variable.type !== expectedType) return undefined;
    return variable;
  }, [variableMap]);

  const clearRecipe = useCallback(() => {
    recipeUpdateGenerationRef.current += 1;
    recipeUpdateQueueRef.current = Promise.resolve();
    canonicalRecipeRef.current = Recipe.getEmpty();
    setPublishedRecipe(Recipe.getEmpty());
  }, []);

  const applyRecipeUpdate = useCallback((recipeUpdate: SetStateAction<Recipe>): Promise<void> => {
    const generationAtSchedule = recipeUpdateGenerationRef.current;

    const queuedUpdate = (): void => {
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

      if (Recipe.areRecipesEqual(baseRecipe, validatedRecipe)) {
        return;
      }

      canonicalRecipeRef.current = validatedRecipe;
      setPublishedRecipe(validatedRecipe);
    };

    const nextQueuedUpdate = recipeUpdateQueueRef.current.then(() => queuedUpdate());
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
      .catch((err: unknown) => {
        const errorMessage = err instanceof Error ? err.message : String(err);
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
          return current;
        }
        candidateRecipe.variables = candidateRecipe.variables.filter(variable => variable.id !== variableId);
        return candidateRecipe;
      }

      const nextVariable = typeof variableUpdate === "function"
        ? variableUpdate(existingVariable)
        : variableUpdate;

      if (!nextVariable) {
        throw new RecipeError(`upsertVariable was called with null or undefined variableUpdate for variable "${variableId}". To delete a variable, set variableUpdate to null explicitly.`);
      }

      // Avoid updating on no change
      if (Recipe.isVariableEqual(existingVariable, nextVariable)) {
        return current;
      }

      candidateRecipe.variables = existingVariable
        // Update existing variable
        ? candidateRecipe.variables.map(v => v.id === variableId
          ? { ...nextVariable, template: false }
          : v,
        )
        // Or append new variable
        : [...candidateRecipe.variables, { ...nextVariable, template: false }];
      return candidateRecipe;
    })
      .catch((err: unknown) => {
        const errorMessage = err instanceof Error ? err.message : String(err);
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
        return current;
      }

      candidateRecipe.variables = nextVars.map(v => ({ ...v, template: false }));
      return candidateRecipe;
    })
      .catch((err: unknown) => {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error("Failed to replace variables:", errorMessage);
        setError(errorMessage);
      });
  }, [applyRecipeUpdate]);

  const debouncedRecipe = useDebounce(publishedRecipe, 500)[0];
  // The recipe whose evaluation results currently sit in state; null until the
  // first evaluation (or template reset) lands.
  const [lastEvaluatedRecipe, setLastEvaluatedRecipe] = useState<Recipe | null>(null);
  // True while the resulting data/unit lag behind the published recipe: a change
  // is inside the debounce window, the evaluation effect hasn't run yet, or an
  // evaluation is in flight. Consumers (e.g. submit handlers reading FormSync's
  // outputs) wait for this to settle. Compared against the last *evaluated*
  // recipe rather than the debounced one on purpose: the debounced state commits
  // a render before the evaluation effect runs, and passive effects can lag far
  // behind under load — comparing against the debounced recipe reports "settled"
  // inside that gap while the results are still stale.
  const isEvaluationPending = lastEvaluatedRecipe === null
    || !Recipe.areRecipesEqual(publishedRecipe, lastEvaluatedRecipe);

  // Evaluate recipe and update resulting data and unit, whenever recipe changes
  useEffect(() => {
    let isEffectActive = true;
    if (debouncedRecipe.isTemplate()) {
      // Nothing to evaluate: the cleared results ARE this recipe's results.
      setLastEvaluatedRecipe(debouncedRecipe);
      return () => {
        setResultingDataSeries(null);
        setResultingUnit(debouncedRecipe.unit); // declared unit survives even if recipe cannot be evaluated
        setWarnings([]);
        setError(null);
      };
    }

    const warnings: string[] = [];
    debouncedRecipe.evaluate(warnings, { externalTableContentGetter: getCachedExternalContent, dataSeriesGetter: getDataSeries })
      .then(result => {
        if (!isEffectActive) return;

        setResultingDataSeries(result?.dateValues ?? null);
        setResultingUnit(result?.unit ?? UnitFlags.Missing);
        setWarnings(warnings);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!isEffectActive) return;

        const errorMessage = err instanceof Error ? err.message : String(err);
        console.warn("Failed to evaluate recipe:", errorMessage);

        setResultingDataSeries(null);
        setResultingUnit(debouncedRecipe.unit); // declared unit survives even if recipe cannot be evaluated
        setWarnings(warnings);
        setError(errorMessage);
      })
      .finally(() => {
        if (!isEffectActive) return;
        // Whether it succeeded or errored, the results in state now belong to
        // this recipe; superseded evaluations (isEffectActive false) don't count.
        setLastEvaluatedRecipe(debouncedRecipe);
      });

    return () => {
      isEffectActive = false;
    };
  }, [debouncedRecipe, getCachedExternalContent, getDataSeries]);

  return (
    <RecipeContext.Provider value={{
      recipe: publishedRecipe,
      clearRecipe,
      applyRecipeUpdate,
      resultingDataSeries,
      resultingUnit,
      isEvaluationPending,
      equation,
      updateEquation,
      getVariable,
      upsertVariable,
      variables,
      replaceVariables,
      warnings,
      error,
    }}>
      {isDebug ? (() => {
        // Live view uses published (UI) + debounced (evaluated) state only; the
        // canonical ref is read in the dump handler (refs must not be read in render).
        const debugInfo = {
          pendingEvaluation: !Recipe.areRecipesEqual(publishedRecipe, debouncedRecipe),
          states: {
            published: summarizeRecipe(publishedRecipe),
            debounced: summarizeRecipe(debouncedRecipe),
          },
          availableDataSeries: {
            count: availableDataSeries?.length ?? 0,
            ids: (availableDataSeries ?? []).map(dataSeries => dataSeries.id),
          },
          evaluation: { resultingUnit, error, warnings, resultingDataSeries },
          variables,
        };

        const dump = () => {
          const serializeSafe = (recipe: Recipe) => {
            try { return recipe.serialize(); }
            catch (err) { return `<<serialize error: ${err instanceof Error ? err.message : String(err)}>>`; }
          };
          // Read the canonical ref here (event handler) and include it in the dump.
          const canonical = canonicalRecipeRef.current;
          const fullDump = {
            ...debugInfo,
            canonicalEqualsPublished: Recipe.areRecipesEqual(canonical, publishedRecipe),
            states: { canonical: summarizeRecipe(canonical), ...debugInfo.states },
            serialized: {
              canonical: serializeSafe(canonical),
              published: serializeSafe(publishedRecipe),
              debounced: serializeSafe(debouncedRecipe),
            },
          };
          console.debug("[Recipe debug] dump", fullDump);
          void navigator.clipboard?.writeText(JSON.stringify(fullDump, null, 2)).catch(() => undefined);
        };

        return (
          <div
            style={{
              position: "fixed",
              right: 24,
              bottom: 24,
              zIndex: 9999,
              width: 440,
              maxWidth: "calc(100vw - 48px)",
              display: "flex",
              flexDirection: "column",
              background: "white",
              border: "1px solid #bbb",
              borderRadius: 10,
              boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
              opacity: 0.97,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "0.5rem 0.75rem",
                borderBottom: "1px solid #ddd",
                fontFamily: "monospace",
                fontSize: "0.85em",
              }}
            >
              <strong style={{ flexGrow: 1 }}>
                Recipe debug
                {debugInfo.pendingEvaluation ? " · evaluating…" : ""}
              </strong>
              <button type="button" onClick={dump} style={{ transform: "none", padding: "0.2rem 0.5rem", fontSize: "0.85em" }}>
                Dump (log + copy)
              </button>
              <button type="button" onClick={() => setIsDebug(false)} aria-label="Close debug panel" style={{ transform: "none", padding: "0.2rem 0.5rem", fontSize: "0.85em" }}>
                ✕
              </button>
            </div>
            <pre
              style={{
                margin: 0,
                padding: "0.75rem",
                maxHeight: "45vh",
                overflow: "auto",
                fontSize: "0.8em",
                fontFamily: "monospace",
              }}
            >
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          </div>
        );
      })() : null}

      {children}
    </RecipeContext.Provider>
  );
}
