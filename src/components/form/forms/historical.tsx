"use client";

import HistoricalDataSection from "@/components/form/sections/dataseries/historical";
import { resolveHistoricalDataType, useInitializedValues } from "@/components/form/forms/goal";
import { waitForRecipeFormSyncs } from "@/components/recipe";
import formSubmitter from "@/functions/formSubmitter";
import { Recipe } from "@/functions/recipe";
import type { DateValuesWithUnit, Goal, GoalUpdateInput } from "@/types";
import { GoalDataTarget, HistoricalDataType } from "@/types/enums";
import { GoalFormName } from "@/types/form-names";
import { useState, type SubmitEvent } from "react";
import { useTranslation } from "react-i18next";

export default function HistoricalForm({
  goal,
}: {
  goal: Goal
}) {
  const { t } = useTranslation(["common"]);

  // Same wiring as the goal form: the section renders both input types in
  // hidden-not-unmounted fieldsets once visited, with the type lifted here.
  const [historicalDataType, setHistoricalDataType] = useState<HistoricalDataType>(() => resolveHistoricalDataType(goal));
  const initializedHistoricalTypes = useInitializedValues(historicalDataType);

  // The section's inputs live in a recipe context; its FormSync injects the
  // resulting recipe and date values as hidden fields, read out here on submit.
  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!(event.target instanceof HTMLFormElement)) return;
    if (!(event.target.checkValidity())) return;

    // The recipe context evaluates on a debounce; wait for the FormSync
    // outputs to settle so a submit right after an edit doesn't read stale data.
    await waitForRecipeFormSyncs(event.target);

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
    <form onSubmit={(event) => { void handleSubmit(event); }} name="goalForm">
      <HistoricalDataSection
        goal={goal}
        historicalDataType={historicalDataType}
        setHistoricalDataType={setHistoricalDataType}
        hasInitializedExternal={initializedHistoricalTypes.has(HistoricalDataType.External)}
        hasInitializedManual={initializedHistoricalTypes.has(HistoricalDataType.Custom)}
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
