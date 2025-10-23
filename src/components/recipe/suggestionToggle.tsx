"use client"

import { useState } from "react";
import { useRecipe } from "./contextProvider";
import RecipeEditor from "./editor/editor";
import { RecipeSuggestions, suggestedRecipes } from "./suggested";
import { Trans, useTranslation } from "react-i18next";

export default function SuggestionToggle() {
  const { t } = useTranslation(["forms", "common"]);

  const [visibilityType, setVisibilityType] = useState<"suggested" | "custom">("suggested")
  const { setRecipe } = useRecipe()

  const suggestedRecipeOption = (
    <label id="recipe-type-suggested-label">
      {t("forms:goal.select_recipe")}
      <input
        className="margin-right-25"
        type="radio"
        name="recipe-type"
        id="recipe-type-suggested"
        value="suggested"
        checked={visibilityType === "suggested"}
        onChange={() => { setVisibilityType("suggested"); setRecipe(null) }}
      />
    </label>
  );

  const customRecipeOption = (
    <label>
      {t("forms:goal.create_recipe")}
      <input
        className="margin-right-25"
        type="radio"
        name="recipe-type"
        id="recipe-type-custom"
        value="custom"
        checked={visibilityType === "custom"}
        onChange={() => { setVisibilityType("custom"); setRecipe(null) }}
      />
    </label>
  );

  return (
    <>
      <div className="radio-select-two margin-bottom-100" >
        <Trans
          i18nKey={t("forms:goal.disjunction", { val: ["<b />", "<c />"] })}
          components={{
            b: suggestedRecipeOption,
            c: customRecipeOption,
          }}
        />
      </div>
      {visibilityType === "suggested" ?
        <div className="margin-top-100">
          <RecipeSuggestions ariaLabelledBy="recipe-type-suggested-label" suggestedRecipes={suggestedRecipes} />
        </div>
        : null}
      {/* Properly label textarea :) oh and all the inputs in variable-editor */}
      {visibilityType === "custom" ?
        <div className="margin-top-100">
          <RecipeEditor />
        </div>
        : null}
    </>
  )
}