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
      } catch (e: unknown) {
        setResultingDataSeries(null);
        setError((e as Error)?.message);
        setWarnings([]);
      }
    }
    calculate().catch(e => { throw e; });
  }, [recipe]);

  // Register debug key bind alt+shift+d
  const [showDebug, setShowDebug] = useState(false);
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.altKey && event.shiftKey && event.key === "D") {
        setShowDebug(prev => !prev);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <RecipeContext.Provider value={{ recipe, setRecipe, warnings, error, resultingDataSeries, resultingUnit }}>
      {showDebug &&
        <div style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          backgroundColor: "rgba(0,0,0,0.7)",
          display: "flex",
          flexFlow: "column nowrap",
          justifyContent: "start",
          alignItems: "start",
          rowGap: "1rem",
          padding: "1rem",
          zIndex: 9999,
        }}>
          <pre style={{
            color: "white",
            overflow: "scroll",
            width: "100%"
          }}>
            {JSON.stringify(recipe, null, 2)}
          </pre>

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
