"use client"

import { useState } from "react";
import { useRecipe } from "./contextProvider";
import RecipeEditor from "./editor/editor";
import { RecipeSuggestions, suggestedRecipes } from "./suggested";

export default function SuggestionToggle() {
  const [visibilityType, setVisibilityType] = useState<"suggested" | "custom">("suggested")
  const { setRecipe } = useRecipe()

  return (
    <>
      <div className="radio-select-two margin-bottom-100" >
        <label id="recipe-type-suggested-label">
          Välj bland recept
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
        <span>‒ eller ‒</span>
        <label>
          Skapa recept
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