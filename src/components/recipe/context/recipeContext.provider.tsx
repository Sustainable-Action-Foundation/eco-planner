"use client";

import { emptyRecipe, Recipe } from "@/functions/recipe-parser/types";
import type { DataSeriesValueFields } from "@/types";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { evaluateRecipe, cleanRecipe, recipeFromUnknown } from "@/functions/parseRecipe";
import { Locales } from "i18n.config";

type RecipeContextType = {
  recipe: Recipe | null;
  setRecipe: React.Dispatch<React.SetStateAction<Recipe | null>>;
  warnings: string[];
  error: string | null;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
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
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [recipe, setRecipeState] = useState<Recipe | null>(null);
  const setRecipe: React.Dispatch<React.SetStateAction<Recipe | null>> = useCallback((action) => {
    if (typeof action === "function") {
      setRecipeState((prev) => {
        try {
          return action(prev);
        }
        catch (e) {
          setError(e instanceof Error ? e.message : String(e));
          return prev;
        }
      });
    }
    else {
      try {
        setRecipeState(action);
      }
      catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    }
  }, []);

  const [resultingDataSeries, setResultingDataSeries] = useState<Partial<DataSeriesValueFields> | null>(null);
  const [resultingUnit, setResultingUnit] = useState<string | null | undefined>(null);

  const [lastEvalDuration, setLastEvalDuration] = useState<number | null>(null);
  const [lastEvalTimestamp, setLastEvalTimestamp] = useState<string | null>(null);

  useEffect(() => {
    if (initialRecipe) {
      setRecipe(initialRecipe);
    }
  }, [initialRecipe, setRecipe]);

  useEffect(() => {
    if (!recipe) {
      setRecipe({ ...emptyRecipe });
      setResultingDataSeries(null);
      setResultingUnit(null);
      setError(null);
      setWarnings([]);
      return;
    }

    const startTime = performance.now();
    setLastEvalDuration(null);
    async function calculate() {
      try {
        const currentWarnings: string[] = [];
        const evaluatedRecipe = await evaluateRecipe(cleanRecipe(recipe), currentWarnings);
        if (!evaluatedRecipe) {
          console.warn("Recipe evaluation was canceled, likely due to empty eq");
          setResultingDataSeries(null);
          setResultingUnit(null);
          setWarnings([]);
          setError(null);
          return;
        }
        setResultingDataSeries(evaluatedRecipe.dataSeries);
        setResultingUnit(evaluatedRecipe.unit)
        setWarnings(currentWarnings);
        setError(null);
      }
      catch (e: unknown) {
        setResultingDataSeries(null);
        setError((e as Error)?.message);
        setWarnings([]);
      }
    }
    calculate()
      .catch(e => { throw e; })
      .finally(() => {
        const endTime = performance.now();
        setLastEvalDuration(endTime - startTime);
        setLastEvalTimestamp(new Date().toLocaleString());
      });
  }, [recipe, setRecipe]);

  // Register debug key bind alt+shift+d (hold to open), Escape to close
  const [showDebug, setShowDebug] = useState(false);
  const debugKeyTimerRef = useRef<number | null>(null);
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      // Check for escape key to close
      if (event.key === "Escape" && showDebug) {
        event.preventDefault();
        setShowDebug(false);
      }

      const isDebugCombo = event.altKey && event.shiftKey && event.key === "D";

      if (!isDebugCombo || showDebug) return;
      if (debugKeyTimerRef.current !== null) return;

      debugKeyTimerRef.current = window.setTimeout(() => {
        setShowDebug(true);
        debugKeyTimerRef.current = null;
      }, 500);
    }

    function handleKeyUp(event: KeyboardEvent) {
      const isRelevantKey = ["Alt", "Shift", "D"].includes(event.key);
      if (!isRelevantKey && !(event.altKey && event.shiftKey && event.key === "D")) {
        return;
      }

      if (debugKeyTimerRef.current !== null) {
        clearTimeout(debugKeyTimerRef.current);
        debugKeyTimerRef.current = null;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [showDebug]);

  // TODO: style this
  return (
    <RecipeContext.Provider value={{
      recipe,
      setRecipe,
      warnings,
      error,
      setError,
      resultingDataSeries,
      resultingUnit,
    }}>
      {showDebug &&
        <div
          style={{
            position: "relative",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: "rgba(0,0,0,0.8)",
            display: "flex",
            flexFlow: "column nowrap",
            justifyContent: "start",
            alignItems: "start",
            rowGap: "1rem",
            padding: "1rem",
            zIndex: 9999,
            color: "white",
          }}
          lang={Locales.enSE}
        >
          {/* Scrollable wall of debug info */}
          <div style={{
            overflow: "scroll",
            width: "100%",
          }}>
            <pre style={{ width: "100%", }}>
              Recipe context debug info: <br />
              {JSON.stringify({
                "eval time": lastEvalDuration + " ms",
                "eval timestamp": lastEvalTimestamp,
                warnings,
                error,
                resultingUnit,
                resultingDataSeries,
              }, null, 2)}
            </pre>

            <pre style={{ width: "100%", }}>
              Current Recipe: <br />
              {JSON.stringify(recipe, null, 2)}
            </pre>
          </div>

          {/* Buttons container */}
          <div className="flex gap-100">
            <button
              type="button"
              onClick={() => setShowDebug(false)}
            >
              Close Debug
            </button>

            <button
              type="button"
              onClick={() => {
                const toBeCopied = { recipe, resultingDataSeries, resultingUnit, warnings, error, lastEvalDuration, lastEvalTimestamp };
                navigator.clipboard.writeText(JSON.stringify(toBeCopied, null, 2))
                  .catch((e) => {
                    console.error(e);
                  });
              }}
            >
              Copy to Clipboard
            </button>

            <button
              type="button"
              onClick={() => {
                setRecipe(prev => prev ? { ...prev } : null);
              }}
            >
              Force Re-evaluation
            </button>

            <input
              type="text"
              placeholder="Paste recipe here to load"
              className="width-auto"
              onChange={(e) => {
                const pastedText = e.target.value;

                // If the clipboard content is from the copy button above we test if the parsed object has recipe field
                try {
                  const parsedClipboard: unknown = JSON.parse(pastedText);
                  if (
                    parsedClipboard
                    && typeof parsedClipboard === "object"
                    && "recipe" in parsedClipboard
                    && parsedClipboard.recipe
                  ) {
                    const parsedRecipe = recipeFromUnknown(parsedClipboard.recipe);
                    setRecipe(parsedRecipe);
                    e.target.value = "";
                    return;
                  }
                }
                catch {
                  // Not JSON or invalid, ignore
                }

                // Actual recipes
                try {
                  const parsedRecipe = recipeFromUnknown(pastedText);
                  setRecipe(parsedRecipe);
                  e.target.value = "";
                }
                catch (err) {
                  console.error("Failed to parse pasted recipe:", err);
                }
              }}
            />
          </div>
        </div>
      }
      {children}
    </RecipeContext.Provider>
  );
}
