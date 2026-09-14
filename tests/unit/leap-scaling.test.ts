import { expect, test } from "playwright/test";
import { DenominatorLabel, getLeapScalingRule, LeapScalingKind } from "../../src/lib/leapScaling";
import { getLeapSuggestedRecipes, LeapSuggestedRecipeId } from "../../src/components/recipe/suggestions/leapSuggestedRecipes";
import { DefaultSuggestedRecipeId, getSuggestedRecipesFor, preferredSuggestedRecipeId } from "../../src/components/recipe/suggestions/defaultSuggestedRecipes";
import { Recipe } from "../../src/functions/recipe/recipe";
import { RecipeDataTypes, VectorIndexPickerOptions } from "../../src/functions/recipe/types/enums";
import { GeoAreaType } from "../../src/lib/prisma/generated";
import { UnitFlags } from "../../src/types/enums";
import type { ExternalVariable } from "../../src/functions/recipe/types";
import type { GeoAreaRef, PrefilledSeries } from "../../src/types";
import type { TFunction } from "i18next";

const identityT = ((key: string, options?: Record<string, unknown>) => options ? `${key} ${JSON.stringify(options)}` : key) as TFunction;
const boden: GeoAreaRef = { code: "2582", name: "Boden", type: GeoAreaType.MUNICIPALITY };
const sweden: GeoAreaRef = { code: "00", name: "Sverige", type: GeoAreaType.NATION };
const parentSeries: PrefilledSeries = {
  name: "Nationell",
  unit: "GW",
  variable: { id: "00000000-0000-4000-8000-000000000002", name: "Nationell", type: RecipeDataTypes.DataSeries, pick: VectorIndexPickerOptions.Default, unit: UnitFlags.Missing, dataSeriesId: "00000000-0000-4000-8000-000000000001", value: null },
  dateValues: { "2025-01-01T00:00:00.000Z": 10, "2030-01-01T00:00:00.000Z": 20 },
};
const K = "Key\\";

test.describe("LEAP scaling rules", () => {
  test("intensities, shares and policy rows are copied unchanged", () => {
    for (const indicator of [
      `${K}Bostäder och lokaler\\Småhus\\Värmebehov per kvadratmeter uppvärmd yta`,
      `${K}Landtransporter\\Personbilar\\Elbilar\\Andel av personbilar`,
      `${K}Landtransporter\\Personbilar\\Elbilar\\kWh per km`,
      `${K}Landtransporter\\Personbilar\\Cykelstrategi`,
      `${K}Bränslen\\andel låginblandad HVO`,
      `${K}Landtransporter\\Bussar\\Fyra av tio reser kollektivt`,
    ]) {
      expect(getLeapScalingRule(indicator)?.kind, indicator).toBe(LeapScalingKind.Copy);
    }
  });

  test("resident-driven totals scale by population", () => {
    expect(getLeapScalingRule(`${K}Luftfart\\Inrikes\\Fordonskm personresor inrikes`)?.kind).toBe(LeapScalingKind.Population);
    expect(getLeapScalingRule(`${K}Service\\Arbetsmaskiner\\Hushåll\\Energibehov`)?.kind).toBe(LeapScalingKind.Population);
    expect(getLeapScalingRule(`${K}Befolkning\\Befolkning`)?.kind).toBe(LeapScalingKind.Population);
    const rail = getLeapScalingRule(`${K}Landtransporter\\Bantrafik\\Tågkm godstrafik eldrift`);
    expect(rail?.kind === LeapScalingKind.Population && rail.consumptionBased).toBe(true);
  });

  test("sector totals scale by the sector's own energy use, summing categories", () => {
    const rule = getLeapScalingRule(`${K}Service\\Arbetsmaskiner\\Service\\Energibehov`);
    if (rule?.kind !== LeapScalingKind.Ratio) throw new Error("expected a ratio");
    expect(rule.denominators.map(d => d.local.selection.find(i => i.variableCode === "Forbrukningskategri")?.valueCodes[0])).toEqual(["931", "951"]);
    expect(rule.denominators.every(d => d.local.tableId === "TAB3654")).toBe(true);
  });

  test("fuel detail scales by its class inside the aggregate", () => {
    const rule = getLeapScalingRule(`${K}Energiomvandlingsanläggningar\\Insatta bränslen för fjärrvärmeproduktion\\Eldningsolja 1`);
    if (rule?.kind !== LeapScalingKind.Ratio) throw new Error("expected a ratio");
    expect(rule.denominators[0].label).toBe(DenominatorLabel.DistrictHeatingFuelClass);
    expect(rule.denominators[0].local.selection).toContainEqual({ variableCode: "Bransle", valueCodes: ["905"] });
    const industry = getLeapScalingRule(`${K}Industri\\Cementindustri\\Naturgas`);
    if (industry?.kind !== LeapScalingKind.Ratio) throw new Error("expected a ratio");
    expect(industry.denominators[0].local.selection).toContainEqual({ variableCode: "Forbrukningskategri", valueCodes: ["921"] });
    expect(industry.denominators[0].local.selection).toContainEqual({ variableCode: "Bransle", valueCodes: ["915"] });
  });

  test("vehicle counts scale by the same vehicle class", () => {
    const heavy = getLeapScalingRule(`${K}Landtransporter\\Tunga fjärrlastbilar\\LNGgaslastbilar`);
    if (heavy?.kind !== LeapScalingKind.Ratio) throw new Error("expected a ratio");
    expect(heavy.denominators[0].local.tableId).toBe("t10023");
    expect(heavy.denominators[0].local.selection).toContainEqual({ variableCode: "fslagh", valueCodes: ["23"] });
    expect(heavy.denominators[0].local.selection).toContainEqual({ variableCode: "drivmedel", valueCodes: ["107"] });
    const bus = getLeapScalingRule(`${K}Landtransporter\\Bussar\\Stadsbussar\\elbussar`);
    if (bus?.kind !== LeapScalingKind.Ratio) throw new Error("expected a ratio");
    expect(bus.denominators[0].local.tableId).toBe("t10021");
  });

  test("point sources and unknown rows", () => {
    expect(getLeapScalingRule(`${K}Industri\\Cementindustri\\CCS`)?.kind).toBe(LeapScalingKind.Point);
    expect(getLeapScalingRule(`${K}Energiomvandlingsanläggningar\\Årlig elproduktion\\Ny kärnkraft`)?.kind).toBe(LeapScalingKind.Point);
    expect(getLeapScalingRule(`${K}Service\\Stationär energianvändning\\Datacenter\\El ej uppvärmning`)?.kind).toBe(LeapScalingKind.Point);
    expect(getLeapScalingRule("Demand\\Something\\Else")).toBeNull();
  });
});

function externals(id: string, recipes: ReturnType<typeof getLeapSuggestedRecipes>): ExternalVariable[] {
  const recipe = recipes.find(recipe => recipe.id === id);
  if (!recipe) throw new Error(`no suggestion ${id}`);
  return Recipe.from(recipe.recipe).variables.filter((variable): variable is ExternalVariable => variable.type === RecipeDataTypes.External);
}

test.describe("LEAP suggested methods", () => {
  test("a ratio rule gives a per-year method with extend() and a latest-value method, regions filled in", () => {
    const recipes = getLeapSuggestedRecipes(identityT, { parentSeries, indicatorParameter: `${K}Service\\Arbetsmaskiner\\Service\\Energibehov`, geo: { source: sweden, target: boden } });
    expect(recipes.map(recipe => recipe.id)).toEqual([LeapSuggestedRecipeId.RatioYearly, LeapSuggestedRecipeId.RatioLatest]);
    const yearly = Recipe.from(recipes[0].recipe);
    expect(yearly.equation).toContain("extend(year,");
    const [local, national] = externals(LeapSuggestedRecipeId.RatioYearly, recipes);
    expect(local.selection).toContainEqual({ variableCode: "Region", valueCodes: ["2582"] });
    expect(national.selection).toContainEqual({ variableCode: "Region", valueCodes: ["00"] });
    expect(local.template).toBe(false);
    expect(externals(LeapSuggestedRecipeId.RatioLatest, recipes).every(variable => variable.pick === VectorIndexPickerOptions.Last)).toBe(true);
    // The parent slot is the copied goal's series and the copy keeps its unit
    expect(yearly.variables.some(variable => variable.type === RecipeDataTypes.DataSeries && variable.dataSeriesId === parentSeries.variable.dataSeriesId)).toBe(true);
    expect(yearly.unit).toBe("GW");
  });

  test("population uses the municipal forecast locally and the national forecast for the nation", () => {
    const recipes = getLeapSuggestedRecipes(identityT, { parentSeries, indicatorParameter: `${K}Luftfart\\Inrikes\\Bränsleanvändning inrikes flyg`, geo: { source: sweden, target: boden } });
    const [local, national] = externals(LeapSuggestedRecipeId.PopulationYearly, recipes);
    expect(local.tableId).toBe("TAB6299");
    expect(national.tableId).toBe("TAB6579");
    expect(national.selection.some(item => item.variableCode === "Region")).toBe(false);
    expect(externals(LeapSuggestedRecipeId.PopulationLatest, recipes)[0].tableId).toBe("TAB628");
  });

  test("a copied LEAP goal shows only its own methods and starts on the first", () => {
    const context = { parentSeries, indicatorParameter: `${K}Bränslen\\andel låginblandad HVO`, geo: { source: sweden, target: boden } };
    const offered = getSuggestedRecipesFor(identityT, context);
    expect(offered.map(recipe => recipe.id)).toEqual([LeapSuggestedRecipeId.Copy]);
    expect(preferredSuggestedRecipeId(identityT, context)).toBe(LeapSuggestedRecipeId.Copy);
    // A goal without a rule gets the defaults
    expect(getSuggestedRecipesFor(identityT, { parentSeries, indicatorParameter: "Demand\\Other", geo: { source: sweden, target: boden } }).map(recipe => recipe.id)).toContain(DefaultSuggestedRecipeId.Population);
  });
});

test.describe("extend()", () => {
  test("carries the series across leading, interior and trailing gaps", async () => {
    const mathjs = (await import("../../src/math")).default;
    const out = mathjs.evaluate("extend(y, s)", { y: [2020, 2021, 2022, 2023, 2024], s: [NaN, 5, NaN, 7, NaN] }) as unknown;
    const values = (mathjs.isMatrix(out) ? out.toArray() : out) as unknown[];
    expect(values.map(v => (mathjs.isUnit(v) ? v.toNumber() : v))).toEqual([5, 5, 5, 7, 7]);
  });
});
