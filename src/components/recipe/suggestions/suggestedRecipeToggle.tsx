"use client"

import { useState } from "react";
import RecipeEditor from "../editor/recipeEditor";
import { SuggestedRecipeApplier } from "./suggestedRecipeApplier";
import { Trans, useTranslation } from "react-i18next";
import { RecipeContextProvider } from "@/components/recipe/context/recipeContext.provider";

export default function SuggestedRecipeToggle({ children }: { children?: React.ReactNode }) {
  const { t } = useTranslation(["common", "components"]);

  const [visibilityType, setVisibilityType] = useState<"suggested" | "custom">("suggested")

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
                }}
              />
            </label>,
            span: <span />,
          }}
        />
      </div>

      <RecipeContextProvider>
        <div className={`margin-top-100 ${visibilityType === "suggested" ? "" : "display-none"}`}>
          <SuggestedRecipeApplier />
          {children}
        </div>
      </RecipeContextProvider>

      <RecipeContextProvider>
        {/* TODO: Properly label textarea :) oh and all the inputs in variable-editor */}
        <div className={`margin-top-100 ${visibilityType === "custom" ? "" : "display-none"}`}>
          <RecipeEditor />
          {children}
        </div>
      </RecipeContextProvider>
    </>
  )
}