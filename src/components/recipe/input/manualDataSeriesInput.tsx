"use client";

import { useCallback, useRef } from "react";
import { useRecipe } from "../context/recipeContext.use";
import { Recipe } from "@/functions/recipe/recipe";
import type { DateValuesWithUnit } from "@/types";
import DataSeriesGrid from "./dataSeriesGrid";

/**
 * The manual ("static") data series input wired into the recipe context: as the
 * user edits the grid, its values are pushed into the surrounding
 * {@link RecipeContextProvider} as a single inline data series variable (see
 * {@link Recipe.fromManualDateValues}). This makes the manual input read like
 * every other data series input — the form reads the result via `FormIntegration`
 * (`resultingDateValues` / `resultingRecipe`) instead of a bespoke hidden field.
 *
 * Must be rendered inside a `RecipeContextProvider` (seed it with
 * `Recipe.fromManualDateValues(initialDateValues).serialize()` so the initial
 * grid and context agree).
 */
export function ManualDataSeriesInput({
  id,
  label,
  initialDateValues,
}: {
  id: string;
  label: string;
  initialDateValues?: DateValuesWithUnit | undefined;
}) {
  const { recipe, applyRecipeUpdate } = useRecipe();

  // Keep the inline variable's id stable across edits so the recipe identity
  // only changes when the values actually change.
  const variableIdRef = useRef<string>(recipe.variables[0]?.id ?? crypto.randomUUID());

  const handleDateValuesChange = useCallback((dateValues: DateValuesWithUnit) => {
    void applyRecipeUpdate(() => Recipe.fromManualDateValues(dateValues, variableIdRef.current));
  }, [applyRecipeUpdate]);

  return (
    <DataSeriesGrid
      id={id}
      label={label}
      initialDateValues={initialDateValues}
      onDateValuesChange={handleDateValuesChange}
    />
  );
}
