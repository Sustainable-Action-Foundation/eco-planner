import { Recipe } from "@/functions/recipe/recipe";
import { RecipeDataTypes, VectorIndexPickerOptions } from "@/functions/recipe/types/enums";
import type { DataSeriesVariable, ExternalVariable, ScalarVariable } from "@/functions/recipe/types";
import type { ApiSelectionItem, DatasetKeys } from "@/lib/api/apiTypes";
import type { DBRecipe } from "@/types";
import type { TFunction } from "i18next";
import { UnitFlags } from "@/types/enums";

/** The data series being inherited from; the user picks it in every scaling recipe. */
const PARENT_VALUE_ID = "parent-value-dummy-uuid";

type ExternalPreset = { dataset: DatasetKeys, tableId: string, selection: ApiSelectionItem[] };

/** A data series the user has to pick themselves. */
function dataSeriesTemplate(id: string, name: string): DataSeriesVariable {
  return {
    id,
    name,
    type: RecipeDataTypes.DataSeries,
    pick: VectorIndexPickerOptions.Default,
    value: undefined,
    dataSeriesId: undefined,
    unit: UnitFlags.Missing,
    template: true,
  };
}

/**
 * An external variable the user completes themselves. With a preset, the table and
 * selection are fixed and only the region is left to choose; without one the whole
 * query is up to the user.
 */
function externalTemplate(id: string, name: string, preset?: ExternalPreset): ExternalVariable {
  return {
    id,
    name,
    type: RecipeDataTypes.External,
    dataset: preset?.dataset ?? null,
    tableId: preset?.tableId ?? null,
    selection: preset?.selection ?? [],
    // Scale by the latest known value so a projected parent series keeps its full
    // date range instead of being cut down to the years the external table covers.
    pick: VectorIndexPickerOptions.Last,
    unit: UnitFlags.Missing,
    template: true,
  };
}

/**
 * `parent * child / parent` scaling recipe over an external source (region left to the user).
 * `idPrefix` keeps variable ids distinct between presets: the editor keys its rows by
 * variable id, so shared ids would keep one preset's editor state alive under another.
 */
function ratioRecipe(idPrefix: string, names: { name: string, parentValue: string, parentExternal: string, childExternal: string }, preset?: ExternalPreset): Recipe {
  return new Recipe({
    name: names.name,
    equation: `\${${names.parentValue}} * \${${names.childExternal}} / \${${names.parentExternal}}`,
    variables: [
      dataSeriesTemplate(PARENT_VALUE_ID, names.parentValue),
      externalTemplate(`${idPrefix}-parent-external-dummy-uuid`, names.parentExternal, preset),
      externalTemplate(`${idPrefix}-child-external-dummy-uuid`, names.childExternal, preset),
    ],
    meta: { isSuggestedRecipe: true },
  });
}

/** `first <operator> second` over two data series the user picks. */
function combineRecipe(idPrefix: string, names: { name: string, first: string, second: string }, operator: "+" | "-"): Recipe {
  return new Recipe({
    name: names.name,
    equation: `\${${names.first}} ${operator} \${${names.second}}`,
    variables: [
      dataSeriesTemplate(`${idPrefix}-first-series-dummy-uuid`, names.first),
      dataSeriesTemplate(`${idPrefix}-second-series-dummy-uuid`, names.second),
    ],
    meta: { isSuggestedRecipe: true },
  });
}

// SCB land area (km²); region left to the user
const scbLandArea: ExternalPreset = {
  dataset: "SCB",
  tableId: "TAB6420",
  selection: [
    // Land area, excluding water
    { variableCode: "ArealTyp", valueCodes: ["01"] },
    // Square kilometers (hectares would be "000007E1")
    { variableCode: "ContentsCode", valueCodes: ["000007DY"] },
  ],
};

// SCB population; region left to the user
const scbPopulation: ExternalPreset = {
  dataset: "SCB",
  tableId: "BE0101N1",
  selection: [
    { variableCode: "ContentsCode", valueCodes: ["000007E1"] },
  ],
};

// Trafa passenger cars in traffic at year end for one fuel ("drivmedel"); county/municipality left to the user
function trafaPassengerCars(drivmedel: string): ExternalPreset {
  return {
    dataset: "Trafa",
    tableId: "t10026",
    selection: [
      { variableCode: "metric", valueCodes: ["itrfslut"] },
      { variableCode: "drivmedel", valueCodes: [drivmedel] },
    ],
  };
}

export function getDefaultSuggestedRecipes(t: TFunction): DBRecipe[] {
  const recipes: { id: string, recipe: Recipe }[] = [
    /* Scaling by a ratio between two regions */
    {
      id: "area-recipe-dummy-uuid",
      recipe: ratioRecipe("area", {
        name: t("components:recipe_editor.default_area_recipe.name"),
        parentValue: t("components:recipe_editor.default_area_recipe.parent_value"),
        parentExternal: t("components:recipe_editor.default_area_recipe.parent_area"),
        childExternal: t("components:recipe_editor.default_area_recipe.child_area"),
      }, scbLandArea),
    },
    {
      id: "population-recipe-dummy-uuid",
      recipe: ratioRecipe("population", {
        name: t("components:recipe_editor.default_population_recipe.name"),
        parentValue: t("components:recipe_editor.default_population_recipe.parent_value"),
        parentExternal: t("components:recipe_editor.default_population_recipe.parent_population"),
        childExternal: t("components:recipe_editor.default_population_recipe.child_population"),
      }, scbPopulation),
    },
    // Electric cars ("El"), e.g. for scaling charging infrastructure
    {
      id: "electric-cars-recipe-dummy-uuid",
      recipe: ratioRecipe("electric-cars", {
        name: t("components:recipe_editor.default_electric_cars_recipe.name"),
        parentValue: t("components:recipe_editor.default_electric_cars_recipe.parent_value"),
        parentExternal: t("components:recipe_editor.default_electric_cars_recipe.parent_cars"),
        childExternal: t("components:recipe_editor.default_electric_cars_recipe.child_cars"),
      }, trafaPassengerCars("103")),
    },
    // All passenger cars ("Totalt"), e.g. for scaling an electric car goal so both regions get the same share
    {
      id: "passenger-cars-recipe-dummy-uuid",
      recipe: ratioRecipe("passenger-cars", {
        name: t("components:recipe_editor.default_passenger_cars_recipe.name"),
        parentValue: t("components:recipe_editor.default_passenger_cars_recipe.parent_value"),
        parentExternal: t("components:recipe_editor.default_passenger_cars_recipe.parent_cars"),
        childExternal: t("components:recipe_editor.default_passenger_cars_recipe.child_cars"),
      }, trafaPassengerCars("t1")),
    },
    // Any external source, chosen entirely by the user
    {
      id: "external-ratio-recipe-dummy-uuid",
      recipe: ratioRecipe("external-ratio", {
        name: t("components:recipe_editor.default_external_ratio_recipe.name"),
        parentValue: t("components:recipe_editor.default_external_ratio_recipe.parent_value"),
        parentExternal: t("components:recipe_editor.default_external_ratio_recipe.parent_external"),
        childExternal: t("components:recipe_editor.default_external_ratio_recipe.child_external"),
      }),
    },

    /* Scaling by a single factor */
    {
      id: "scalar-recipe-dummy-uuid",
      recipe: new Recipe({
        name: t("components:recipe_editor.default_scalar_recipe.name"),
        equation: `\${${t("components:recipe_editor.default_scalar_recipe.parent_value")}} * \${${t("components:recipe_editor.default_scalar_recipe.scalar")}}`,
        variables: [
          dataSeriesTemplate(PARENT_VALUE_ID, t("components:recipe_editor.default_scalar_recipe.parent_value")),
          {
            id: "scalar-dummy-uuid",
            name: t("components:recipe_editor.default_scalar_recipe.scalar"),
            type: RecipeDataTypes.Scalar,
            value: 1,
            unit: UnitFlags.Unitless,
          } satisfies ScalarVariable,
        ],
        meta: { isSuggestedRecipe: true },
      }),
    },
    {
      id: "external-factor-recipe-dummy-uuid",
      recipe: new Recipe({
        name: t("components:recipe_editor.default_external_factor_recipe.name"),
        equation: `\${${t("components:recipe_editor.default_external_factor_recipe.parent_value")}} * \${${t("components:recipe_editor.default_external_factor_recipe.factor")}}`,
        variables: [
          dataSeriesTemplate(PARENT_VALUE_ID, t("components:recipe_editor.default_external_factor_recipe.parent_value")),
          externalTemplate("factor-dummy-uuid", t("components:recipe_editor.default_external_factor_recipe.factor")),
        ],
        meta: { isSuggestedRecipe: true },
      }),
    },

    /* Combining two data series */
    {
      id: "sum-recipe-dummy-uuid",
      recipe: combineRecipe("sum", {
        name: t("components:recipe_editor.default_sum_recipe.name"),
        first: t("components:recipe_editor.default_sum_recipe.first"),
        second: t("components:recipe_editor.default_sum_recipe.second"),
      }, "+"),
    },
    {
      id: "difference-recipe-dummy-uuid",
      recipe: combineRecipe("difference", {
        name: t("components:recipe_editor.default_difference_recipe.name"),
        first: t("components:recipe_editor.default_difference_recipe.first"),
        second: t("components:recipe_editor.default_difference_recipe.second"),
      }, "-"),
    },
  ];

  return recipes.map(({ id, recipe }) => ({ id, recipe: recipe.serialize() })) satisfies DBRecipe[];
}
