'use client'

import { isRecipe, RecipeDataTypes } from "@/functions/recipe/types";
import { useTranslation } from "react-i18next";
import { useRecipe } from "../context/recipeContext.use";
import { VariableTypeScalarSimple } from "../editor/variables/scalarVariable";
import { VariableTypeDataSeriesSimple } from "../editor/variables/dataSeriesVariable";
import { VariableTypeExternalSimple } from "../editor/variables/externalDatasetVariable";
import { Fragment, useEffect, useMemo, useState } from "react";
import { clientSafeGetRoadmaps } from "@/fetchers/client";
import { isMathjsUnit } from "@/functions/recipe/vectorAndMaskUtils";
import { IconAlertTriangleFilled } from "@tabler/icons-react";
import { RecipeEditorPermissions } from "../editor/variables/recipeEditorPermissions";
import type { DBRecipe } from "@/types";
import { Recipe } from "@/functions/recipe/recipe";
import { CombinedStatusDisplay, getDefaultSuggestedRecipes, OutputStatus } from "@/components/recipe";

export function SuggestedRecipeApplier({
  autoInsertDefaultSuggestions = true,
  suggestedRecipes: providedSuggestedRecipes = [],
  permissions = RecipeEditorPermissions,
}: {
  autoInsertDefaultSuggestions?: boolean;
  suggestedRecipes?: DBRecipe[];
  permissions?: RecipeEditorPermissions;
}) {
  const { t } = useTranslation("components");
  const defaultSuggestionRecipes = useMemo(() => getDefaultSuggestedRecipes(t), [t]);
  const { recipe, setRecipe, clearRecipe } = useRecipe();

  const [availableRoadmaps, setAvailableRoadmaps] = useState<{ id: string; name: string; }[]>([]);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>("");
  const suggestedRecipes = useMemo(() => autoInsertDefaultSuggestions
    ? [...defaultSuggestionRecipes, ...providedSuggestedRecipes]
    : [...providedSuggestedRecipes],
    [autoInsertDefaultSuggestions, providedSuggestedRecipes, defaultSuggestionRecipes]);

  // On mount, fetch all roadmaps user has access to
  // TODO: This is reused from editor/variable/editor.tsx, can probably extract this somehow
  useEffect(() => {
    async function fetchRoadmaps() {
      try {
        const roadmaps = await clientSafeGetRoadmaps();
        setAvailableRoadmaps(roadmaps.map(roadmap => ({
          id: roadmap.id,
          name: t("common:roadmap_version_name", { name: roadmap.metaRoadmap.name, version: roadmap.version })
        })));
      }
      catch (e) {
        console.error("Failed to fetch roadmaps", e);
      }
    }

    fetchRoadmaps()
      .catch((e: unknown) => {
        const errorMessage = e instanceof Error ? e.message : String(e);
        console.error("Failed to fetch roadmaps", errorMessage);
      });
  }, [t]);

  // Validate suggested recipe structures
  useEffect(() => {
    for (const dbRecipe of suggestedRecipes) {
      const recipe = Recipe.from(dbRecipe.recipe);
      if (!isRecipe(recipe.serialize())) {
        console.warn("Invalid recipe type in suggestions", dbRecipe);
        return;
      }
    }
    // TODO - validate with recipe.isValid() here as well when the API calls are removed from stored recipes
  }, [suggestedRecipes]);

  // On change set the context state to the selected recipe
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const recipeId = e.target.value;
    setSelectedRecipeId(recipeId);

    const selectedSuggestion = suggestedRecipes.find(r => r.id === recipeId);
    if (!selectedSuggestion) {
      console.error("Selected suggested recipe not found", recipeId);
      clearRecipe();
      return;
    }

    const parsedRecipe = Recipe.from(selectedSuggestion.recipe);

    if (!isRecipe(parsedRecipe.serialize())) {
      console.error("Selected suggested recipe is not a valid Recipe", selectedSuggestion);
      clearRecipe();
      return;
    }

    setRecipe(parsedRecipe)
      .catch((e: unknown) => {
        const errorMessage = e instanceof Error ? e.message : String(e);
        console.error("Failed to set recipe from suggestion", errorMessage);
        clearRecipe();
      });
  };

  return (<>
    {/* Select which suggested recipe to use */}
    <label className="flex gap-50 margin-bottom-100 margin-top-25 align-items-center">
      {t("components:recipe_editor.suggested_recipe_label")}:
      <select
        id="select-preset"
        value={selectedRecipeId}
        onChange={handleChange}
      >
        <option disabled value={""}>{t("common:tsx.generic_select")}</option>
        {suggestedRecipes.map((suggestedRecipe, index) => (
          <option key={index} value={suggestedRecipe.id}> {/* TODO: The selected value needs to be preselected */}
            {Recipe.from(suggestedRecipe.recipe).name ?? t("components:copy_and_scale.unnamed_suggestion")}
          </option>
        ))}
      </select>
    </label>

    {/* TODO: Note that labels are as of now not valid. I believe however that it will be solved with tree select as this should reduce the number of items in a simple variable type to one */}
    {/* TODO: We should be using a grid instead of flex to properly align items here */}

    {/* Select of available recipes */}
    <div
      className="grid gap-50 padding-left-100"
      style={{
        gridTemplateColumns: 'auto 1fr',
        gridTemplateRows: 'auto auto',
        columnGap: '1rem'
      }}
    >
      {Object.entries(recipe?.variables ?? {}).map(([variableKey, variable], i) => {
        const unitIsProvided = typeof variable.unit !== "undefined" && variable.unit !== null;
        const isValidUnit = unitIsProvided ? isMathjsUnit(variable.unit as string) : false;
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
              <Fragment key={variable.name ?? variableKey}>
                <label className="flex align-items-center gap-100 width-fit-content margin-bottom-50">
                  <span>{variable.name ?? variableKey}{unitDisplay}:</span>
                </label>
                <VariableTypeScalarSimple
                  key={"recipeVariable" + i}
                  variableName={variable.name ?? variableKey}
                  permissions={permissions}
                  props={{
                    defaultValue: variable.value,
                    ...(variable.template ? { style: { outline: "1px solid blue", borderRadius: "8px" } } : {})
                  }}
                />
              </Fragment>
            );

          case RecipeDataTypes.DataSeries:
            return (
              <Fragment key={variable.name ?? variableKey}>
                <label className="flex align-items-center gap-100 width-fit-content margin-bottom-50">
                  <span>{variable.name ?? variableKey}{unitDisplay}:</span>
                </label>
                <VariableTypeDataSeriesSimple
                  props={{
                    id: "recipeVariable" + i,
                    name: "recipeVariable" + i,
                    placeholder: t("components:recipe_editor.select_data_series"),
                    required: true,
                    disabled: false,
                    ...(variable.template ? { style: { outline: "1px solid blue", borderRadius: "8px" } } : {})
                  }}
                  key={"recipeVariable" + i}
                  variableName={variable.name ?? variableKey}
                  availableRoadmaps={availableRoadmaps}
                />
              </Fragment>
            );

          case RecipeDataTypes.External:
            return (
              <Fragment key={variable.name ?? variableKey}>
                <label className="flex align-items-center gap-100 width-fit-content margin-bottom-50">
                  <span>{variable.name ?? variableKey}{unitDisplay}:</span>
                </label>
                <VariableTypeExternalSimple
                  key={"recipeVariable" + i}
                  variableName={variable.name ?? variableKey}
                  permissions={permissions}
                  props={{
                    ...(variable.template ? { style: { outline: "1px solid blue", borderRadius: "8px" } } : {})
                  }}
                />
              </Fragment>
            );

          default:
            console.warn("Unknown variable type for variable", { variable });
            return (
              <p key={variableKey}>
                {variableKey}: {t("components:recipe_editor.unknown_variable_type")}
              </p>
            );
        }
      })}
    </div>

    {selectedRecipeId && <>
      <OutputStatus showAllGood={false} />

      <CombinedStatusDisplay />
    </>}
  </>
  );
}