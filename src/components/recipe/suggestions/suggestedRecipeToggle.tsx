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

      <SuggestedRecipeContext hidden={visibilityType !== "suggested"}>
        <SuggestedRecipeApplier />
        {children}
      </SuggestedRecipeContext>

      <CustomRecipeContext hidden={visibilityType !== "custom"}>
        <RecipeEditor />
        {children}
      </CustomRecipeContext>
    </>
  )
}

export function SuggestedRecipeContext({ children, hidden = false }: { children: React.ReactNode; hidden?: boolean }) {
  return (
    <RecipeContextProvider>
      <div className={`margin-top-100 ${hidden ? "" : "display-none"}`}>
        {children}
      </div>
    </RecipeContextProvider>
  );
}

export function CustomRecipeContext({ children, hidden = false }: { children: React.ReactNode; hidden?: boolean }) {
  return (
    <RecipeContextProvider>
      <div className={`margin-top-100 ${hidden ? "" : "display-none"}`}>
        {children}
      </div>
    </RecipeContextProvider>
  );
}