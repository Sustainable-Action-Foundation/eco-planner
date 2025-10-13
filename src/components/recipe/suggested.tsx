'use client'

import { isRecipe, Recipe, RecipeDataTypes, VectorIndexPickerOptions } from "@/functions/recipe-parser/types";
import { useTranslation } from "react-i18next";
import { useRecipe } from "./contextProvider";
import { recipeFromUnknown } from "@/functions/parseRecipe";
import { VariableTypeScalarSimple } from "./editor/variable/types/scalar";
import { VariableTypeDataSeriesSimple } from "./editor/variable/types/dataserie";
import { VariableTypeExternalSimple } from "./editor/variable/types/external";
import { Fragment, useEffect, useState } from "react";
import clientSafeGetRoadmaps from "@/fetchers/clientSafeGetRoadmaps";
import TabList from "../generic/tablist/tabList";
import OutputDataSeries from "./editor/output/dataSerie";
import OutputGraph from "./editor/output/graph";

// TODO: Rename (SuggestedRecipes)
export function RecipeSuggestions({
  suggestedRecipes,
  allowAddVariables = false,
  allowDeleteVariables = false,
  allowNameEditing = false,
  allowTypeEditing = false,
  allowValueEditing = true,
}: {
  // TODO - only use prisma generated and type guard the recipe prop into, not `JsonValue`
  suggestedRecipes: { hash: string, recipe: Recipe }[];
  allowAddVariables?: boolean;
  allowDeleteVariables?: boolean;
  allowNameEditing?: boolean;
  allowTypeEditing?: boolean;
  allowValueEditing?: boolean;
  ariaLabelledBy?: string,
}) {
  const { t } = useTranslation("components");
  const { recipe, setRecipe } = useRecipe();

  const [availableRoadmaps, setAvailableRoadmaps] = useState<{ id: string; name: string; }[]>([]);
  const [selectedHash, setSelectedHash] = useState<string>("");

  // On mount, fetch all roadmaps user has access to
  // TODO: This is reused from editor/variable/editor.tsx, can probably abstract this somehow
  useEffect(() => {
    async function fetchRoadmaps() {
      try {
        const roadmaps = await clientSafeGetRoadmaps();
        setAvailableRoadmaps(roadmaps.map(roadmap => ({ id: roadmap.id, name: t("common:roadmap_version_name", { name: roadmap.metaRoadmap.name, version: roadmap.version }) })));
      }
      catch (e) {
        console.error("Failed to fetch roadmaps", e);
      }
    }

    fetchRoadmaps().catch(e => { throw e; });
  }, [t]);

  for (const recipe of suggestedRecipes) {
    if (!isRecipe(recipe.recipe)) {
      console.warn("Invalid recipe in suggestions", recipe);
      return null;
    }
  }
  // Validate suggested recipes
  if (suggestedRecipes.some(r => !isRecipe(r.recipe))) {
    console.warn("Some suggested recipes are not valid. Please check the data.");
    return null;
  }

  // On change set the context state to the selected recipe
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const hash = e.target.value;
    setSelectedHash(hash);

    const selectedSuggestion = suggestedRecipes.find(r => r.hash === hash);
    if (selectedSuggestion) {
      try {
        const rawRecipe = recipeFromUnknown(selectedSuggestion.recipe);
        setRecipe(rawRecipe);
      } catch (e) {
        console.error("Failed to parse suggested recipe", e);
        setRecipe(null);
      }
    } else {
      setRecipe(null);
    }
  };

  return (
    <>
      {/* Suggested recipes */}
      <label className="flex gap-50 margin-bottom-100 margin-top-25 align-items-center">
        Recept: 
        <select
          id="select-preset"
          value={selectedHash}
          onChange={handleChange}
        >
          <option>Välj alternativ</option> {/* TODO: I18n */}
          {suggestedRecipes.map((suggestedRecipe, index) => (
            <option key={index} value={suggestedRecipe.hash}> {/* TODO: The selected value needs to be preselected */}
              {suggestedRecipe.recipe.name ?? t("components:copy_and_scale.unnamed_suggestion")}
            </option>
          ))}
        </select>
      </label>
      {/* TODO: Potentially want this inside a fieldset */}
      {/* TODO: Note that labels are as of now not valid. I believe however that it will be solved with tree select as this should reduce the number of items in a simple variabletype to one */}
      {/* TODO: Note that this stuff needs to be submitted alongside the form which it isnt right now (i think....) */}
      {/* TODO: We should be using a grid instead of flex to properly align items here */}
      <div
        className="grid gap-50 padding-left-100"
        style={{
          gridTemplateColumns: 'auto 1fr',
          gridTemplateRows: 'auto auto',
          columnGap: '1rem'
        }}
      >
        {Object.entries(recipe?.variables ?? {}).map(([key, variable], i) => {
          const rules = {
            allowAddVariables,
            allowDeleteVariables,
            allowNameEditing,
            allowTypeEditing,
            allowValueEditing,
          };

          switch (variable.type) {
            case RecipeDataTypes.Scalar: {/* TODO: Fix theese labels */ }
              return (
                <Fragment key={key}>
                  <label className="flex align-items-center gap-100 width-fit-content margin-bottom-50">
                    <span>{key}{variable.unit ? ` [${variable.unit}]` : ''}:</span>
                  </label>
                  <VariableTypeScalarSimple
                    key={"recipeVariable" + i}
                    name={key}
                    rules={rules}
                  />
                </Fragment>
              );
            case RecipeDataTypes.DataSeries:
              return (
                <Fragment key={key}>
                  <label className="flex align-items-center gap-100 width-fit-content margin-bottom-50">
                    <span>{key}: {variable.unit}</span>
                  </label>
                  <VariableTypeDataSeriesSimple
                    key={"recipeVariable" + i}
                    name={key}
                    availableRoadmaps={availableRoadmaps}
                  />
                </Fragment>
              );
            case RecipeDataTypes.External:
              return (
                <Fragment key={key}>
                  <label className="flex align-items-center gap-100 width-fit-content margin-bottom-50">
                    <span>{key}{variable.unit ? ` [${variable.unit}]` : ''}:</span>
                  </label>
                  <VariableTypeExternalSimple
                    key={"recipeVariable" + i}
                    name={key}
                    rules={rules}
                  />
                </Fragment>
              );
            default:
              console.warn("Unknown variable type for variable", key);
              return (
                <p key={key}>
                  {key}: Unknown variable type
                </p>
              );
          }
        })}
      </div>
      {selectedHash ? 
        <TabList
          defaultIndex={0}
          styling="simple"
          props={{
            className: "margin-top-200",
          }}
        >
          <div
            data-tabname="equation"
            className="padding-top-50 margin-bottom-100"
          >
            <p className="margin-0">{recipe?.eq}</p> {/* TODO: i18n */}
          </div>
          <div
            data-tabname="dataserie"
            className="padding-top-50 margin-bottom-100" // TODO: Show fallback if there is  no resultingdata-series
          >
            <OutputDataSeries FormElement={<input type="hidden" name="resultingDataSeries" />} />
          </div>
          <div
            data-tabname="graph" 
            className="padding-top-50 margin-bottom-100"
          >
            <OutputGraph />
          </div>
        </TabList>
      : null}
    </>
  );
}

// TODO: Should dynamically render a list of inputs corresponding to RecipeDataTypes.DataSerie.
// We already do this in the recipe editor but we also want a simplified view outside of the editor
// TODO: Placed this here temporarily to remove clutter from goal form. 
// Should probably be moved back once theese are created dynamically? 
export const suggestedRecipes: Array<{ hash: string, recipe: Recipe }> = [
  // TODO: actually create proper hashes
  // TODO: Localize the variable names
  // TODO: Create these in seed and get them from the database
  { // Default scaling recipe
    hash: "atotallycoolhashthefirst",
    recipe: {
      name: 'Default scaling recipe', // Deal with this later t("forms:goal.default_scaling_recipe"), 
      eq: "${serie} * ${skalär}",
      variables: {
        "serie": {
          type: RecipeDataTypes.DataSeries,
          link: null,
          pick: VectorIndexPickerOptions.Default,
          unit: undefined, // No unit specified
        },
        "skalär": {
          type: RecipeDataTypes.Scalar,
          value: 0.5,
          unit: null, // Unitless
        }
      }
    },
  },
  { // Default combination recipe
    hash: "recipe_with_combination",
    recipe:
    {
      name: 'Default combination recipe', // Deal with this later t("forms:goal.default_combination_recipe"),
      eq: "${serie1} * ${skalär1} + ${serie2} * ${skalär2}",
      variables: {
        "serie1": {
          type: RecipeDataTypes.DataSeries,
          link: null,
          pick: VectorIndexPickerOptions.Default,
          unit: undefined, // No unit specified
        },
        "skalär1": {
          type: RecipeDataTypes.Scalar,
          value: 0.5,
          unit: null, // Unitless
        },
        "serie2": {
          type: RecipeDataTypes.DataSeries,
          link: null,
          pick: VectorIndexPickerOptions.Default,
          unit: undefined, // No unit specified
        },
        "skalär2": {
          type: RecipeDataTypes.Scalar,
          value: 0.5,
          unit: null, // Unitless
        },
      }
    }
  },
  { // Testing recipe with external data
    hash: "recipe_with_external",
    recipe:
    {
      name: "Recipe with external data",
      eq: "${extern}",
      variables: {
        "extern": {
          type: RecipeDataTypes.External,
          dataset: "SCB",
          tableId: "TAB6420",
          selection: [
            // Selected area
            { variableCode: "Region", valueCodes: ["00"] },
            // Specifically land areas, not including water
            { variableCode: "ArealTyp", valueCodes: ["01"] },
            // Magic string to get area sizes in square kilometers (as opposed to hectares with "000007E1")
            { variableCode: "ContentsCode", valueCodes: ["000007DY"] },
            // // Use the latest time period
            // { variableCode: "Tid", valueCodes: ["TOP(1)"] }
          ],
          pick: VectorIndexPickerOptions.Last,
          unit: undefined,
        }
      }
    }
  }
]