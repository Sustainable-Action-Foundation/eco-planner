import { expect, test } from "playwright/test";
import {
  copySuggestionContext,
  DefaultSuggestedRecipeId,
  getDefaultSuggestedRecipes,
  getGoalSuggestedRecipes,
  getSuggestedRecipesFor,
  isUnscaledSuggestion,
  PARENT_VALUE_ID,
  preferredSuggestedRecipeId,
  preferredSuggestion,
  prefillForArea,
  withParentSeries,
} from "../../src/components/recipe/suggestions/defaultSuggestedRecipes";
import type { SuggestedRecipeContext } from "../../src/components/recipe/suggestions/defaultSuggestedRecipes";
import { RecipeDataTypes, VectorIndexPickerOptions } from "../../src/functions/recipe/types/enums";
import { Recipe } from "../../src/functions/recipe/recipe";
import { LeapSuggestedRecipeId } from "../../src/components/recipe/suggestions/leapSuggestedRecipes";
import { buildRegionSelection, CuratedRegionKind } from "../../src/lib/curatedHistoricalData";
import { GeoAreaType, RoadmapType } from "../../src/lib/prisma/generated";
import { UnitFlags } from "../../src/types/enums";
import type { DataSeriesVariable, ExternalVariable, ScalarVariable } from "../../src/functions/recipe/types";
import type { GeoAreaRef, GoalPrefill, PrefilledSeries } from "../../src/types";
import type { TFunction } from "i18next";

const identityT = ((key: string) => key) as TFunction;

const sweden: GeoAreaRef = { code: "00", name: "Sverige", type: GeoAreaType.NATION };
const norrbotten: GeoAreaRef = { code: "25", name: "Norrbottens län", type: GeoAreaType.COUNTY };
const boden: GeoAreaRef = { code: "2582", name: "Boden", type: GeoAreaType.MUNICIPALITY };

const parentSeries: PrefilledSeries = {
  name: "Antal bilar",
  unit: null,
  variable: { id: "00000000-0000-4000-8000-000000000002", name: "Antal bilar", type: RecipeDataTypes.DataSeries, pick: VectorIndexPickerOptions.Default, unit: UnitFlags.Missing, dataSeriesId: "00000000-0000-4000-8000-000000000001", value: null },
  dateValues: { "2025-01-01T00:00:00.000Z": 100, "2030-01-01T00:00:00.000Z": 200 },
};
const localReference = {
  series: { name: "Elbilar i Boden", unit: "antal", variable: { id: "00000000-0000-4000-8000-000000000003", name: "Elbilar i Boden", type: RecipeDataTypes.External, pick: VectorIndexPickerOptions.Default, unit: UnitFlags.Missing, dataset: "Trafa", tableId: "t10026", selection: [] } as ExternalVariable },
  year: 2025,
  goalValue: 100,
};

/** Built by concatenation so the literal isn't mistaken for a template string */
const ref = (name: string) => "$" + `{${name}}`;

function externals(id: string, context: SuggestedRecipeContext): ExternalVariable[] {
  const recipe = getDefaultSuggestedRecipes(identityT, context).find(recipe => recipe.id === id);
  if (!recipe) throw new Error(`no suggestion ${id}`);
  return Recipe.from(recipe.recipe).variables.filter((variable): variable is ExternalVariable => variable.type === RecipeDataTypes.External);
}

test.describe("Default suggestions and areas", () => {
  test("known areas fill in the regions of the ratio methods", () => {
    const [parent, child] = externals(DefaultSuggestedRecipeId.Population, { parentSeries, geo: { source: sweden, target: boden } });
    expect(parent.tableId).toBe("TAB628");
    expect(parent.selection).toContainEqual({ variableCode: "Region", valueCodes: ["00"] });
    expect(child.selection).toContainEqual({ variableCode: "Region", valueCodes: ["2582"] });
    expect(parent.template).toBe(false);
    expect(child.template).toBe(false);
  });

  test("Trafa presets take the county along with the municipality", () => {
    const [, child] = externals("electric-cars-recipe-dummy-uuid", { parentSeries, geo: { source: sweden, target: boden } });
    expect(child.selection).toContainEqual({ variableCode: "reglan", valueCodes: ["25"] });
    expect(child.selection).toContainEqual({ variableCode: "regkom", valueCodes: ["2582"] });
    expect(child.selection).toContainEqual({ variableCode: "drivmedel", valueCodes: ["103"] });
    expect(child.template).toBe(false);
  });

  test("a county-level target selects only the county in Trafa presets", () => {
    const [parent, child] = externals("passenger-cars-recipe-dummy-uuid", { parentSeries, geo: { source: sweden, target: norrbotten } });
    expect(child.selection).toContainEqual({ variableCode: "reglan", valueCodes: ["25"] });
    expect(child.selection.some(item => item.variableCode === "regkom")).toBe(false);
    expect(child.template).toBe(false);
    // The nation is the query without any region dimension
    expect(parent.selection.some(item => item.variableCode === "reglan" || item.variableCode === "regkom")).toBe(false);
    expect(parent.template).toBe(false);
  });

  test("without areas the regions stay for the user to pick", () => {
    const [parent, child] = externals(DefaultSuggestedRecipeId.Population, { parentSeries });
    expect(parent.template).toBe(true);
    expect(child.selection.some(item => item.variableCode === "Region")).toBe(false);
  });

  test("a preset region left half-known keeps only the known side filled", () => {
    const [parent, child] = externals(DefaultSuggestedRecipeId.Population, { parentSeries, geo: { source: sweden, target: null } });
    expect(parent.template).toBe(false);
    expect(child.template).toBe(true);
  });

  test("an unsupported area type is an error rather than an empty region", () => {
    const planet = { code: "99", name: "Tellus", type: "PLANET" as GeoAreaType };
    expect(() => buildRegionSelection({ kind: CuratedRegionKind.Trafa }, planet)).toThrow(/Unknown geo area type/);
    expect(() => getDefaultSuggestedRecipes(identityT, { parentSeries, geo: { source: sweden, target: planet } })).toThrow(/Unknown geo area type/);
  });

  test("a copy prefers its local statistic, then population, then the series as is", () => {
    expect(preferredSuggestedRecipeId(identityT, { parentSeries, localReference, geo: { source: sweden, target: boden } })).toBe(DefaultSuggestedRecipeId.LocalScale);
    expect(preferredSuggestedRecipeId(identityT, { parentSeries, geo: { source: sweden, target: boden } })).toBe(DefaultSuggestedRecipeId.Population);
    expect(preferredSuggestedRecipeId(identityT, { parentSeries, geo: { source: sweden, target: null } })).toBe(DefaultSuggestedRecipeId.Scalar);
    expect(preferredSuggestedRecipeId(identityT, { parentSeries })).toBe(DefaultSuggestedRecipeId.Scalar);
    expect(preferredSuggestedRecipeId(identityT, {})).toBe(DefaultSuggestedRecipeId.Scalar);
  });

  test("a prefill follows the target area's local statistic, and picks its method like the form", () => {
    const prefill: GoalPrefill = {
      parent: parentSeries,
      copy: { id: "goal-id", name: null, description: null, indicatorParameter: "Antal bilar" },
      sourceGeoArea: sweden,
      sourceRoadmapType: RoadmapType.NATIONAL,
      byArea: { [boden.code]: { historical: localReference.series, localReference } },
    };
    const uppsala: GeoAreaRef = { code: "0380", name: "Uppsala", type: GeoAreaType.MUNICIPALITY };

    // Boden has the statistic: the copy follows it
    const inBoden = prefillForArea(prefill, boden);
    expect(inBoden.localReference).toBe(localReference);
    expect(inBoden.historical).toBe(localReference.series);
    expect(preferredSuggestion(identityT, copySuggestionContext(inBoden, { source: sweden, target: boden }))?.id).toBe(DefaultSuggestedRecipeId.LocalScale);

    // Uppsala doesn't: population between the areas
    const inUppsala = prefillForArea(prefill, uppsala);
    expect(inUppsala.localReference).toBeUndefined();
    expect(preferredSuggestion(identityT, copySuggestionContext(inUppsala, { source: sweden, target: uppsala }))?.id).toBe(DefaultSuggestedRecipeId.Population);

    // No area at all: the series as is, which is not a scaling
    const nowhere = preferredSuggestion(identityT, copySuggestionContext(prefillForArea(prefill, null), { source: sweden, target: null }));
    expect(nowhere?.id).toBe(DefaultSuggestedRecipeId.Scalar);
    expect(isUnscaledSuggestion(nowhere?.id ?? "")).toBe(true);
    expect(isUnscaledSuggestion(LeapSuggestedRecipeId.Copy)).toBe(true);
    expect(isUnscaledSuggestion(DefaultSuggestedRecipeId.LocalScale)).toBe(false);
    expect(isUnscaledSuggestion(LeapSuggestedRecipeId.ShareYearly)).toBe(false);
  });

  test("copySuggestionContext carries the copy's indicator, scenario type and stored methods", () => {
    const stored = new Recipe({ name: "egen", equation: ref("x"), variables: [{ id: "x", name: "x", type: RecipeDataTypes.Scalar, value: 1, unit: UnitFlags.Unitless }] }).serialize();
    const prefill: GoalPrefill = {
      parent: parentSeries,
      copy: { id: "goal-id", name: null, description: null, indicatorParameter: "Key\\Befolkning\\Befolkning" },
      sourceRoadmapType: RoadmapType.NATIONAL,
      storedSuggestions: [stored],
    };
    const context = copySuggestionContext(prefill, { source: sweden, target: boden });
    expect(context).toEqual({ parentSeries, localReference: undefined, geo: { source: sweden, target: boden }, indicatorParameter: "Key\\Befolkning\\Befolkning", nationalScenario: true, storedSuggestions: [stored] });
    expect(copySuggestionContext({ ...prefill, sourceRoadmapType: RoadmapType.LOCAL }, {}).nationalScenario).toBe(false);
  });
});

test.describe("Parent value substitution", () => {
  test("every default method with a parent value gets the series in its place", () => {
    const suggestions = getDefaultSuggestedRecipes(identityT, { parentSeries });
    const templateIds = getDefaultSuggestedRecipes(identityT, {})
      .filter(suggestion => Recipe.from(suggestion.recipe).variables.some(variable => variable.id === PARENT_VALUE_ID))
      .map(suggestion => suggestion.id);
    expect(templateIds).toContain(DefaultSuggestedRecipeId.Scalar);
    expect(templateIds).not.toContain("sum-recipe-dummy-uuid");

    for (const suggestion of suggestions) {
      const recipe = Recipe.from(suggestion.recipe);
      const parent = recipe.variables.find(variable => variable.id === PARENT_VALUE_ID);
      if (!templateIds.includes(suggestion.id)) {
        expect(parent, suggestion.id).toBeUndefined();
        continue;
      }
      expect(parent?.type, suggestion.id).toBe(RecipeDataTypes.DataSeries);
      expect((parent as DataSeriesVariable).dataSeriesId, suggestion.id).toBe(parentSeries.variable.dataSeriesId);
      expect(parent?.template, suggestion.id).toBe(false);
      expect(parent?.name, suggestion.id).toBe("Antal bilar");
      expect(recipe.equation, suggestion.id).toContain(ref("Antal bilar"));
      expect(recipe.equation, suggestion.id).not.toContain(ref("components:"));
    }
  });

  test("withParentSeries keeps the recipe's own pick and rewrites the equation by name", () => {
    const suggestions = getDefaultSuggestedRecipes(identityT, {});
    const reachTarget = Recipe.from(suggestions.find(suggestion => suggestion.id === DefaultSuggestedRecipeId.ReachTarget)?.recipe ?? "");
    const trend = Recipe.from(suggestions.find(suggestion => suggestion.id === DefaultSuggestedRecipeId.Trend)?.recipe ?? "");

    const withParent = withParentSeries(reachTarget, parentSeries);
    const parent = withParent.variables.find(variable => variable.id === PARENT_VALUE_ID) as DataSeriesVariable;
    expect(parent.pick).toBe(VectorIndexPickerOptions.Last);
    expect(parent.dataSeriesId).toBe(parentSeries.variable.dataSeriesId);
    expect(withParent.equation).toBe(`reachBy(year, ${ref("Antal bilar")}, ${ref("components:recipe_editor.default_reach_target_recipe.target")}, ${ref("components:recipe_editor.default_reach_target_recipe.start_year")}, ${ref("components:recipe_editor.default_reach_target_recipe.target_year")})`);
    expect((withParentSeries(trend, parentSeries).variables.find(variable => variable.id === PARENT_VALUE_ID) as DataSeriesVariable).pick).toBe(VectorIndexPickerOptions.Whole);

    // The original is untouched
    expect(reachTarget.variables.find(variable => variable.id === PARENT_VALUE_ID)?.template).toBe(true);
    expect(reachTarget.equation).toContain(ref("components:recipe_editor.default_reach_target_recipe.parent_value"));
  });

  test("withParentSeries declares the series' unit on the recipe when it has one", () => {
    const scalar = Recipe.from(getDefaultSuggestedRecipes(identityT, {}).find(suggestion => suggestion.id === DefaultSuggestedRecipeId.Scalar)?.recipe ?? "");
    expect(withParentSeries(scalar, parentSeries).unit).toBe(UnitFlags.Missing);
    expect(withParentSeries(scalar, { ...parentSeries, unit: "GWh" }).unit).toBe("GWh");
  });

  test("withParentSeries substitutes an external series as well", () => {
    const scalar = Recipe.from(getDefaultSuggestedRecipes(identityT, {}).find(suggestion => suggestion.id === DefaultSuggestedRecipeId.Scalar)?.recipe ?? "");
    const withExternal = withParentSeries(scalar, localReference.series);
    const parent = withExternal.variables.find(variable => variable.id === PARENT_VALUE_ID) as ExternalVariable;
    expect(parent.type).toBe(RecipeDataTypes.External);
    expect(parent.tableId).toBe("t10026");
    expect(parent.template).toBe(false);
    expect(withExternal.equation).toBe(`${ref("Elbilar i Boden")} * ${ref("components:recipe_editor.default_scalar_recipe.scalar")}`);
  });

  test("withParentSeries leaves recipes without a parent slot alone", () => {
    // The docstring says the combining recipes are returned as is, but the
    // stored-suggestion fallback (first template data series) catches them too
    test.fail(true, "withParentSeries substitutes the first series of the sum/difference recipes, contrary to its docstring");
    const sum = Recipe.from(getDefaultSuggestedRecipes(identityT, {}).find(suggestion => suggestion.id === "sum-recipe-dummy-uuid")?.recipe ?? "");
    const result = withParentSeries(sum, parentSeries);
    expect(result).toBe(sum);
    expect(result.variables.every(variable => variable.template)).toBe(true);
  });

  test("withParentSeries leaves a recipe without any data series alone", () => {
    const factorOnly = new Recipe({ name: "konstant", equation: ref("k"), variables: [{ id: "k", name: "k", type: RecipeDataTypes.Scalar, value: 3, unit: UnitFlags.Unitless }] });
    expect(withParentSeries(factorOnly, parentSeries)).toBe(factorOnly);
  });

  test("withParentSeries falls back to the first template data series of a stored method", () => {
    const own: DataSeriesVariable = { id: "stored-parent", name: "Målbana", type: RecipeDataTypes.DataSeries, pick: VectorIndexPickerOptions.Default, unit: UnitFlags.Missing, dataSeriesId: undefined, value: undefined, template: true };
    const factor: ScalarVariable = { id: "stored-factor", name: "Faktor", type: RecipeDataTypes.Scalar, value: 0.5, unit: UnitFlags.Unitless };
    const stored = new Recipe({ name: "Egen metod", equation: `${ref("Målbana")} * ${ref("Faktor")}`, variables: [factor, own] });

    const result = withParentSeries(stored, parentSeries);
    const parent = result.variables.find(variable => variable.id === "stored-parent") as DataSeriesVariable;
    expect(parent.dataSeriesId).toBe(parentSeries.variable.dataSeriesId);
    expect(parent.template).toBe(false);
    expect(result.equation).toBe(`${ref("Antal bilar")} * ${ref("Faktor")}`);
    expect(result.variables[0]).toEqual(factor);
  });
});

test.describe("Stored suggestions", () => {
  const own: DataSeriesVariable = { id: "stored-parent", name: "Målbana", type: RecipeDataTypes.DataSeries, pick: VectorIndexPickerOptions.Last, unit: UnitFlags.Missing, dataSeriesId: undefined, value: undefined, template: true };
  const factor: ScalarVariable = { id: "stored-factor", name: "Faktor", type: RecipeDataTypes.Scalar, value: 0.5, unit: UnitFlags.Unitless };
  const storedSuggestions = [
    new Recipe({ name: "Egen metod", equation: `${ref("Målbana")} * ${ref("Faktor")}`, variables: [own, factor], meta: { isSuggestedRecipe: true } }).serialize(),
    new Recipe({ name: "Annan metod", equation: `${ref("Målbana")} + ${ref("Faktor")}`, variables: [own, factor], meta: { isSuggestedRecipe: true } }).serialize(),
  ];

  test("a goal's stored methods come first, substituted with the copied series", () => {
    const own = getGoalSuggestedRecipes({ parentSeries, storedSuggestions, localReference }, identityT);
    expect(own.map(suggestion => suggestion.id)).toEqual(["stored-suggestion-0", "stored-suggestion-1", DefaultSuggestedRecipeId.LocalScale]);
    const first = Recipe.from(own[0].recipe);
    expect(first.name).toBe("Egen metod");
    expect(first.equation).toBe(`${ref("Antal bilar")} * ${ref("Faktor")}`);
    const parent = first.variables.find(variable => variable.id === "stored-parent") as DataSeriesVariable;
    expect(parent.dataSeriesId).toBe(parentSeries.variable.dataSeriesId);
    expect(parent.pick).toBe(VectorIndexPickerOptions.Last);
    expect(parent.template).toBe(false);
  });

  test("a goal with stored methods shows only its own and starts on the first", () => {
    const context: SuggestedRecipeContext = { parentSeries, storedSuggestions, geo: { source: sweden, target: boden } };
    expect(getSuggestedRecipesFor(identityT, context).map(suggestion => suggestion.id)).toEqual(["stored-suggestion-0", "stored-suggestion-1"]);
    expect(preferredSuggestedRecipeId(identityT, context)).toBe("stored-suggestion-0");
    expect(preferredSuggestion(identityT, context)?.id).toBe("stored-suggestion-0");
  });

  test("stored methods need a parent series to apply to", () => {
    expect(getGoalSuggestedRecipes({ storedSuggestions }, identityT)).toEqual([]);
    expect(getSuggestedRecipesFor(identityT, { storedSuggestions }).map(suggestion => suggestion.id)).toContain(DefaultSuggestedRecipeId.Scalar);
  });

  test("an empty stored list falls back to the defaults", () => {
    expect(getGoalSuggestedRecipes({ parentSeries, storedSuggestions: [] }, identityT)).toEqual([]);
    expect(getSuggestedRecipesFor(identityT, { parentSeries, storedSuggestions: [] }).map(suggestion => suggestion.id)).toContain(DefaultSuggestedRecipeId.Population);
  });
});
