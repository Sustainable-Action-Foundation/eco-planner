import { expect, test } from "playwright/test";
import { copySuggestionContext, DefaultSuggestedRecipeId, getDefaultSuggestedRecipes, isUnscaledSuggestion, preferredSuggestedRecipeId, preferredSuggestion, prefillForArea } from "../../src/components/recipe/suggestions/defaultSuggestedRecipes";
import { RecipeDataTypes, VectorIndexPickerOptions } from "../../src/functions/recipe/types/enums";
import { Recipe } from "../../src/functions/recipe/recipe";
import { LeapSuggestedRecipeId } from "../../src/components/recipe/suggestions/leapSuggestedRecipes";
import { GeoAreaType, RoadmapType } from "../../src/lib/prisma/generated";
import { UnitFlags } from "../../src/types/enums";
import type { ExternalVariable } from "../../src/functions/recipe/types";
import type { GeoAreaRef, GoalPrefill, PrefilledSeries } from "../../src/types";
import type { TFunction } from "i18next";

const identityT = ((key: string) => key) as TFunction;

const sweden: GeoAreaRef = { code: "00", name: "Sverige", type: GeoAreaType.NATION };
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

function externals(id: string, context: Parameters<typeof getDefaultSuggestedRecipes>[1]): ExternalVariable[] {
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
  });

  test("without areas the regions stay for the user to pick", () => {
    const [parent, child] = externals(DefaultSuggestedRecipeId.Population, { parentSeries });
    expect(parent.template).toBe(true);
    expect(child.selection.some(item => item.variableCode === "Region")).toBe(false);
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
});
