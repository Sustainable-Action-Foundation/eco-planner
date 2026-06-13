import { useTranslation } from "react-i18next";
import { useRecipe } from "../context/recipeContext.use";
import { getRecipeRoadmapData } from "../context/roadmapDataCache";
import { useEffect, useState } from "react";
import type { ClientRoadmap } from "@/types";

export default function ParameterSync({
  setter,
}: {
  setter: React.Dispatch<React.SetStateAction<string>>
}) {
  const { variables } = useRecipe();
  const [roadmapData, setRoadmapData] = useState<Record<string, ClientRoadmap> | null>(null);
  const { t } = useTranslation("components");


  useEffect(() => {
    async function fetchRoadmapData() {
      try {
        const { roadmapLookup } = await getRecipeRoadmapData();
        setRoadmapData(roadmapLookup);
      }
      catch (e: unknown) {
        console.error("Failed to fetch roadmap data for parameter sync:", e);
      }
    }

    fetchRoadmapData().catch((e: unknown) => {
      console.error("Unexpected error fetching roadmap data for parameter sync:", e);
    });
  }, []);

  if (!roadmapData) return null;

  const dataSeriesVariables = variables.filter((variable) => variable.type === "dataSeries");

  if (dataSeriesVariables.length === 0) {
    return null;
  } else if (dataSeriesVariables.length === 1) {
    const dataSeriesId = dataSeriesVariables[0].dataSeriesId;
    const resultingParameter = Object.values(roadmapData)
      .flatMap((roadmap) => roadmap.goals)
      .flatMap((goal) => [
        ...(goal.dataSeries ? [{ id: goal.dataSeries.id, indicatorParameter: goal.indicatorParameter }] : []),
        ...(goal.baseline ? [{ id: goal.baseline.id, indicatorParameter: goal.indicatorParameter }] : []),
        ...goal.effects.flatMap((effect) => effect.dataSeries ? [{ id: effect.dataSeries.id, indicatorParameter: goal.indicatorParameter }] : []),
      ]).find((entry) => entry.id === dataSeriesId)?.indicatorParameter;

    if (!resultingParameter) return null; // Fallback

    // Button to apply the single parameter if there's only one option
    return (
      <button
        type="button"
        onClick={() => {
          setter(resultingParameter);
        }}
      >
        {t("components:recipe_editor.apply_parameter")}
      </button>
    );
  } else { // > 1 data series variables
    const dataSeriesIds = dataSeriesVariables.map((variable) => variable.dataSeriesId);
    const resultingParameters = Object.values(roadmapData)
      .flatMap((roadmap) => roadmap.goals)
      .flatMap((goal) => [
        ...(goal.dataSeries ? [{ id: goal.dataSeries.id, indicatorParameter: goal.indicatorParameter }] : []),
        ...(goal.baseline ? [{ id: goal.baseline.id, indicatorParameter: goal.indicatorParameter }] : []),
        ...goal.effects.flatMap((effect) => effect.dataSeries ? [{ id: effect.dataSeries.id, indicatorParameter: goal.indicatorParameter }] : []),
      ]).filter((entry) => dataSeriesIds.includes(entry.id))
      .map((entry) => entry.indicatorParameter);

    if (resultingParameters.length === 0) {
      return null;
    } else if (resultingParameters.length === 1) {
      // Button to apply the single parameter if there's only one option after filtering
      return (
        <button
          type="button"
          onClick={() => {
            setter(resultingParameters[0]);
          }}
        >
          {t("components:recipe_editor.apply_parameter")}
        </button>
      );
    } else {
      return null;
      // TODO: Allow selecting one of the available parameters
    }
  }
}