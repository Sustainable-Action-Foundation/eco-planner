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
      <input
        className="margin-right-25"
        type="radio"
        name="recipe-type"
        id="recipe-type-suggested"
        value="suggested"
        checked={visibilityType === "suggested"}
        onChange={() => { setVisibilityType("suggested"); setRecipe(null) }}
      />
      <label htmlFor="recipe-type-suggested" className="margin-right-100" id="recipe-type-suggested-label">Välj bland föreslagna recept</label>
      <input
        className="margin-right-25"
        type="radio"
        name="visibility"
        id="recipe-type-custom"
        value="custom"
        checked={visibilityType === "custom"}
        onChange={() => { setVisibilityType("custom"); setRecipe(null) }}
      />
      <label htmlFor="recipe-type-custom">Skapa ett eget recept</label>
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