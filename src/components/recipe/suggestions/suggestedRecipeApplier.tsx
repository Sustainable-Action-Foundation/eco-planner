'use client'

import { isRecipe, Recipe, RecipeDataTypes, VectorIndexPickerOptions } from "@/functions/recipe-parser/types";
import { useTranslation } from "react-i18next";
import { useRecipe } from "../context/recipeContext.provider";
import { recipeFromUnknown } from "@/functions/parseRecipe";
import { VariableTypeScalarSimple } from "../editor/variables/variableTypes/scalarVariable";
import { VariableTypeDataSeriesSimple } from "../editor/variables/variableTypes/dataSeriesVariable";
import { VariableTypeExternalSimple } from "../editor/variables/variableTypes/externalDatasetVariable";
import { Fragment, useEffect, useMemo, useState } from "react";
import clientSafeGetRoadmaps from "@/fetchers/clientSafeGetRoadmaps";
import TabList from "../../generic/tablist/tabList";
import OutputDataSeries from "../editor/output/dataSeriesDisplay";
import OutputGraph from "../editor/output/graphDisplay";
import OutputStatus from "../editor/output/statusDisplay";
import { testIfValidUnit } from "@/functions/recipe-parser/extractors";
import { IconAlertTriangleFilled } from "@tabler/icons-react";
import { RecipeEditorPermissions } from "../editor/variables/variableTypes/recipeEditorPermissions";

export function SuggestedRecipeApplier({
  autoInsertDefaultSuggestions = true,
  suggestedRecipes: suggestedRecipesInput = [],
  permissions = RecipeEditorPermissions,

  DEPRECATED_recipeOverrideFunctions,
}: {
  autoInsertDefaultSuggestions?: boolean;
  suggestedRecipes?: { hash: string, recipe: Recipe }[];
  permissions?: RecipeEditorPermissions;

  /** 
   * ## WARNING!
   * 
   * This is scary. This is a patch before smart recipes are implemented, 
   *  it will allow for very flexible overriding from outside. 
   * It will be used now for the copyAndScale component and should probably 
   *  not be used elsewhere and removed once smart recipes are in place.
   */
  DEPRECATED_recipeOverrideFunctions?: Array<(recipe: Recipe) => Recipe>;
}) {
  const { t } = useTranslation("components");
  const { recipe, setRecipe } = useRecipe();

  const [availableRoadmaps, setAvailableRoadmaps] = useState<{ id: string; name: string; }[]>([]);
  const [selectedHash, setSelectedHash] = useState<string>("");
  const suggestedRecipes = useMemo(() => autoInsertDefaultSuggestions
    ? [...defaultSuggestedRecipes, ...suggestedRecipesInput]
    : suggestedRecipesInput,
    [autoInsertDefaultSuggestions, suggestedRecipesInput]);

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

  // Validate suggested recipes
  useEffect(() => {
    for (const recipe of suggestedRecipes) {
      if (!isRecipe(recipe.recipe)) {
        console.warn("Invalid recipe in suggestions", recipe);
        return;
      }
    }
    if (suggestedRecipes.some(r => !isRecipe(r.recipe))) {
      console.warn("Some suggested recipes are not valid. Please check the data.");
      return;
    }
  }, [suggestedRecipes]);

  // On change set the context state to the selected recipe
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const hash = e.target.value;
    setSelectedHash(hash);

    const selectedSuggestion = suggestedRecipes.find(r => r.hash === hash);
    if (selectedSuggestion) {
      try {
        let foundRecipe = recipeFromUnknown(selectedSuggestion.recipe);

        // TODO remove override stuff
        if (DEPRECATED_recipeOverrideFunctions) {
          DEPRECATED_recipeOverrideFunctions.forEach(overrideFunction => {
            foundRecipe = overrideFunction(foundRecipe);
          });
        };

        setRecipe(foundRecipe);
      }
      catch (e) {
        console.error("Failed to parse suggested recipe", e);
        setRecipe(null);
      }
    } else {
      setRecipe(null);
    }
  };

  return (<>
    {/* Select which suggested recipe to use */}
    <label className="flex gap-50 margin-bottom-100 margin-top-25 align-items-center">
      {t("components:recipe_editor.recipe")}:
      <select
        id="select-preset"
        value={selectedHash}
        onChange={handleChange}
      >
        <option disabled value={""}>{t("common:tsx.generic_select")}</option>
        {suggestedRecipes.map((suggestedRecipe, index) => (
          <option key={index} value={suggestedRecipe.hash}> {/* TODO: The selected value needs to be preselected */}
            {suggestedRecipe.recipe.name ?? t("components:copy_and_scale.unnamed_suggestion")}
          </option>
        ))}
      </select>
    </label>

    {/* TODO: Note that labels are as of now not valid. I believe however that it will be solved with tree select as this should reduce the number of items in a simple variable type to one */}
    {/* TODO: We should be using a grid instead of flex to properly align items here */}
    <div
      className="grid gap-50 padding-left-100"
      style={{
        gridTemplateColumns: 'auto 1fr',
        gridTemplateRows: 'auto auto',
        columnGap: '1rem'
      }}
    >
      {Object.entries(recipe?.variables ?? {}).map(([variableName, variable], i) => {
        const unitIsProvided = typeof variable.unit !== "undefined" && variable.unit !== null;
        const isValidUnit = unitIsProvided ? testIfValidUnit(variable.unit as string) : false;
        const unitDisplay = isValidUnit
          ? ` [${variable.unit}]`
          : unitIsProvided && variable.unit !== ''
            ? <span className="inline">
              {" ["}
              {variable.unit}
              <IconAlertTriangleFilled
                width={16} height={16}
                style={{ minWidth: '16px', marginBottom: '-3px', marginLeft: '1px' }}
                color="darkorange"
                aria-label={t("components:copy_and_scale.evaluation_warning_title")} // TODO: Check this translation
              />
              {"]"}
            </span>
            : '';

        switch (variable.type) {
          case RecipeDataTypes.Scalar: {/* TODO: Fix these labels */ }
            return (
              <Fragment key={variableName}>
                <label className="flex align-items-center gap-100 width-fit-content margin-bottom-50">
                  <span>{variableName}{unitDisplay}:</span>
                </label>
                <VariableTypeScalarSimple
                  key={"recipeVariable" + i}
                  variableName={variableName}
                  permissions={permissions}
                  props={{
                    defaultValue: variable.value,
                  }}
                />
              </Fragment>
            );

          case RecipeDataTypes.DataSeries:
            return (
              <Fragment key={variableName}>
                <label className="flex align-items-center gap-100 width-fit-content margin-bottom-50">
                  <span>{variableName}{unitDisplay}:</span>
                </label>
                <VariableTypeDataSeriesSimple
                  props={{
                    id: "recipeVariable" + i,
                    name: "recipeVariable" + i,
                    placeholder: t("components:recipe_editor.select_data_series"),
                    required: true,
                    disabled: variable.disabled || false,
                  }}
                  key={"recipeVariable" + i}
                  variableName={variableName}
                  availableRoadmaps={availableRoadmaps}
                  goalName={variable.goalName}
                />
              </Fragment>
            );

          case RecipeDataTypes.External:
            return (
              <Fragment key={variableName}>
                <label className="flex align-items-center gap-100 width-fit-content margin-bottom-50">
                  <span>{variableName}{unitDisplay}:</span>
                </label>
                <VariableTypeExternalSimple
                  key={"recipeVariable" + i}
                  variableName={variableName}
                  permissions={permissions}
                />
              </Fragment>
            );

          default:
            console.warn("Unknown variable type for variable", variableName);
            return (
              <p key={variableName}>
                {variableName}: {t("components:recipe_editor.unknown_variable_type")}
              </p>
            );
        }
      })}
    </div>

    <OutputStatus
      hideWhenNoRecipe={true}
    />

    {selectedHash &&
      <TabList
        defaultIndex={0}
        styling="simple"
        props={{
          className: "margin-top-200",
        }}
      >
        <div
          data-tabname={t("components:recipe_editor.data_series")}
          className="padding-top-50 margin-bottom-100"
        >
          <OutputDataSeries />
        </div>
        <div
          data-tabname={t("components:recipe_editor.graph")}
          className="padding-top-50 margin-bottom-100"
        >
          <OutputGraph />
        </div>
        <div
          data-tabname={t("components:recipe_editor.equation")}
          className="padding-top-50 margin-bottom-100"
        >
          <p className="margin-0">{recipe?.eq}</p>
        </div>
      </TabList>
    }
  </>
  );
}

// TODO: Should dynamically render a list of inputs corresponding to RecipeDataTypes.DataSeries.
// We already do this in the recipe editor but we also want a simplified view outside of the editor
// TODO: Placed this here temporarily to remove clutter from goal form. 
// Should probably be moved back once these are created dynamically? 
export const defaultSuggestedRecipes: { hash: string, recipe: Recipe }[] = [
  // TODO: actually create proper hashes
  // TODO: Localize the variable names
  // TODO: Create these in seed and get them from the database
  { // Default scaling recipe
    hash: "recipe_with_scaling",
    recipe: {
      name: 'Skala serie', // Deal with this later t("forms:goal.default_scaling_recipe"), 
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
      name: 'Kombinera serier', // Deal with this later t("forms:goal.default_combination_recipe"),
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
  // { // Testing recipe with external data
  //   hash: "recipe_with_external",
  //   recipe:
  //   {
  //     name: "Recipe with external data",
  //     eq: "${extern}",
  //     variables: {
  //       "extern": {
  //         type: RecipeDataTypes.External,
  //         dataset: "SCB",
  //         tableId: "TAB6420",
  //         selection: [
  //           // Selected area
  //           { variableCode: "Region", valueCodes: ["00"] },
  //           // Specifically land areas, not including water
  //           { variableCode: "ArealTyp", valueCodes: ["01"] },
  //           // Magic string to get area sizes in square kilometers (as opposed to hectares with "000007E1")
  //           { variableCode: "ContentsCode", valueCodes: ["000007DY"] },
  //           // // Use the latest time period
  //           // { variableCode: "Tid", valueCodes: ["TOP(1)"] }
  //         ],
  //         pick: VectorIndexPickerOptions.Last,
  //         unit: undefined,
  //       }
  //     }
  //   }
  // }
]