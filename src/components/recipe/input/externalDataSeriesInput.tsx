"use client";

import { useCallback, useRef } from "react";
import { useRecipe } from "../context/recipeContext.use";
import { Recipe } from "@/functions/recipe/recipe";
import { isDataSetKeys } from "@/lib/api/utility";
import ExternalData from "@/components/form/api/externalData";
import type { ExternalDataState } from "@/components/types";
import type { Goal } from "@/types";

/**
 * The external API selection wired into the recipe context: as the user builds
 * a selection, it is pushed into the surrounding {@link RecipeContextProvider}
 * as a single external variable (see {@link Recipe.fromExternalSource}). This
 * makes the external input read like every other data series input — the form
 * reads the result via `FormSync`, and the server materializes the selection
 * into a `DataSeries` on save.
 *
 * Must be rendered inside a `RecipeContextProvider` (seed it with the saved
 * recipe via `withEditableExternals()` when editing so the initial output and
 * context agree).
 */
export function ExternalDataSeriesInput({
  goal,
}: {
  goal: Goal | undefined;
}) {
  const { recipe, applyRecipeUpdate } = useRecipe();

  // Keep the external variable's id stable across selections so the recipe
  // identity only changes when the selection actually changes.
  const variableIdRef = useRef<string>(recipe.variables[0]?.id ?? crypto.randomUUID());

  // Push a completed selection into the recipe context. An incomplete or
  // cleared selection intentionally leaves the recipe untouched: when editing,
  // the provider is seeded with the saved recipe before anything is picked.
  const handleChange = useCallback((data: ExternalDataState) => {
    if (!data?.table || !data.tableContent || !data.selection || !isDataSetKeys(data.dataSource)) return;
    const { table, dataSource, selection } = data;

    void applyRecipeUpdate(() => Recipe.fromExternalSource({
      name: table.label || dataSource,
      dataset: dataSource,
      tableId: table.tableId,
      selection,
      variableId: variableIdRef.current,
    }));
  }, [applyRecipeUpdate]);

  return (
    <ExternalData
      goal={goal}
      onChange={handleChange}
    />
  );
}
