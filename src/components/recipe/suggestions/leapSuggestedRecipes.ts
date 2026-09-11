import { Recipe } from "@/functions/recipe/recipe";
import { RecipeDataTypes, VectorIndexPickerOptions } from "@/functions/recipe/types/enums";
import { buildRegionSelection } from "@/lib/curatedHistoricalData";
import { DenominatorLabel, getLeapScalingRule, LeapScalingKind, population, populationForecast } from "@/lib/leapScaling";
import type { ScalingDenominator, ScalingSource } from "@/lib/leapScaling";
import type { ExternalVariable, ScalarVariable } from "@/functions/recipe/types";
import type { DBRecipe, GeoAreaRef } from "@/types";
import { UnitFlags } from "@/types/enums";
import { parseUnit } from "@/functions/unit";
import type { TFunction } from "i18next";
import { dataSeriesTemplate, PARENT_VALUE_ID, withParentSeries } from "./defaultSuggestedRecipes";
import type { SuggestedRecipeContext } from "./defaultSuggestedRecipes";

/*
 * The suggested methods for a copied LEAP goal, from its scaling rule (see
 * `leapScaling`) and the target roadmap's area. Every variable is concrete, so
 * nothing is left to pick. Two shapes:
 *
 * - per year: `goal * extend(year, local) / extend(year, national)`, a factor
 *   for every year of the horizon, held constant past the last statistic;
 * - latest: the same ratio read once at the latest value, a plain factor.
 */

export const LeapSuggestedRecipeId = {
  Copy: "leap-copy-recipe-dummy-uuid",
  Zero: "leap-zero-recipe-dummy-uuid",
  PopulationYearly: "leap-population-yearly-recipe-dummy-uuid",
  PopulationLatest: "leap-population-latest-recipe-dummy-uuid",
  RatioYearly: "leap-ratio-yearly-recipe-dummy-uuid",
  RatioLatest: "leap-ratio-latest-recipe-dummy-uuid",
} as const;
export type LeapSuggestedRecipeId = (typeof LeapSuggestedRecipeId)[keyof typeof LeapSuggestedRecipeId];

const NATION: GeoAreaRef = { code: "00", name: "Sverige", type: "NATION" };

/** The source read for an area, or null when the table has no rows at that level. */
function external(id: string, name: string, source: ScalingSource, area: GeoAreaRef, pick: VectorIndexPickerOptions): ExternalVariable | null {
  if (!source.levels.includes(area.type)) return null;
  const region = buildRegionSelection(source.region, area);
  if (region === null) return null;
  return {
    id,
    name,
    type: RecipeDataTypes.External,
    dataset: source.dataset,
    tableId: source.tableId,
    selection: [...region, ...source.selection],
    pick,
    unit: UnitFlags.Missing,
    template: false,
  };
}

/**
 * The local and national variables of every denominator, or null when one
 * can't be read for the target area. Equations refer to them by id.
 */
function denominatorVariables(t: TFunction, denominators: ScalingDenominator[], target: GeoAreaRef, pick: VectorIndexPickerOptions): { variables: ExternalVariable[], local: string[], national: string[] } | null {
  const variables: ExternalVariable[] = [];
  const local: string[] = [];
  const national: string[] = [];
  denominators.forEach((denominator, index) => {
    const what = t(`components:recipe_editor.leap_scaling.denominators.${denominator.label}`);
    const localVariable = external(`leap-local-${index}-dummy-uuid`, t("components:recipe_editor.leap_scaling.local", { area: target.name, what }), denominator.local, target, pick);
    const nationalVariable = external(`leap-national-${index}-dummy-uuid`, t("components:recipe_editor.leap_scaling.national", { what }), denominator.national ?? denominator.local, NATION, pick);
    if (localVariable && nationalVariable) {
      variables.push(localVariable, nationalVariable);
      local.push(`\${${localVariable.id}}`);
      national.push(`\${${nationalVariable.id}}`);
    }
  });
  if (local.length !== denominators.length) return null;
  return { variables, local, national };
}

const sum = (terms: string[]) => terms.length === 1 ? terms[0] : `(${terms.join(" + ")})`;

/** `goal * local / national`, per year or at the latest value. */
function ratioRecipes(t: TFunction, ids: { yearly: string, latest: string }, names: { yearly: string, latest: string }, denominators: ScalingDenominator[], target: GeoAreaRef): { id: string, recipe: Recipe }[] {
  const parentValue = t("components:recipe_editor.leap_scaling.national_goal");
  const recipes: { id: string, recipe: Recipe }[] = [];

  const yearly = denominatorVariables(t, denominators, target, VectorIndexPickerOptions.Default);
  if (yearly) {
    recipes.push({
      id: ids.yearly,
      recipe: new Recipe({
        name: names.yearly,
        // Elementwise: plain * and / between two year-vectors are matrix operations in mathjs
        equation: `\${${parentValue}} .* extend(year, ${sum(yearly.local)}) ./ extend(year, ${sum(yearly.national)})`,
        variables: [dataSeriesTemplate(PARENT_VALUE_ID, parentValue), ...yearly.variables],
        meta: { isSuggestedRecipe: true },
      }),
    });
  }
  const latest = denominatorVariables(t, denominators, target, VectorIndexPickerOptions.Last);
  if (latest) {
    recipes.push({
      id: ids.latest,
      recipe: new Recipe({
        name: names.latest,
        equation: `\${${parentValue}} * ${sum(latest.local)} / ${sum(latest.national)}`,
        variables: [dataSeriesTemplate(PARENT_VALUE_ID, parentValue), ...latest.variables],
        meta: { isSuggestedRecipe: true },
      }),
    });
  }
  return recipes;
}

/** `goal * factor` with a fixed factor. */
function factorRecipe(t: TFunction, id: string, name: string, factor: number): { id: string, recipe: Recipe } {
  const parentValue = t("components:recipe_editor.leap_scaling.national_goal");
  const scalar: ScalarVariable = { id: "leap-factor-dummy-uuid", name: t("components:recipe_editor.leap_scaling.factor"), type: RecipeDataTypes.Scalar, value: factor, unit: UnitFlags.Unitless };
  return {
    id,
    recipe: new Recipe({
      name,
      equation: `\${${parentValue}} * \${${scalar.name}}`,
      variables: [dataSeriesTemplate(PARENT_VALUE_ID, parentValue), scalar],
      meta: { isSuggestedRecipe: true },
    }),
  };
}

/**
 * The methods the LEAP scaling rule gives a copied goal in the target area, in
 * order of preference; empty when the rule needs an area the target isn't.
 */
export function getLeapSuggestedRecipes(t: TFunction, context: SuggestedRecipeContext): DBRecipe[] {
  const { parentSeries, indicatorParameter } = context;
  const target = context.geo?.target ?? null;
  if (!parentSeries || !indicatorParameter) return [];
  const rule = getLeapScalingRule(indicatorParameter);
  if (!rule) return [];

  const recipes: { id: string, recipe: Recipe }[] = [];
  switch (rule.kind) {
    case LeapScalingKind.Copy: {
      recipes.push(factorRecipe(t, LeapSuggestedRecipeId.Copy, t("components:recipe_editor.leap_scaling.copy_name"), 1));
      break;
    }
    case LeapScalingKind.Point: {
      recipes.push(factorRecipe(t, LeapSuggestedRecipeId.Copy, t("components:recipe_editor.leap_scaling.copy_name"), 1));
      recipes.push(factorRecipe(t, LeapSuggestedRecipeId.Zero, t("components:recipe_editor.leap_scaling.zero_name"), 0));
      break;
    }
    case LeapScalingKind.Population: {
      if (!target) break;
      const suffix = rule.consumptionBased ? ` ${t("components:recipe_editor.leap_scaling.consumption_based")}` : "";
      // The forecast covers the horizon per year; the year-end count is the plain base-year factor
      recipes.push(...ratioRecipes(t,
        { yearly: LeapSuggestedRecipeId.PopulationYearly, latest: LeapSuggestedRecipeId.PopulationLatest },
        { yearly: t("components:recipe_editor.leap_scaling.population_yearly_name") + suffix, latest: t("components:recipe_editor.leap_scaling.population_latest_name") + suffix },
        [populationForecast], target).filter(recipe => recipe.id === LeapSuggestedRecipeId.PopulationYearly));
      recipes.push(...ratioRecipes(t,
        { yearly: "unused", latest: LeapSuggestedRecipeId.PopulationLatest },
        { yearly: "", latest: t("components:recipe_editor.leap_scaling.population_latest_name") + suffix },
        [population], target).filter(recipe => recipe.id === LeapSuggestedRecipeId.PopulationLatest));
      break;
    }
    case LeapScalingKind.Ratio: {
      if (!target) break;
      const what = t(`components:recipe_editor.leap_scaling.denominators.${rule.denominators[0].label}`);
      recipes.push(...ratioRecipes(t,
        { yearly: LeapSuggestedRecipeId.RatioYearly, latest: LeapSuggestedRecipeId.RatioLatest },
        { yearly: t("components:recipe_editor.leap_scaling.ratio_yearly_name", { what }), latest: t("components:recipe_editor.leap_scaling.ratio_latest_name", { what }) },
        rule.denominators, target));
      break;
    }
    default: {
      throw new Error(`Unknown LEAP scaling rule "${String((rule satisfies never as { kind: string }).kind)}"`);
    }
  }

  return recipes.map(({ id, recipe }) => {
    const withParent = withParentSeries(recipe, parentSeries);
    // The ratio is dimensionless and a factor unitless, so the copy keeps the goal's unit
    if (parentSeries.unit) withParent.unit = parseUnit(parentSeries.unit);
    return { id, recipe: withParent.serialize() };
  });
}

// DenominatorLabel is referenced so the locale keys under `denominators.*` stay tied to the enum
void DenominatorLabel;
