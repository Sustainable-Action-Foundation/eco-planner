'use client'

import { isRecipe, Recipe, RecipeDataTypes, VectorIndexPickerOptions } from "@/functions/recipe-parser/types";
import { useTranslation } from "react-i18next";
import { useRecipe } from "./contextProvider";
import { recipeFromUnknown } from "@/functions/parseRecipe";

// TODO: Rename
export function RecipeSuggestions({
  suggestedRecipes,
}: {
  // TODO - only use prisma generated and type guard the recipe prop into, not `JsonValue`
  suggestedRecipes: { hash: string, recipe: Recipe }[];
}) {
  const { t } = useTranslation("components");
  const { setRecipe } = useRecipe();

  for (const recipe of suggestedRecipes) {
    if (!isRecipe(recipe.recipe)) {
      console.warn("Invalid recipe in suggestions", recipe);
      return null;
    }
  }
  // Validate suggested recipes
  if (suggestedRecipes.some(r => !isRecipe(r.recipe))) {
    console.warn("Some suggested recipes are not valid. Please check the data.");
    return null;
  }

  // On change set the context state to the selected recipe
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const hash = e.target.value;
    const selectedSuggestion = suggestedRecipes.find(r => r.hash === hash);
    if (selectedSuggestion) {
      try {
        const rawRecipe = recipeFromUnknown(selectedSuggestion.recipe);
        setRecipe(rawRecipe);
      } catch (e) {
        console.error("Failed to parse suggested recipe", e);
        setRecipe(null);
      }
    } else {
      setRecipe(null);
    }
  };

  return (
    <>
      {/* Suggested recipes */}
      <label htmlFor="select-preset">Välj recept</label>
      <select id="select-preset" className="block margin-bottom-100 margin-top-25" onChange={handleChange}>
        {suggestedRecipes.map((recipe, index) => (
          <option key={index} value={recipe.hash}>
            {recipe.recipe.name ?? t("components:copy_and_scale.unnamed_suggestion")}: {recipe.recipe.eq}
          </option>
        ))}
      </select>
    </>
  );
}

// TODO: Placed this here temporarily to remove clutter from goal form. 
// Should probably be moved back once theese are created dynamically? 
export const suggestedRecipes: Array<{ hash: string, recipe: Recipe }> = [
  // TODO: actually create proper hashes
  // TODO: Localize the variable names
  // TODO: Create these in seed and get them from the database
  { // Default scaling recipe
    hash: "atotallycoolhashthefirst",
    recipe: {
      name: 'temporary', // Deal with this later t("forms:goal.default_scaling_recipe"), 
      eq: "${serie} * ${skalär}",
      variables: {
        "serie": {
          type: RecipeDataTypes.DataSeries,
          link: null,
          pick: VectorIndexPickerOptions.Default,
          unit: undefined, // No unit specified
        },
        "skalär": {
          type: RecipeDataTypes.Scalar,
          value: 0.5,
          unit: null, // Unitless
        }
      }
    },
  },
  { // Default combination recipe
    hash: "recipe_with_combination",
    recipe:
    {
      name: 'temporary', // Deal with this later t("forms:goal.default_combination_recipe"),
      eq: "${serie1} * ${skalär1} + ${serie2} * ${skalär2}",
      variables: {
        "serie1": {
          type: RecipeDataTypes.DataSeries,
          link: null,
          pick: VectorIndexPickerOptions.Default,
          unit: undefined, // No unit specified
        },
        "skalär1": {
          type: RecipeDataTypes.Scalar,
          value: 0.5,
          unit: null, // Unitless
        },
        "serie2": {
          type: RecipeDataTypes.DataSeries,
          link: null,
          pick: VectorIndexPickerOptions.Default,
          unit: undefined, // No unit specified
        },
        "skalär2": {
          type: RecipeDataTypes.Scalar,
          value: 0.5,
          unit: null, // Unitless
        },
      }
    }
  },
  { // Testing recipe with external data
    hash: "recipe_with_external",
    recipe:
    {
      name: "Recipe with external data",
      eq: "${extern}",
      variables: {
        "extern": {
          type: RecipeDataTypes.External,
          dataset: "SCB",
          tableId: "TAB6420",
          selection: [
            // Selected area
            { variableCode: "Region", valueCodes: ["00"] },
            // Specifically land areas, not including water
            { variableCode: "ArealTyp", valueCodes: ["01"] },
            // Magic string to get area sizes in square kilometers (as opposed to hectares with "000007E1")
            { variableCode: "ContentsCode", valueCodes: ["000007DY"] },
            // // Use the latest time period
            // { variableCode: "Tid", valueCodes: ["TOP(1)"] }
          ],
          pick: VectorIndexPickerOptions.Last,
          unit: undefined,
        }
      }
    }
  }
]