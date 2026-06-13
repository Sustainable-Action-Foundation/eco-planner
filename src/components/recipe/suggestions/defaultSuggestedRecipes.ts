
import { Recipe } from "@/functions/recipe/recipe";
import { RecipeDataTypes, VectorIndexPickerOptions } from "@/functions/recipe/types";
import type { DataSeriesVariable, ExternalVariable, ScalarVariable } from "@/functions/recipe/types";
import type { DBRecipe } from "@/types";
import type { TFunction } from "i18next";

export function getDefaultSuggestedRecipes(t: TFunction): DBRecipe[] {

  const areaRecipe = new Recipe({
    name: t("components:recipe_editor.default_area_recipe.name"),
    equation: `\$\{${t("components:recipe_editor.default_area_recipe.parent_value")}\} * \$\{${t("components:recipe_editor.default_area_recipe.child_area")}\} / \$\{${t("components:recipe_editor.default_area_recipe.parent_area")}\}`,
    variables: [
      {
        id: "parent-value-dummy-uuid",
        name: t("components:recipe_editor.default_area_recipe.parent_value"),
        type: RecipeDataTypes.DataSeries,
        pick: VectorIndexPickerOptions.Default,
        value: undefined,
        dataSeriesId: undefined,
        unit: undefined,
        template: true,
      } satisfies DataSeriesVariable,

      {
        id: "parent-area-dummy-uuid",
        name: t("components:recipe_editor.default_area_recipe.parent_area"),
        type: RecipeDataTypes.External,
        dataset: 'SCB',
        tableId: 'TAB6420',
        selection: [
          // No parent region selected, user should choose it themselves. Example value follows:
          // { variableCode: "Region", valueCodes: ["00"] },
          // Specifically land areas, not including water
          { variableCode: "ArealTyp", valueCodes: ["01"] },
          // Magic string to get area sizes in square kilometers (as opposed to hectares with "000007E1")
          { variableCode: "ContentsCode", valueCodes: ["000007DY"] },
        ],
        pick: VectorIndexPickerOptions.Last,
        unit: undefined,
        template: true,
      } satisfies ExternalVariable,

      {
        id: "child-area-dummy-uuid",
        name: t("components:recipe_editor.default_area_recipe.child_area"),
        type: RecipeDataTypes.External,
        dataset: 'SCB',
        tableId: 'TAB6420',
        selection: [
          // No child region selected, user should choose it themselves. Example value follows:
          // { variableCode: "Region", valueCodes: ["00"] },
          // Specifically land areas, not including water
          { variableCode: "ArealTyp", valueCodes: ["01"] },
          // Magic string to get area sizes in square kilometers (as opposed to hectares with "000007E1")
          { variableCode: "ContentsCode", valueCodes: ["000007DY"] },
        ],
        pick: VectorIndexPickerOptions.Last,
        unit: undefined,
        template: true,
      } satisfies ExternalVariable,
    ],
    meta: {
      isSuggestedRecipe: true,
    },
  });

  const populationRecipe = new Recipe({
    name: t("components:recipe_editor.default_population_recipe.name"),
    equation: `\$\{${t("components:recipe_editor.default_population_recipe.parent_value")}\} * \$\{${t("components:recipe_editor.default_population_recipe.child_population")}\} / \$\{${t("components:recipe_editor.default_population_recipe.parent_population")}\}`,
    variables: [
      {
        id: "parent-value-dummy-uuid",
        name: t("components:recipe_editor.default_population_recipe.parent_value"),
        type: RecipeDataTypes.DataSeries,
        pick: VectorIndexPickerOptions.Default,
        unit: undefined,
        value: undefined,
        dataSeriesId: undefined,
        template: true,
      } satisfies DataSeriesVariable,

      {
        id: "parent-population-dummy-uuid",
        name: t("components:recipe_editor.default_population_recipe.parent_population"),
        type: RecipeDataTypes.External,
        pick: VectorIndexPickerOptions.Default,
        unit: undefined,
        dataset: 'SCB',
        tableId: 'BE0101N1',
        selection: [
          // No parent region selected, user should choose it themselves. Example value follows:
          // { variableCode: 'Region', valueCodes: ["00"] },
          // Magic string to get population numbers
          { variableCode: "ContentsCode", valueCodes: ["000007E1"] },
        ],
        template: true,
      } satisfies ExternalVariable,

      {
        id: "child-population-dummy-uuid",
        name: t("components:recipe_editor.default_population_recipe.child_population"),
        type: RecipeDataTypes.External,
        dataset: 'SCB',
        tableId: 'BE0101N1',
        selection: [
          // No child region selected, user should choose it themselves. Example value follows:
          // { variableCode: 'Region', valueCodes: ["00"] },
          // Magic string to get population numbers
          { variableCode: "ContentsCode", valueCodes: ["000007E1"] },
        ],
        pick: VectorIndexPickerOptions.Default,
        unit: undefined,
        template: true,
      } satisfies ExternalVariable,
    ],
    meta: {
      isSuggestedRecipe: true,
    },
  });

  const scalarRecipe = new Recipe({
    name: t("components:recipe_editor.default_scalar_recipe.name"),
    equation: `\$\{${t("components:recipe_editor.default_scalar_recipe.parent_value")}\} * \$\{${t("components:recipe_editor.default_scalar_recipe.scalar")}\}`,
    variables: [
      {
        id: "parent-value-dummy-uuid",
        name: t("components:recipe_editor.default_scalar_recipe.parent_value"),
        type: RecipeDataTypes.DataSeries,
        pick: VectorIndexPickerOptions.Default,
        dataSeriesId: undefined,
        value: undefined,
        unit: undefined,
        template: true,
      } satisfies DataSeriesVariable,

      {
        id: "scalar-dummy-uuid",
        name: t("components:recipe_editor.default_scalar_recipe.scalar"),
        type: RecipeDataTypes.Scalar,
        value: 1,
        unit: null,
      } satisfies ScalarVariable,
    ],
    meta: {
      isSuggestedRecipe: true,
    },
  });

  return [
    {
      id: "area-recipe-dummy-uuid",
      recipe: areaRecipe.serialize(),
    },
    {
      id: "population-recipe-dummy-uuid",
      recipe: populationRecipe.serialize(),
    },
    {
      id: "scalar-recipe-dummy-uuid",
      recipe: scalarRecipe.serialize(),
    },
  ] satisfies DBRecipe[];
}