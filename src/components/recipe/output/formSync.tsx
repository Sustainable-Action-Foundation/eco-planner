import React, { useMemo } from "react";
import { useRecipe } from "../context/recipeContext.use";
import type { DateValuesWithUnit } from "@/types";
import { RecipeEvaluationPendingName } from "@/types/form-names";

/**
 * Waits until every enabled `FormSync` in the form reports a settled evaluation
 * (the recipe contexts evaluate on a debounce, so outputs briefly lag edits).
 * Call at the top of a submit handler, before reading the form's `FormData`.
 *
 * Times out rather than blocking submission forever: a failed evaluation also
 * settles (with an error), so the existing invalid/missing-value handling still
 * applies to whatever state the form is in.
 */
export async function waitForRecipeFormSyncs(form: HTMLFormElement, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const stillPending = Array.from(
      form.querySelectorAll<HTMLInputElement>(`input[name="${RecipeEvaluationPendingName}"]:enabled`),
    ).some(input => input.value === "true");
    if (!stillPending) return;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  console.warn("Timed out waiting for recipe evaluations to settle; continuing with the latest available results.");
}

/**
 * ## What is this?
 *
 * Well, to have a form get any information out of the Recipe Context Provider,
 * this component is used inside of the provider to be able to inject
 * hidden form elements with the relevant data.
 */
export function FormSync({
  DataSeriesFormElement,
  UnitFormElement,
  RecipeFormElement,
  DateValuesFormElement,
}: {
  DataSeriesFormElement?: React.ReactElement<HTMLInputElement>;
  UnitFormElement?: React.ReactElement<HTMLInputElement>;
  RecipeFormElement?: React.ReactElement<HTMLInputElement>;
  DateValuesFormElement?: React.ReactElement<HTMLInputElement>;
}) {
  const {
    recipe,
    resultingDataSeries,
    resultingUnit,
    isEvaluationPending,
  } = useRecipe();

  const effectiveUnit = useMemo(() => {
    if (recipe.unit !== undefined) return recipe.unit;
    return resultingUnit;
  }, [recipe.unit, resultingUnit]);

  const dateValues: DateValuesWithUnit | undefined = useMemo(() => {
    if (!resultingDataSeries) return undefined;
    return { unit: resultingUnit, dateValues: resultingDataSeries };
  }, [resultingDataSeries, resultingUnit]);

  return (<>
    {/* Settle marker: lets submit handlers wait out the evaluation debounce (see waitForRecipeFormSyncs) */}
    <input
      name={RecipeEvaluationPendingName}
      value={String(isEvaluationPending)}
      type="hidden"
      hidden={true}
      readOnly={true}
    />
    {!!DataSeriesFormElement && React.cloneElement(DataSeriesFormElement, {
      value: JSON.stringify(resultingDataSeries) || "",
      type: "hidden",
      hidden: true,
      readOnly: true,
    })}
    {!!UnitFormElement && React.cloneElement(UnitFormElement, {
      value: effectiveUnit ?? "",
      type: "hidden",
      hidden: true,
      readOnly: true,
    })}
    {!!RecipeFormElement && React.cloneElement(RecipeFormElement, {
      value: recipe.serialize() || "",
      type: "hidden",
      hidden: true,
      readOnly: true,
    })}
    {!!DateValuesFormElement && React.cloneElement(DateValuesFormElement, {
      value: JSON.stringify(dateValues) || "",
      type: "hidden",
      hidden: true,
      readOnly: true,
    })}
  </>);
}