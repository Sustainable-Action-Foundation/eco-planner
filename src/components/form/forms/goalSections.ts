"use client";

import type { DateValuesWithUnit, Goal, PrefilledSeries } from "@/types";
import { BaselineType, DataSeriesType, HistoricalDataType, UnitFlags } from "@/types/enums";
import { GoalFormName } from "@/types/form-names";
import { isDateValuesWithUnit } from "@/types/typeguards";
import { Recipe } from "@/functions/recipe/recipe";
import { dataSeriesToDateValues, type SerializedRecipe } from "@/functions/recipe";
import { parseUnit } from "@/functions/unit";
import { getHistoricalDataset } from "@/functions/getHistoricalDataset";
import type { TFunction } from "i18next";
import { useEffect, useState } from "react";

/*
 * Shared pieces of the goal forms. The full goal form and the focused section
 * forms (data series, baseline, historical) render the same section components
 * and read the same FormSync outputs, so the type resolution and the form-data
 * parsing live here rather than in each form.
 */

/** A user-facing problem with the submitted form; `message` is already translated. */
export class GoalFormError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoalFormError";
  }
}

/** Formats a translated error prefix with an underlying error's message, as the goal form toasts do. */
function withDetails(prefix: string, err: unknown): string {
  return `${prefix} ${err instanceof Error ? err.message : String(err)}`;
}

/**
 * A recipe that just reads a prefilled series (see {@link PrefilledSeries}):
 * what the historical external input or the formula editor would hold had the
 * user picked the series there. The source's unit is declared on the recipe,
 * like a manual series' is.
 */
export function prefilledSeriesRecipe(series: PrefilledSeries): SerializedRecipe {
  const recipe = new Recipe({
    name: series.name,
    equation: `\${${series.variable.id}}`,
    variables: [series.variable],
    unit: series.unit ? parseUnit(series.unit) : UnitFlags.Missing,
  });
  return recipe.serialize();
}

/*
 * Which input mode a section should start in when editing an existing goal
 */

export function resolveDataSeriesType(goal?: Goal): DataSeriesType {
  // Somehow missing
  if (!goal?.data_series) return DataSeriesType.Suggested;

  // Defined recipe
  if (goal.data_series.recipe_used) {
    const recipe = Recipe.from(goal.data_series.recipe_used.recipe);

    // Manual entry stored as an inline data series recipe
    if (recipe.isManual()) {
      return DataSeriesType.Manual;
    }
    // Suggested recipe
    else if (recipe.isSuggestedRecipe()) {
      return DataSeriesType.Suggested;
    }
    // Custom recipe
    else {
      return DataSeriesType.Custom;
    }
  }

  // IDK, fall back to manual input :woman_shrugging:
  return DataSeriesType.Manual;
}

// TODO: The below never reaches initialNonZero?
export function resolveBaselineType(goal?: Goal): BaselineType {
  // No baseline yet (new goals start without one)
  if (!goal?.baseline) return BaselineType.None;

  // No recipe: manual value input (or a legacy baseline; both edit as custom values)
  if (!goal.baseline.recipe_used) return BaselineType.Custom;

  const recipe = Recipe.from(goal.baseline.recipe_used.recipe);

  // Derived from the goal's data series (first / first non-zero value)
  const derivation = recipe.baselineDerivation();
  if (derivation === BaselineType.Initial || derivation === BaselineType.InitialNonZero) {
    return derivation;
  }

  return recipe.isManual()
    ? BaselineType.Custom
    : BaselineType.Inherited;
}

export function resolveHistoricalDataType(goal?: Goal): HistoricalDataType {
  const historical = goal?.historical;
  if (!historical?.values) return HistoricalDataType.None;

  // Manual entry stored as an inline data series recipe (or a legacy series with
  // no recipe) edits as custom values; anything else (e.g. an external API
  // selection) edits as external.
  if (!historical.recipe_used || Recipe.from(historical.recipe_used.recipe).isManual()) {
    return HistoricalDataType.Custom;
  }
  return HistoricalDataType.External;
}

/** Whether the goal's baseline is derived from its data series (and so goes stale when the series changes). */
export function isDerivedBaselineType(baselineType: BaselineType): boolean {
  return baselineType === BaselineType.Initial || baselineType === BaselineType.InitialNonZero;
}

// Tracks every distinct value `current` has taken since mount, as a Set.
// Used to keep a tab's content mounted once it's been visited, even after
// switching away — replaces one boolean state + one useEffect per enum value.
export function useInitializedValues<T>(current: T): Set<T> {
  const [initialized, setInitialized] = useState<Set<T>>(() => new Set([current]));

  useEffect(() => {
    setInitialized(prev => (prev.has(current) ? prev : new Set(prev).add(current)));
  }, [current]);

  return initialized;
}

/*
 * Reading the sections' FormSync outputs back out of the submitted form
 */

/**
 * The main data series as submitted by {@link GoalSeriesSection}: the resulting
 * date values (required) with the unit field applied, and the producing recipe
 * (absent for manual entry).
 */
export function parseDataSeriesSection(formData: FormData, t: TFunction): {
  dataSeries: DateValuesWithUnit;
  dataSeriesRecipe: Recipe | undefined;
} {
  // Parse recipe (optional)
  let dataSeriesRecipe: Recipe | undefined = undefined;
  const resultingRecipeString = formData.get(GoalFormName.ResultingRecipe) as string | null;
  if (resultingRecipeString) {
    try {
      dataSeriesRecipe = Recipe.deserialize(resultingRecipeString);
    }
    catch (err) {
      throw new GoalFormError(withDetails(t("forms:goal.errors.failed_parse_recipe"), err));
    }
  }

  // Parse date values (required)
  const resultingDateValuesString = formData.get(GoalFormName.ResultingDateValues) as string | null;
  if (!resultingDateValuesString) {
    throw new GoalFormError(t("forms:goal.errors.missing_date_values"));
  }

  let dataSeries: DateValuesWithUnit | undefined;
  try {
    dataSeries = JSON.parse(resultingDateValuesString) as DateValuesWithUnit;
    // The DataUnit field carries a Unit-space value (flags serialize verbatim);
    // only a missing declaration falls back to the series' own unit.
    const dataUnitOverride = parseUnit(formData.get(GoalFormName.DataUnit) as string | null);
    dataSeries.unit = dataUnitOverride === UnitFlags.Missing ? dataSeries.unit : dataUnitOverride;
  } catch (err) {
    throw new GoalFormError(withDetails(t("forms:goal.errors.failed_parse_date_values"), err));
  }

  // Validate parsed date values
  if (!dataSeries || !isDateValuesWithUnit(dataSeries)) {
    throw new GoalFormError(`${t("forms:goal.errors.invalid_date_values")} ${String(dataSeries)}`); // Im not sure about String(dataSeries)?
  }
  // A year without a value passes native validation but leaves no data points;
  // reject it here rather than relying on a later section (e.g. the baseline
  // derivation) to notice the empty series.
  if (Object.keys(dataSeries.dateValues).length === 0) {
    throw new GoalFormError(t("forms:goal.errors.missing_date_values"));
  }

  return { dataSeries, dataSeriesRecipe };
}

/**
 * The baseline as submitted by {@link BaselineSeriesSection}. Custom and
 * inherited baselines are read from the section's recipe context; the initial
 * (non-zero) types are derived here from the goal's data series through a recipe,
 * so the evaluator broadcasts the first value across the series' years.
 */
export async function buildBaselineSection(
  formData: FormData,
  baselineType: BaselineType,
  dataSeries: DateValuesWithUnit,
  t: TFunction,
): Promise<{
  baseline: DateValuesWithUnit | undefined;
  baselineRecipe: Recipe | undefined;
}> {
  let baseline: DateValuesWithUnit | undefined = undefined;
  let baselineRecipe: Recipe | undefined = undefined;

  if (baselineType === BaselineType.Custom || baselineType === BaselineType.Inherited) {
    // Both flow through a recipe context: the recipe is a manual entry
    // (Custom) or links the inherited series (Inherited), and the baseline
    // date values are its evaluation result.
    const baselineString = formData.get(GoalFormName.BaselineDataSeries) as string | null;
    if (baselineString) {
      try {
        baseline = JSON.parse(baselineString) as DateValuesWithUnit;
      }
      catch (err) {
        throw new GoalFormError(withDetails(t("forms:goal.errors.failed_parse_baseline"), err));
      }
    }

    const baselineRecipeString = formData.get(GoalFormName.BaselineRecipe) as string | null;
    if (baselineRecipeString) {
      try {
        baselineRecipe = Recipe.deserialize(baselineRecipeString);
      }
      catch (err) {
        throw new GoalFormError(withDetails(t("forms:goal.errors.failed_parse_recipe"), err));
      }
    }
  }
  else if (isDerivedBaselineType(baselineType)) {
    if (Object.keys(dataSeries.dateValues).length === 0) {
      throw new GoalFormError(t("forms:goal.errors.initial_baseline_error"));
    }

    baselineRecipe = Recipe.fromInitialDateValue(
      { unit: dataSeries.unit, dateValues: dataSeries.dateValues },
      { nonZero: baselineType === BaselineType.InitialNonZero },
    );
    try {
      const evaluated = await baselineRecipe.evaluate();
      if (!evaluated) throw new Error("Baseline recipe evaluation returned no result.");
      // The recipe evaluates unitless (see Recipe.fromInitialDateValue); the
      // baseline keeps the data series' unit verbatim.
      baseline = { unit: dataSeries.unit, dateValues: evaluated.dateValues };
    }
    catch (err) {
      throw new GoalFormError(withDetails(t("forms:goal.errors.initial_baseline_error"), err));
    }
  }

  if (baselineType === BaselineType.Inherited && (!baselineRecipe || !baseline)) {
    throw new GoalFormError(t("forms:goal.errors.missing_inherited_baseline"));
  }

  return { baseline, baselineRecipe };
}

/**
 * The historical series as submitted by {@link HistoricalSeriesSection}. An empty
 * recipe (external mode before a selection is completed) or a manual recipe whose
 * grid produced no values carries no data and is dropped rather than stored orphaned.
 */
export function parseHistoricalSection(formData: FormData, t: TFunction): {
  historical: DateValuesWithUnit | undefined;
  historicalRecipe: Recipe | undefined;
} {
  let historical: DateValuesWithUnit | undefined = undefined;
  const historicalString = formData.get(GoalFormName.HistoricalDataSeries) as string | null;
  if (historicalString) {
    try {
      historical = JSON.parse(historicalString) as DateValuesWithUnit;
    }
    catch (err) {
      throw new GoalFormError(withDetails(t("forms:goal.errors.failed_parse_historical_data"), err));
    }
  }

  let historicalRecipe: Recipe | undefined = undefined;
  const historicalRecipeString = formData.get(GoalFormName.HistoricalRecipe) as string | null;
  if (historicalRecipeString) {
    try {
      const parsed = Recipe.deserialize(historicalRecipeString);
      if (!parsed.isEmpty() && !(parsed.isManual() && !historical)) {
        historicalRecipe = parsed;
      }
    }
    catch (err) {
      throw new GoalFormError(withDetails(t("forms:goal.errors.failed_parse_recipe"), err));
    }
  }

  return { historical, historicalRecipe };
}

/** The suggested inheritance recipes, if the (currently disabled) section submitted any. */
export function parseRecipeSuggestions(formData: FormData, t: TFunction): SerializedRecipe[] | undefined {
  const recipeSuggestionsString = formData.get(GoalFormName.RecipeSuggestions) as string | null;
  if (!recipeSuggestionsString) return undefined;
  try {
    return JSON.parse(recipeSuggestionsString) as SerializedRecipe[];
  }
  catch (err) {
    throw new GoalFormError(withDetails(t("forms:goal.errors.failed_parse_recipe_suggestions"), err));
  }
}

/*
 * Preview graph input
 */

/** One of the goal's stored series in the shape the goal graph takes, or undefined when the goal has none. */
export function storedSeriesForGraph(
  // The baseline and historical series share this shape
  series: Goal["data_series"],
  name: string,
): (DateValuesWithUnit & { name: string }) | undefined {
  if (!series?.values) return undefined;
  try {
    return { ...dataSeriesToDateValues(series), name };
  } catch {
    return undefined;
  }
}

/** The goal's stored historical series for the graph, named after its source dataset when known. */
export function storedHistoricalForGraph(goal: Pick<Goal, "historical">, t: TFunction) {
  const label = goal.historical ? getHistoricalDataset(goal).label : null;
  return storedSeriesForGraph(
    goal.historical,
    label ? t("graphs:common.historical_series", { label }) : t("common:historical_data"),
  );
}
