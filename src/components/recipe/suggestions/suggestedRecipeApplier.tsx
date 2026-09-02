'use client';

import { RecipeDataTypes } from "@/functions/recipe/types/enums";
import { isRecipe } from "@/functions/recipe/types/typeguards";
import { useTranslation } from "react-i18next";
import { useRecipe } from "../context/recipeContext.use";
import { VariableTypeScalarSimple } from "../editor/variables/scalarVariable";
import { DataSeriesVariableSimpleEditor } from "../editor/variables/dataSeriesVariable";
import { VariableTypeExternalSimple } from "../editor/variables/externalVariable";
import { useEffect, useMemo, useState } from "react";
import { isMathjsUnit } from "@/functions/recipe/vectorAndMaskUtils";
import { isUnitFlag } from "@/functions/unit";
import { IconAlertTriangleFilled, IconInfoCircle } from "@tabler/icons-react";
import type { ClientRoadmapIteration, DBRecipe, PrefilledSeries } from "@/types";
import { RecipeEditorPermissions } from "@/types/consts";
import { Recipe } from "@/functions/recipe/recipe";
import { getDefaultSuggestedRecipes, TextStatus } from "@/components/recipe";
import styles from "../recipe.module.css" with {type: "css"};
import { getRecipeRoadmapData } from "../context/roadmapDataCache";

export function SuggestedRecipeApplier({
  autoInsertDefaultSuggestions = true,
  suggestedRecipes: providedSuggestedRecipes = [],
  permissions = RecipeEditorPermissions,
  parentSeries,
  initialRecipeId,
}: {
  autoInsertDefaultSuggestions?: boolean;
  suggestedRecipes?: DBRecipe[];
  permissions?: RecipeEditorPermissions;
  /** Stands in for the parent value in the default suggestions (see `getDefaultSuggestedRecipes`) */
  parentSeries?: PrefilledSeries;
  /** The suggestion the surrounding recipe context was seeded with, so the select agrees with it */
  initialRecipeId?: string;
}) {
  const { t } = useTranslation("components");
  const defaultSuggestionRecipes = useMemo(() => getDefaultSuggestedRecipes(t, parentSeries), [t, parentSeries]);
  const { recipe, applyRecipeUpdate, clearRecipe } = useRecipe();

  const [availableDataSeries, setAvailableDataSeries] = useState<{ id: string; name: string; }[]>([]);
  const [roadmapLookup, setRoadmapLookup] = useState<Record<string, ClientRoadmapIteration>>({});
  const [dataSeriesNamesById, setDataSeriesNamesById] = useState<Record<string, string>>({});
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>(initialRecipeId ?? "");
  const suggestedRecipes = useMemo(() => autoInsertDefaultSuggestions
    ? [...defaultSuggestionRecipes, ...providedSuggestedRecipes]
    : [...providedSuggestedRecipes],
    [autoInsertDefaultSuggestions, providedSuggestedRecipes, defaultSuggestionRecipes]);

  // On mount, fetch all roadmaps user has access to
  useEffect(() => {
    async function fetchRoadmaps() {
      try {
        const { roadmaps, roadmapLookup } = await getRecipeRoadmapData();

        setAvailableDataSeries(
          roadmaps.map((roadmap) => ({
            id: roadmap.id,
            name: t("common:roadmap_version_name", { name: roadmap.roadmap.name, version: roadmap.version }),
          })),
        );

        setRoadmapLookup(roadmapLookup);

        setDataSeriesNamesById(
          Object.values(roadmapLookup).reduce((acc, roadmap) => {
            for (const goal of roadmap.goals) {
              const goalDisplayName = goal.name || goal.indicator_parameter;

              if (goal.data_series) {
                acc[goal.data_series.id] = goalDisplayName;
              }

              if (goal.baseline) {
                acc[goal.baseline.id] = `${goalDisplayName} - ${t("common:baseline_one")}`;
              }

              for (const effect of goal.effects) {
                if (!effect.data_series) continue;
                acc[effect.data_series.id] = `${goalDisplayName} - ${t("common:effect_one")}`;
              }
            }

            return acc;
          }, {} as Record<string, string>),
        );
      }
      catch (err) {
        console.error("Failed to fetch roadmaps", err);
      }
    }

    fetchRoadmaps()
      .catch((err: unknown) => {
        const errorMessage = err instanceof Error ? err.message : String(err);
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

    applyRecipeUpdate(parsedRecipe)
      .catch((err: unknown) => {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error("Failed to set recipe from suggestion", errorMessage);
        clearRecipe();
      });
  };

  return (<>
    {/* Select which suggested recipe to use */}
    <label>
      {t("components:recipe_editor.suggested_recipe_label")}
      <select
        className="block margin-top-25 width-100"
        id="select-preset"
        required={true}
        value={selectedRecipeId}
        onChange={handleChange}
      >
        <option disabled={true} value={""}>{t("common:tsx.generic_select")}</option>
        {suggestedRecipes.map(suggestedRecipe => (
          <option key={suggestedRecipe.id} value={suggestedRecipe.id}> {/* TODO: The selected value needs to be preselected */}
            {Recipe.from(suggestedRecipe.recipe).name ?? t("components:copy_and_scale.unnamed_suggestion")}
          </option>
        ))}
      </select>
    </label>
    {recipe.equation ? 
      <small className="flex gap-25 align-items-center margin-top-25 margin-bottom-100" >
        <IconInfoCircle width={20} height={20} style={{ minWidth: '20px' }} aria-hidden="true" />
        {`${t("components:recipe_editor.equation")}: ${recipe.equation}`}
      </small>
    : null }

    {/* TODO: Look into using an ordered list for this. */}
    {/* TODO: Everything should probably be required */}
    {/* Select of available recipes */}
    {recipe?.variables.length > 0 &&
      <ul
        className="grid gap-50 padding-left-100 align-items-center"
        style={{
          gridTemplateColumns: 'auto auto 1fr',
          gridTemplateRows: 'auto auto',
        }}
      >
        {(recipe?.variables ?? []).map(variable => {
          const variableId = variable.id;
          const variableDisplayName = variable.name;
          const unitIsProvided = !isUnitFlag(variable.unit);
          const isValidUnit = unitIsProvided ? isMathjsUnit(variable.unit) : false;
          const unitDisplay = isValidUnit
            ? ` [${variable.unit}]`
            : unitIsProvided
              ? <span className="inline">
                {" ["}
                {variable.unit}
                <IconAlertTriangleFilled
                  width={16} height={16}
                  style={{ minWidth: '16px', marginBottom: '-3px', marginLeft: '1px' }}
                  color="darkorange"
                  aria-label={t("components:recipe_editor.evaluation_warning_title")}
                />
                {"]"}
              </span>
              : '';

          switch (variable.type) {
            case RecipeDataTypes.Scalar: {// TODO: Fix these labels
              return (
                <li key={variableId} className={`${styles["variable"]} ${!variable.template ? styles["variable-selected"] : ""}`}>
                  <label className="margin-right-150 margin-left-25">
                    {variableDisplayName}{unitDisplay}:
                  </label>
                  <VariableTypeScalarSimple
                    variableId={variableId}
                    permissions={permissions}
                    props={{
                      defaultValue: variable.value,
                    }}
                  />
                </li>
              );
            }
            case RecipeDataTypes.DataSeries: {
              return (
                <li key={variableId} className={`${styles["variable"]} ${!variable.template ? styles["variable-selected"] : ""}`}>
                  <label className="margin-right-150 margin-left-25">
                    {variableDisplayName}{unitDisplay}:
                  </label>
                  <DataSeriesVariableSimpleEditor
                    variableId={variableId}
                    availableDataSeries={availableDataSeries}
                    roadmapLookup={roadmapLookup}
                    dataSeriesNamesById={dataSeriesNamesById}
                    permissions={{ ...permissions }}
                  />
                </li>
              );
            }
            case RecipeDataTypes.External: {
              return (
                <li key={variableId} className={`${styles["variable"]} ${!variable.template ? styles["variable-selected"] : ""}`}>
                  <label className="margin-right-150 margin-left-25">
                    {variableDisplayName}{unitDisplay}:
                  </label>
                  <VariableTypeExternalSimple
                    variableId={variableId}
                    permissions={permissions}
                  />
                </li>
              );
            }
            default: {
              console.warn("Unknown variable type for variable", { variable });
              return (
                <p key={variableId}>
                  {variableDisplayName}: {t("components:recipe_editor.unknown_variable_type")}
                </p>
              );
            }
          }
        })}
      </ul>
    }

    {!!selectedRecipeId &&
      <TextStatus showAllGood={false} />
    }
  </>
  );
}