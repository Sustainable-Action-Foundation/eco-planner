'use client'

import { isSmartRecipe, RecipeDataTypes } from "@/functions/recipe/types";
import { useTranslation } from "react-i18next";
import { useRecipe } from "../context/recipeContext.use";
import { VariableTypeScalarSimple } from "../editor/variables/variableTypes/scalarVariable";
import { VariableTypeDataSeriesSimple } from "../editor/variables/variableTypes/dataSeriesVariable";
import { VariableTypeExternalSimple } from "../editor/variables/variableTypes/externalDatasetVariable";
import { Fragment, useEffect, useMemo, useState } from "react";
import { clientSafeGetRoadmaps } from "@/fetchers/client";
import TabList from "../../generic/tablist/tabList";
import OutputDataSeries from "../editor/output/dataSeriesDisplay";
import OutputGraph from "../editor/output/graphDisplay";
import OutputStatus from "../editor/output/statusDisplay";
import { isMathjsUnit } from "@/functions/recipe/vectorAndMaskUtils";
import { IconAlertTriangleFilled } from "@tabler/icons-react";
import { RecipeEditorPermissions } from "../editor/variables/variableTypes/recipeEditorPermissions";
import type { DBRecipe } from "@/types";
import { SmartRecipe } from "@/functions/recipe/smartRecipe";
import getDefaultSuggestedRecipes from "./defaultSuggestedRecipes";

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
  const { recipe, setSmartRecipe, clearRecipe } = useRecipe();

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
        setAvailableRoadmaps(roadmaps.map(roadmap => ({ id: roadmap.id, name: t("common:roadmap_version_name", { name: roadmap.metaRoadmap.name, version: roadmap.version }) })));
      }
      catch (e) {
        console.error("Failed to fetch roadmaps", e);
      }
    }

    fetchRoadmaps().catch(e => { throw e; });
  }, [t]);

  // Validate suggested recipe structures
  useEffect(() => {
    // async function validateAll() {
      for (const dbRecipe of suggestedRecipes) {
        const recipe = SmartRecipe.fromObject(dbRecipe.recipe);
        if (!isSmartRecipe(recipe)) {
          console.warn("Invalid recipe in suggestions", dbRecipe);
          return;
        }
        // Disabled since this checks ALL suggested recipes EVERY TIME SOMEONE OPENS THE PAGE containing this component, not even just when they actually open the related modal
        // const validity = await recipe.checkValidity();
        // if (!validity.good) {
        //   console.warn("Invalid recipe in suggestions", dbRecipe, validity.error, validity.warnings);
        // }
      }
    // }
    // validateAll().catch(e => { throw e; });
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

    try {
      setSmartRecipe(SmartRecipe.fromObject(selectedSuggestion.recipe))
        .catch(e => { throw e; });
    }
    catch (e) {
      console.error("Failed to parse suggested recipe", e);
      clearRecipe();
      return;
    }
  };

  return (<>
    {/* Select which suggested recipe to use */}
    <label className="flex gap-50 margin-bottom-100 margin-top-25 align-items-center">
      {t("components:recipe_editor.recipe")}:
      <select
        id="select-preset"
        value={selectedRecipeId}
        onChange={handleChange}
      >
        <option disabled value={""}>{t("common:tsx.generic_select")}</option>
        {suggestedRecipes.map((suggestedRecipe, index) => (
          <option key={index} value={suggestedRecipe.id}> {/* TODO: The selected value needs to be preselected */}
            {SmartRecipe.fromObject(suggestedRecipe.recipe).name ?? t("components:copy_and_scale.unnamed_suggestion")}
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

    {selectedRecipeId &&
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