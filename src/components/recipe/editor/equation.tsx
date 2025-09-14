'use client'

import { emptyRecipe } from "@/functions/recipe-parser/types";
import { useTranslation } from "react-i18next";
import { useRecipe } from "../contextProvider";

// TODO: Rename
export function RecipeEquationEditor() {
  const { t } = useTranslation("components");
  const { recipe, setRecipe } = useRecipe();

  const handleUpdatedEq = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const eq = e.target.value;
    if (!recipe) {
      console.warn("No recipe set, initializing with new one form the RecipeEquationEditor component");
      setRecipe({ ...emptyRecipe, eq });
    }
    else {
      setRecipe({ ...recipe, eq });
    }
  };

  return (
    <textarea
      rows={3}
      placeholder={t("components:copy_and_scale.custom_recipe_placeholder")}
      style={{
        border: '0',
        borderRadius: '.25rem 0 0 0',
      }}
      value={recipe?.eq || ""}
      onChange={handleUpdatedEq}
    />
  )
}
