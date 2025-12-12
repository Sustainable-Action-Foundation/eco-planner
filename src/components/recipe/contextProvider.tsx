"use client";

import { emptyRecipe, Recipe } from "@/functions/recipe-parser/types";
import type { DataSeriesValueFields } from "@/types";
import { createContext, useContext, useEffect, useRef, useState } from "react";

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

  const [lastEvalDuration, setLastEvalDuration] = useState<number | null>(null);
  const [lastEvalTimestamp, setLastEvalTimestamp] = useState<string | null>(null);

  useEffect(() => {
    if (initialRecipe) {
      setRecipe(initialRecipe);
    }
  }, [initialRecipe]);

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
    async function calculate() {
      setLastEvalDuration(null);
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
      } catch (e: unknown) {
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
  }, [recipe]);

  // Register debug key bind alt+shift+d (hold to open)
  const [showDebug, setShowDebug] = useState(false);
  const debugKeyTimerRef = useRef<number | null>(null);
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
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

  return (
    <RecipeContext.Provider value={{ recipe, setRecipe, warnings, error, resultingDataSeries, resultingUnit }}>
      {showDebug &&
        <div style={{
          position: "absolute",
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
        }}>
          <div style={{
            overflow: "scroll",
            width: "100%",
          }}>
            Recipe context debug info:<pre style={{ width: "100%", }}>
              {JSON.stringify({
                "eval time": lastEvalDuration + " ms",
                "eval timestamp": lastEvalTimestamp,
                warnings,
                error,
                resultingUnit,
                resultingDataSeries,
              }, null, 2)}
            </pre>

            Current Recipe:<pre style={{ width: "100%", }}>
              {JSON.stringify(recipe, null, 2)}
            </pre>
          </div>

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
                navigator.clipboard.writeText(JSON.stringify(recipe, null, 2))
                  .catch((e) => {
                    console.error(e);
                  });
              }}
            >
              Copy Recipe to Clipboard
            </button>
          </div>
        </div>
      }
      {children}
    </RecipeContext.Provider>
  );
}
