"use client"

import { useContext, useState } from "react";
import { useRecipe } from "./contextProvider";
import RecipeEditor from "./editor/editor";
import { RecipeSuggestions, suggestedRecipes } from "./suggested";
import { useTranslation } from "react-i18next";
import { LocaleContext } from "@/lib/i18nClient";

export default function SuggestionToggle() {
  const { t } = useTranslation(["forms", "common"]);

  const [visibilityType, setVisibilityType] = useState<"suggested" | "custom">("suggested")
  const { setRecipe } = useRecipe()

  // For proper localization of the disjunction ("or") between the two options, should probably also work with languages modifying the input phrases themselves (e.g. adding affixes)?
  const locale = useContext(LocaleContext);
  const disjunctionFormatter = new Intl.ListFormat(locale, { style: 'long', type: 'disjunction' });
  const sections = disjunctionFormatter.formatToParts([
    t("forms:goal.select_recipe"),
    t("forms:goal.create_recipe")
  ]);

  const firstItem = sections[0].value;
  const disjunctionPhrase = sections[1].value;
  const secondItem = sections[2].value;

  if (sections.length !== 3 || sections[0].type !== 'element' || sections[1].type !== 'literal' || sections[2].type !== 'element') {
    console.error("Unexpected format from Intl.ListFormat:", sections);
  }

  return (
    <>
      <div className="radio-select-two margin-bottom-100" >
        <label id="recipe-type-suggested-label">
          {firstItem}
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
        <span>{`—${disjunctionPhrase}—`}</span>
        <label>
          {secondItem}
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