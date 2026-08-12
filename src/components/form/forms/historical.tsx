"use client";

import HistoricalDataSection from "@/components/form/sections/dataseries/historical";
import { resolveHistoricalDataType, useInitializedValues } from "@/components/form/forms/goal";
import { waitForRecipeFormSyncs } from "@/components/recipe";
import formSubmitter from "@/functions/formSubmitter";
import { Recipe, type SerializedRecipe } from "@/functions/recipe";
import type { DateValuesWithUnit, Goal, GoalUpdateInput, Unit } from "@/types";
import { GoalDataTarget, HistoricalDataType } from "@/types/enums";
import { GoalFormName } from "@/types/form-names";
import { useMemo, useState, type SubmitEvent } from "react";
import { useTranslation } from "react-i18next";
import { GoalGraph } from "@/components/graph/graphs/goal/main";
import { getHistoricalDatasetFromRecipe } from "@/functions/getHistoricalDataset";

export default function HistoricalForm({
  goal,
}: {
  goal: Goal
}) {
  const { t } = useTranslation(["common", "graphs"]);

  // Same wiring as the goal form: the section renders both input types in
  // hidden-not-unmounted fieldsets once visited, with the type lifted here.
  const [historicalDataType, setHistoricalDataType] = useState<HistoricalDataType>(() => resolveHistoricalDataType(goal));
  const initializedHistoricalTypes = useInitializedValues(historicalDataType);
  const [previewHistoricalRecipe, setPreviewHistoricalRecipe] = useState<SerializedRecipe | null>(null);
  const [previewHistoricalSerie, setPreviewHistoricalSerie] = useState<DateValuesWithUnit | null>(null);

  const historicalLabel = useMemo(() => {
    if (!previewHistoricalRecipe) return "";
    try {
      return getHistoricalDatasetFromRecipe(Recipe.from(previewHistoricalRecipe)).label ?? "";
    } catch {
      return "";
    }
  }, [previewHistoricalRecipe]);

  const previewGraphSeries = useMemo(() => ({
    main: goal.data_series && {
      name: goal.name ?? t("common:goal_one"), // todo: use full leap param fallback
      unit: (goal.data_series?.unit ?? 'MISSING_UNIT') as Unit, // TODO: Typeguard? idk?
      dateValues: Object.fromEntries(
        goal.data_series.values.map((value) => [
          value.timestamp.toISOString(),
          value.value,
        ]),
      ),
    },
    baseline: goal.baseline?.values && {
      name: t('graphs:common.baseline_scenario'),
      unit: (goal.data_series?.unit ?? 'MISSING_UNIT') as Unit, // TODO: Typeguard? idk? also we lie here for now and say that all dataseries share the same unit
      dateValues: Object.fromEntries(
        goal.baseline.values.map((value) => [
          value.timestamp.toISOString(),
          value.value,
        ]),
      ),
    },
    historical: (goal.data_series && previewHistoricalSerie?.dateValues) && {
      name: historicalLabel ? t("graphs:common.historical_series", { label: historicalLabel }) : t("common:historical_data"),
      unit: (goal.data_series?.unit ?? 'MISSING_UNIT') as Unit, // TODO: Typeguard? idk? also we lie here for now and say that all dataseries share the same unit
      dateValues: previewHistoricalSerie.dateValues,
    },
  }), [previewHistoricalSerie, historicalLabel, t, goal.baseline?.values, goal.data_series, goal.name]);

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
      historicalRecipeId: goal.historical?.recipe_used?.id ?? undefined,
      timestamp: Date.now(),
    } satisfies GoalUpdateInput), "PUT", t);
  }
 
  return (
    <form onSubmit={(event) => { void handleSubmit(event); }} name="goalForm">
      <HistoricalDataSection
        goal={goal}
        historicalDataType={historicalDataType}
        setHistoricalDataType={setHistoricalDataType}
        hasInitializedNone={initializedHistoricalTypes.has(HistoricalDataType.None)}
        hasInitializedExternal={initializedHistoricalTypes.has(HistoricalDataType.External)}
        hasInitializedManual={initializedHistoricalTypes.has(HistoricalDataType.Custom)}
        setPreviewHistoricalSerie={setPreviewHistoricalSerie}
        setPreviewHistoricalRecipe={setPreviewHistoricalRecipe}
      />
      <div
        className="margin-top-200 min-width-0 margin-left-400"
      >
        <strong className="block font-size-125 font-weight-bold text-align-center margin-0 padding-top-125">{t("forms:goal.preview")}</strong>
        <p className="text-align-center margin-top-50">{t("forms:goal.preview_info")}</p>
        <output
          className="display-block"
          style={{ height: '400px' }}
        >
          {/* TODO: Need preview for values aswell. Probably create a switch between graph and table then tabs in the table to view different series. */}
          <GoalGraph
            chartType="preview"
            series={previewGraphSeries}
          />
        </output>
      </div>
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
