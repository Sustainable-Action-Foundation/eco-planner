"use client"

import { isRecipeDataSeries, isRecipeExternalDataset, RecipeDataSeries, VectorIndexPickerOptions } from "@/functions/recipe-parser/types";
import { useTranslation } from "react-i18next";
import { RecipeEditorPermissions } from "./recipeEditorPermissions";
import { useRecipe } from "@/components/recipe/contextProvider";

// TODO: Fix labels
export default function VectorPickerSelect({ rules, variableName }: { rules?: RecipeEditorPermissions, variableName: string }) {
  const { t } = useTranslation("components");
  const { recipe, setRecipe } = useRecipe();

  rules = { ...RecipeEditorPermissions, ...rules };

  return (
    <select
      id={variableName}
      defaultValue={(recipe?.variables[variableName] as RecipeDataSeries)?.pick || VectorIndexPickerOptions.Default}
      disabled={!rules.allowValueEditing}
      onChange={(e) => {
        if (!recipe) return; // Early return if recipe is null which is only the case in race conditions with the context provider

        const variable = recipe.variables[variableName];

        // Make sure variables is of correct type
        if (!isRecipeDataSeries(variable) && !isRecipeExternalDataset(variable)) {
          console.error(`Variable ${variableName} is not of type RecipeDataSeries or RecipeExternalDataset so should not be picked.`);
          return;
        }

        variable.pick = e.target.value as VectorIndexPickerOptions;
        setRecipe({
          ...recipe,
          variables: {
            ...recipe.variables,
            [variableName]: variable,
          },
        });
      }}
    >
      <option value={VectorIndexPickerOptions.Whole}>{t("components:recipe_editor.pick_whole")}</option>
      <option value={VectorIndexPickerOptions.Last}>{t("components:recipe_editor.pick_last")}</option>
      <option value={VectorIndexPickerOptions.First}>{t("components:recipe_editor.pick_first")}</option>
      <option value={VectorIndexPickerOptions.Median}>{t("components:recipe_editor.pick_median")}</option>
      <option value={VectorIndexPickerOptions.Mean}>{t("components:recipe_editor.pick_mean")}</option>
    </select>
  )
}