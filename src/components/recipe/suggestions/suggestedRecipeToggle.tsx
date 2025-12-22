"use client"

import { useState } from "react";
import { useRecipe } from "../context/recipeContext.use";
import RecipeEditor from "../editor/recipeEditor";
import { SuggestedRecipeApplier } from "./suggestedRecipeApplier";
import { Trans, useTranslation } from "react-i18next";
import { Recipe } from "@/functions/recipe-parser/types";

export default function SuggestedRecipeToggle({
  initialRecipe = undefined,
}: {
  initialRecipe?: Recipe;
}) {
  const { t } = useTranslation(["common", "components"]);
  const { setRecipe } = useRecipe()

  const [visibilityType, setVisibilityType] = useState<"suggested" | "custom">(
    initialRecipe ? "custom" : "suggested"
  );

  return (
    <>
      <div className="radio-select-two margin-bottom-100" >
        <Trans
          i18nKey={"components:recipe_editor.toggle_suggested_recipe"}
          components={{
            option1: <label id="recipe-type-suggested-label">
              {t("components:recipe_editor.select_recipe")}
              <input
                className="margin-right-25"
                type="radio"
                name="recipe-type"
                id="recipe-type-suggested"
                value="suggested"
                checked={visibilityType === "suggested"}
                onChange={() => {
                  setVisibilityType("suggested");
                  setRecipe(null);
                }}
              />
            </label>,
            option2: <label>
              {t("components:recipe_editor.create_recipe")}
              <input
                className="margin-right-25"
                type="radio"
                name="recipe-type"
                id="recipe-type-custom"
                value="custom"
                checked={visibilityType === "custom"}
                onChange={() => {
                  setVisibilityType("custom");
                  if (initialRecipe) setRecipe(initialRecipe);
                }}
              />
            </label>,
            span: <span />,
          }}
        />
      </div>

      {visibilityType === "suggested" ?
        <div className="margin-top-100">
          <SuggestedRecipeApplier />
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