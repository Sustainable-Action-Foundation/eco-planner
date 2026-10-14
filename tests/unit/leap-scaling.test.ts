import { expect, test } from "playwright/test";
import { getLeapScalingRule, LeapScalingKind } from "../../src/lib/leapScaling";
import { getLeapSuggestedRecipes, LeapSuggestedRecipeId } from "../../src/components/recipe/suggestions/leapSuggestedRecipes";
import { DefaultSuggestedRecipeId, getSuggestedRecipesFor, PARENT_VALUE_ID, preferredSuggestedRecipeId } from "../../src/components/recipe/suggestions/defaultSuggestedRecipes";
import { Recipe } from "../../src/functions/recipe/recipe";
import { RecipeDataTypes, VectorIndexPickerOptions } from "../../src/functions/recipe/types/enums";
import { GeoAreaType } from "../../src/lib/prisma/generated";
import { UnitFlags } from "../../src/types/enums";
import type { DataSeriesVariable, ExternalVariable, ScalarVariable } from "../../src/functions/recipe/types";
import type { GeoAreaRef, PrefilledSeries } from "../../src/types";
import type { TFunction } from "i18next";

/*
 * The rule table itself (which LEAP row gets which rule) is data and is not
 * re-asserted here; these tests cover what the suggestion builder does with a
 * rule of each kind. Rows are looked up by kind so a mapping edit that keeps
 * the kinds does not break them.
 */

const identityT = ((key: string, options?: Record<string, unknown>) => options ? `${key} ${JSON.stringify(options)}` : key) as TFunction;
const boden: GeoAreaRef = { code: "2582", name: "Boden", type: GeoAreaType.MUNICIPALITY };
const norrbotten: GeoAreaRef = { code: "25", name: "Norrbottens län", type: GeoAreaType.COUNTY };
const sweden: GeoAreaRef = { code: "00", name: "Sverige", type: GeoAreaType.NATION };
const parentSeries: PrefilledSeries = {
  name: "Nationell",
  unit: "GW",
  variable: { id: "00000000-0000-4000-8000-000000000002", name: "Nationell", type: RecipeDataTypes.DataSeries, pick: VectorIndexPickerOptions.Default, unit: UnitFlags.Missing, dataSeriesId: "00000000-0000-4000-8000-000000000001", value: null },
  dateValues: { "2025-01-01T00:00:00.000Z": 10, "2030-01-01T00:00:00.000Z": 20 },
};
const K = "Key\\";

/** One representative row per rule kind, verified to still have that kind before use */
const rows = {
  [LeapScalingKind.Copy]: `${K}Bränslen\\andel låginblandad HVO`,
  [LeapScalingKind.Population]: `${K}Luftfart\\Inrikes\\Bränsleanvändning inrikes flyg`,
  [LeapScalingKind.Ratio]: `${K}Service\\Arbetsmaskiner\\Service\\Energibehov`,
  [LeapScalingKind.Share]: `${K}Landtransporter\\Personbilar\\Elbilar\\Andel av personbilar`,
  [LeapScalingKind.Point]: `${K}Industri\\Cementindustri\\CCS`,
};

function row(kind: keyof typeof rows): string {
  const indicator = rows[kind];
  const rule = getLeapScalingRule(indicator);
  if (rule?.kind !== kind) throw new Error(`"${indicator}" no longer has the ${kind} rule; pick another row for this test`);
  return indicator;
}

function national(indicatorParameter: string, target: GeoAreaRef | null = boden) {
  return getLeapSuggestedRecipes(identityT, { parentSeries, indicatorParameter, geo: { source: sweden, target }, nationalScenario: true });
}

function externals(id: string, recipes: ReturnType<typeof getLeapSuggestedRecipes>): ExternalVariable[] {
  const recipe = recipes.find(recipe => recipe.id === id);
  if (!recipe) throw new Error(`no suggestion ${id}`);
  return Recipe.from(recipe.recipe).variables.filter((variable): variable is ExternalVariable => variable.type === RecipeDataTypes.External);
}

test.describe("LEAP suggested methods", () => {
  test("a ratio rule gives a per-year method with extend() and a latest-value method, regions filled in", () => {
    const recipes = national(row(LeapScalingKind.Ratio));
    expect(recipes.map(recipe => recipe.id)).toEqual([LeapSuggestedRecipeId.RatioYearly, LeapSuggestedRecipeId.RatioLatest]);
    const yearly = Recipe.from(recipes[0].recipe);
    expect(yearly.equation).toContain("extend(year,");
    // Elementwise operators between year vectors
    expect(yearly.equation).toContain(".*");
    expect(yearly.equation).toContain("./");
    const [local, nationalVariable] = externals(LeapSuggestedRecipeId.RatioYearly, recipes);
    expect(local.selection).toContainEqual({ variableCode: "Region", valueCodes: ["2582"] });
    expect(nationalVariable.selection).toContainEqual({ variableCode: "Region", valueCodes: ["00"] });
    expect(local.template).toBe(false);
    expect(local.pick).toBe(VectorIndexPickerOptions.Default);
    // Every external is referenced by id in the equation
    for (const variable of externals(LeapSuggestedRecipeId.RatioYearly, recipes)) {
      expect(yearly.equation).toContain("$" + `{${variable.id}}`);
    }

    const latest = Recipe.from(recipes[1].recipe);
    expect(latest.equation).not.toContain("extend(");
    expect(externals(LeapSuggestedRecipeId.RatioLatest, recipes).every(variable => variable.pick === VectorIndexPickerOptions.Last)).toBe(true);

    // The parent slot is the copied goal's series and the copy keeps its unit
    const parent = yearly.variables.find(variable => variable.id === PARENT_VALUE_ID) as DataSeriesVariable;
    expect(parent.dataSeriesId).toBe(parentSeries.variable.dataSeriesId);
    expect(parent.template).toBe(false);
    expect(yearly.equation).toContain("$" + "{Nationell}");
    expect(yearly.unit).toBe("GW");
    expect(latest.unit).toBe("GW");
  });

  test("a ratio over several denominators sums them on both sides", () => {
    const rule = getLeapScalingRule(row(LeapScalingKind.Ratio));
    if (rule?.kind !== LeapScalingKind.Ratio) throw new Error("expected a ratio");
    expect(rule.denominators.length).toBeGreaterThan(1);
    const recipes = national(row(LeapScalingKind.Ratio));
    const variables = externals(LeapSuggestedRecipeId.RatioYearly, recipes);
    expect(variables).toHaveLength(rule.denominators.length * 2);
    const yearly = Recipe.from(recipes[0].recipe);
    expect(yearly.equation).toContain(" + ");
  });

  test("a share rule divides the local share by the national share, part and whole variables apart", () => {
    const recipes = national(row(LeapScalingKind.Share));
    expect(recipes.map(recipe => recipe.id)).toEqual([LeapSuggestedRecipeId.ShareYearly, LeapSuggestedRecipeId.ShareLatest]);
    const yearly = Recipe.from(recipes[0].recipe);
    expect(yearly.equation).toContain("extend(year,");
    const variables = externals(LeapSuggestedRecipeId.ShareYearly, recipes);
    expect(variables).toHaveLength(4);
    expect(variables.map(variable => variable.id)).toEqual([
      "leap-part-local-0-dummy-uuid", "leap-part-national-0-dummy-uuid",
      "leap-whole-local-0-dummy-uuid", "leap-whole-national-0-dummy-uuid",
    ]);
    // Part and whole read the same table with different fuel codes, locally and nationally
    const fuels = variables.map(variable => variable.selection.find(item => item.variableCode === "drivmedel")?.valueCodes[0]);
    expect(fuels[0]).toBe(fuels[1]);
    expect(fuels[2]).toBe(fuels[3]);
    expect(fuels[0]).not.toBe(fuels[2]);
    expect(variables[0].selection).toContainEqual({ variableCode: "regkom", valueCodes: ["2582"] });
    expect(variables[1].selection.some(item => item.variableCode === "regkom")).toBe(false);
    expect(externals(LeapSuggestedRecipeId.ShareLatest, recipes).every(variable => variable.pick === VectorIndexPickerOptions.Last)).toBe(true);
  });

  test("population uses the municipal forecast per year and the year-end count for the latest value", () => {
    const recipes = national(row(LeapScalingKind.Population));
    expect(recipes.map(recipe => recipe.id)).toEqual([LeapSuggestedRecipeId.PopulationYearly, LeapSuggestedRecipeId.PopulationLatest]);
    const [local, nationalVariable] = externals(LeapSuggestedRecipeId.PopulationYearly, recipes);
    expect(local.tableId).toBe("TAB6299");
    expect(local.selection).toContainEqual({ variableCode: "Region", valueCodes: ["2582"] });
    // The national forecast is its own table without a region dimension
    expect(nationalVariable.tableId).toBe("TAB6579");
    expect(nationalVariable.selection.some(item => item.variableCode === "Region")).toBe(false);
    const latest = externals(LeapSuggestedRecipeId.PopulationLatest, recipes);
    expect(latest.every(variable => variable.tableId === "TAB628")).toBe(true);
    expect(latest.every(variable => variable.pick === VectorIndexPickerOptions.Last)).toBe(true);
  });

  test("a method whose table lacks the target level is left out", () => {
    // The forecast has no national rows, so a nation-wide target only gets the latest-value method
    const recipes = national(row(LeapScalingKind.Population), sweden);
    expect(recipes.map(recipe => recipe.id)).toEqual([LeapSuggestedRecipeId.PopulationLatest]);
    // A county is covered by both
    expect(national(row(LeapScalingKind.Population), norrbotten).map(recipe => recipe.id)).toEqual([LeapSuggestedRecipeId.PopulationYearly, LeapSuggestedRecipeId.PopulationLatest]);
  });

  test("copy and point rules give fixed factors, and need no target area", () => {
    const copy = national(row(LeapScalingKind.Copy), null);
    expect(copy.map(recipe => recipe.id)).toEqual([LeapSuggestedRecipeId.Copy]);
    const factor = Recipe.from(copy[0].recipe).variables.find(variable => variable.type === RecipeDataTypes.Scalar) as ScalarVariable;
    expect(factor.value).toBe(1);

    const point = national(row(LeapScalingKind.Point), null);
    expect(point.map(recipe => recipe.id)).toEqual([LeapSuggestedRecipeId.Copy, LeapSuggestedRecipeId.Zero]);
    const zero = Recipe.from(point[1].recipe).variables.find(variable => variable.type === RecipeDataTypes.Scalar) as ScalarVariable;
    expect(zero.value).toBe(0);
  });

  test("area-based rules give nothing without a target area", () => {
    expect(national(row(LeapScalingKind.Ratio), null)).toEqual([]);
    expect(national(row(LeapScalingKind.Share), null)).toEqual([]);
    expect(national(row(LeapScalingKind.Population), null)).toEqual([]);
  });

  test("a copied LEAP goal shows only its own methods and starts on the first", () => {
    const context = { parentSeries, indicatorParameter: row(LeapScalingKind.Copy), geo: { source: sweden, target: boden }, nationalScenario: true };
    const offered = getSuggestedRecipesFor(identityT, context);
    expect(offered.map(recipe => recipe.id)).toEqual([LeapSuggestedRecipeId.Copy]);
    expect(preferredSuggestedRecipeId(identityT, context)).toBe(LeapSuggestedRecipeId.Copy);

    const ratio = { ...context, indicatorParameter: row(LeapScalingKind.Ratio) };
    expect(getSuggestedRecipesFor(identityT, ratio).map(recipe => recipe.id)).toEqual([LeapSuggestedRecipeId.RatioYearly, LeapSuggestedRecipeId.RatioLatest]);
    expect(preferredSuggestedRecipeId(identityT, ratio)).toBe(LeapSuggestedRecipeId.RatioYearly);
  });

  test("goals without a rule, or outside the national scenarios, get the defaults", () => {
    expect(getLeapScalingRule("Demand\\Other")).toBeNull();
    expect(getSuggestedRecipesFor(identityT, { parentSeries, indicatorParameter: "Demand\\Other", geo: { source: sweden, target: boden }, nationalScenario: true }).map(recipe => recipe.id)).toContain(DefaultSuggestedRecipeId.Population);
    // A LEAP-looking indicator in a local roadmap is not a LEAP goal
    expect(getSuggestedRecipesFor(identityT, { parentSeries, indicatorParameter: row(LeapScalingKind.Copy), geo: { source: sweden, target: boden } }).map(recipe => recipe.id)).toContain(DefaultSuggestedRecipeId.Population);
    expect(getLeapSuggestedRecipes(identityT, { parentSeries, indicatorParameter: row(LeapScalingKind.Copy), geo: { source: sweden, target: boden } })).toEqual([]);
    // Nor is one without a series to scale
    expect(getLeapSuggestedRecipes(identityT, { indicatorParameter: row(LeapScalingKind.Copy), geo: { source: sweden, target: boden }, nationalScenario: true })).toEqual([]);
  });
});

test.describe("extend()", () => {
  test("carries the series across leading, interior and trailing gaps", async () => {
    const mathjs = (await import("../../src/math")).default;
    const out = mathjs.evaluate("extend(y, s)", { y: [2020, 2021, 2022, 2023, 2024], s: [NaN, 5, NaN, 7, NaN] }) as unknown;
    const values = (mathjs.isMatrix(out) ? out.toArray() : out) as unknown[];
    expect(values.map(v => (mathjs.isUnit(v) ? v.toNumber() : v))).toEqual([5, 5, 5, 7, 7]);
  });

  test("leaves a complete series as it is", async () => {
    const mathjs = (await import("../../src/math")).default;
    const out = mathjs.evaluate("extend(y, s)", { y: [2020, 2021, 2022], s: [1, 2, 3] }) as unknown;
    const values = (mathjs.isMatrix(out) ? out.toArray() : out) as unknown[];
    expect(values.map(v => (mathjs.isUnit(v) ? v.toNumber() : v))).toEqual([1, 2, 3]);
  });
});
