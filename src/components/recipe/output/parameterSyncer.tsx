import { Trans, useTranslation } from "react-i18next";
import { useRecipe } from "../context/recipeContext.use";
import { getRecipeRoadmapData } from "../context/roadmapDataCache";
import { useEffect, useState } from "react";
import { RecipeDataTypes } from "@/functions/recipe/types/enums";
import type { ClientRoadmapIteration } from "@/types";

export default function ParameterSync({
  setter,
}: {
  setter: React.Dispatch<React.SetStateAction<string>>
}) {
  const { variables } = useRecipe();
  const [roadmapData, setRoadmapData] = useState<Record<string, ClientRoadmapIteration> | null>(null);
  const { t } = useTranslation("components");

  useEffect(() => {
    async function fetchRoadmapData() {
      try {
        const { roadmapLookup } = await getRecipeRoadmapData();
        setRoadmapData(roadmapLookup);
      }
      catch (err) {
        console.error("Failed to fetch roadmap data for parameter sync:", err);
      }
    }

    fetchRoadmapData().catch((err: unknown) => {
      console.error("Unexpected error fetching roadmap data for parameter sync:", err);
    });
  }, []);

  if (!roadmapData) return null;

  const dataSeriesVariables = variables.filter((variable) => variable.type === RecipeDataTypes.DataSeries);

  if (dataSeriesVariables.length === 0) {
    return null;
  } else if (dataSeriesVariables.length === 1) {
    const dataSeriesId = dataSeriesVariables[0].dataSeriesId;
    const resultingParameter = Object.values(roadmapData)
      .flatMap((roadmap) => roadmap.goals)
      .flatMap((goal) => [
        ...(goal.data_series ? [{ id: goal.data_series.id, indicatorParameter: goal.indicator_parameter }] : []),
        ...(goal.baseline ? [{ id: goal.baseline.id, indicatorParameter: goal.indicator_parameter }] : []),
        ...goal.effects.flatMap((effect) => effect.data_series ? [{ id: effect.data_series.id, indicatorParameter: goal.indicator_parameter }] : []),
      ]).find((entry) => entry.id === dataSeriesId)?.indicatorParameter;

    if (!resultingParameter) return null; // Fallback

    // Button to apply the single parameter if there's only one option
    return (
      <>
        <p className="margin-top-100 margin-bottom-25">{t("components:recipe_editor.apply_paramater_question")}</p>
        <button
          className="width-100"
          type="button"
          onClick={() => {
            setter(resultingParameter);
          }}
        >
          <Trans
            i18nKey="components:recipe_editor.apply_parameter"
            values={{ indicator: resultingParameter }}
            components={{ strong: <strong /> }}
          />
        </button>
      </>
    );
  } else { // > 1 data series variables
    const dataSeriesIds = dataSeriesVariables.map((variable) => variable.dataSeriesId);
    const resultingParameters = Object.values(roadmapData)
      .flatMap((roadmap) => roadmap.goals)
      .flatMap((goal) => [
        ...(goal.data_series ? [{ id: goal.data_series.id, indicatorParameter: goal.indicator_parameter }] : []),
        ...(goal.baseline ? [{ id: goal.baseline.id, indicatorParameter: goal.indicator_parameter }] : []),
        ...goal.effects.flatMap((effect) => effect.data_series ? [{ id: effect.data_series.id, indicatorParameter: goal.indicator_parameter }] : []),
      ]).filter((entry) => dataSeriesIds.includes(entry.id))
      .map((entry) => entry.indicatorParameter);

    if (resultingParameters.length === 0) {
      return null;
    } else if (resultingParameters.length === 1) {
      // Button to apply the single parameter if there's only one option after filtering
      return (
        <>
          <p className="margin-top-100 margin-bottom-25">{t("components:recipe_editor.apply_paramater_question")}</p>
          <button
            className="width-100"
            type="button"
            onClick={() => {
              setter(resultingParameters[0]);
            }}
          >
            <Trans
              i18nKey="components:recipe_editor.apply_parameter"
              values={{ indicator: resultingParameters[0] }}
              components={{ strong: <strong /> }}
            />
          </button>
        </>
      );
    } else {
      return null;
      // TODO: Allow selecting one of the available parameters
    }
  }
}