import { useContext } from "react";
import { RecipeContext } from "./recipeContext.internal";

export function useRecipe() {
  const context = useContext(RecipeContext);
  if (!context) {
    throw new Error("useRecipe must be used within a RecipeContextProvider");
  }
  return context;
}