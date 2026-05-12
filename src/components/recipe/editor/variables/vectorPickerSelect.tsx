"use client";

import { isDataSeriesVariable, isExternalVariable, VectorIndexPickerOptions } from "@/functions/recipe/types";
import type { DataSeriesVariable } from "@/functions/recipe/types";
import { useTranslation } from "react-i18next";
import { RecipeEditorPermissions } from "../recipeEditorPermissions";
import { useRecipe } from "@/components/recipe/context/recipeContext.use";

export function VectorPickerSelect({ permissions: incomingPermissions, variableId }: { permissions?: RecipeEditorPermissions, variableId: string }) {
  const { t } = useTranslation("components");
  const { recipe, upsertVariable, getVariable } = useRecipe();

  const permissions = { ...RecipeEditorPermissions, ...incomingPermissions };

  return (
    <select
      id={variableId}
      defaultValue={(getVariable(variableId) as DataSeriesVariable)?.pick ?? VectorIndexPickerOptions.Default}
      disabled={!permissions.allowValueEditing}
      onChange={(e) => {
        if (!recipe) return; // Early return if recipe is null which is only the case in race conditions with the context provider

        const variable = getVariable(variableId);

        if (!variable) {
          console.error(`Variable with id ${variableId} not found in recipe when trying to change vector picker option.`);
          return;
        }

        // Make sure variable is of correct type
        if (!isDataSeriesVariable(variable) && !isExternalVariable(variable)) {
          console.error(`Variable ${variableId} is not of type RecipeDataSeries or RecipeExternalDataset so should not be picked.`);
          return;
        }

        const variableWithNewPick = {
          ...variable,
          pick: e.target.value as VectorIndexPickerOptions,
        };

        upsertVariable(variableId, variableWithNewPick);
      }}
    >
      <option value={VectorIndexPickerOptions.Whole}>{t("components:recipe_editor.pick_whole")}</option>
      <option value={VectorIndexPickerOptions.Last}>{t("components:recipe_editor.pick_last")}</option>
      <option value={VectorIndexPickerOptions.First}>{t("components:recipe_editor.pick_first")}</option>
      <option value={VectorIndexPickerOptions.Median}>{t("components:recipe_editor.pick_median")}</option>
      <option value={VectorIndexPickerOptions.Mean}>{t("components:recipe_editor.pick_mean")}</option>
    </select>
  );
}