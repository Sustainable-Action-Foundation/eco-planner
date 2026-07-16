"use client";

import HistoricalDataSection from "@/components/form/sections/dataseries/historical";
import formSubmitter from "@/functions/formSubmitter";
import { Recipe } from "@/functions/recipe";
import type { DateValuesWithUnit, GoalUpdateInput } from "@/types";
import { GoalDataTarget, type Goal } from "@/types";
import { GoalFormName } from "../formNames";
import type { SubmitEvent } from "react";
import { useTranslation } from "react-i18next";

export default function HistoricalForm({
  goal,
}: {
  goal: Goal
}) {
  const { t } = useTranslation(["common"]);

  // The section's inputs live in a recipe context; its FormSync injects the
  // resulting recipe and date values as hidden fields, read out here on submit.
  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!(event.target instanceof HTMLFormElement)) return;
    if (!(event.target.checkValidity())) return;

    const formData = new FormData(event.target);

    const recipeString = formData.get(GoalFormName.HistoricalRecipe) as string | null;
    if (!recipeString) return;

    let recipe: Recipe;
    try {
      recipe = Recipe.deserialize(recipeString);
    } catch {
      return;
    }
    if (recipe.isEmpty()) return;

    let historical: DateValuesWithUnit | undefined = undefined;
    const historicalString = formData.get(GoalFormName.HistoricalDataSeries) as string | null;
    if (historicalString) {
      try {
        historical = JSON.parse(historicalString) as DateValuesWithUnit;
      } catch {
        historical = undefined;
      }
    }
    // A manual recipe without values carries no data
    if (recipe.isManual() && !historical) return;

    formSubmitter("/api/goal", JSON.stringify({
      target: GoalDataTarget.Historical,
      goalId: goal.id,
      historical: historical,
      historicalRecipe: recipe.serialize(),
      historicalRecipeId: goal.historical?.recipeUsed?.id ?? undefined,
      timestamp: Date.now(),
    } satisfies GoalUpdateInput), "PUT", t);
  }

  return (
    <form onSubmit={handleSubmit} name="goalForm">
      <HistoricalDataSection
        goal={goal}
      />
      <div className="margin-top-400 padding-top-100 margin-bottom-100 min-width-0" style={{ borderTop: "1px solid var(--gray-80)" }}>
        <button
          id="submit-button"
          type="submit"
          className="text-align-center seagreen color-purewhite width-100"
          style={{ fontSize: "14px", transform: "none" }}
        >
          {t("common:tsx.save_changes")}
        </button>
      </div>
    </form>
  );
};
