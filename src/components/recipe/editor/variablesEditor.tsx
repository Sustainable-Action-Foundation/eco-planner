'use client';

import { RecipeDataTypes } from "@/functions/recipe/types";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRecipe } from "../context/recipeContext.use";
import styles from '../recipe.module.css' with { type: "css" };
import { RecipeEditorPermissions, VariableCreator, DataSeriesVariableEditor, VariableTypeExternal, VariableTypeScalar } from "@/components/recipe";
import { getRecipeRoadmapData } from "../context/roadmapDataCache";
import type { ClientRoadmap } from "@/types";

export function VariablesEditor({
  permissions: incomingPermissions,
}: {
  permissions?: RecipeEditorPermissions;
}) {
  const { t } = useTranslation("components");
  const { recipe } = useRecipe();

  const [availableRoadmaps, setAvailableRoadmaps] = useState<{ id: string; name: string; }[]>([]);
  const [roadmapLookup, setRoadmapLookup] = useState<Record<string, ClientRoadmap>>({});
  const [dataSeriesNamesById, setDataSeriesNamesById] = useState<Record<string, string>>({});

  const permissions = { ...RecipeEditorPermissions, ...incomingPermissions };

  useEffect(() => {
    async function fetchRoadmaps() {
      try {
        const { roadmaps, roadmapLookup } = await getRecipeRoadmapData();

        setAvailableRoadmaps(
          roadmaps.map((roadmap) => ({
            id: roadmap.id,
            name: t("common:roadmap_version_name", { name: roadmap.metaRoadmap.name, version: roadmap.version }),
          })),
        );

        setRoadmapLookup(roadmapLookup);

        setDataSeriesNamesById(
          Object.values(roadmapLookup).reduce((acc, roadmap) => {
            for (const goal of roadmap.goals) {
              const goalDisplayName = goal.name || goal.indicatorParameter;

              if (goal.dataSeries) {
                acc[goal.dataSeries.id] = goalDisplayName;
              }

              if (goal.baseline) {
                acc[goal.baseline.id] = `${goalDisplayName} - ${t("common:baseline_one")}`;
              }

              for (const effect of goal.effects) {
                if (!effect.dataSeries) continue;
                acc[effect.dataSeries.id] = `${goalDisplayName} - ${t("common:effect_one")}`;
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

    fetchRoadmaps().catch((err: unknown) => {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("Failed to fetch roadmaps", errorMessage);
    });
  }, [t]);

  return (
    <ul
      className={`list-style-none padding-50 margin-0 flex-grow-100 ${styles['variable-list']}`}
    >
      {(recipe?.variables.length ?? 0) === 0 &&
        <li className="padding-bottom-75 margin-bottom-75">
          <div className="flex flex-direction-column align-items-center justify-content-center gap-25 padding-100 border-dashed border-2 border-gray-70 border-radius-8 background-color-gray-50">
            <p className="font-weight-500 gray-700 text-align-center">
              {t("components:recipe_editor.no_variables_yet")}
            </p>
            <VariableCreator />
          </div>
        </li>
      }
      {(recipe?.variables ?? []).map((variable, i) => {
        const variableId = variable.id;
        if (variable.type === RecipeDataTypes.Scalar) return (
          <li className="padding-bottom-75 margin-bottom-75" key={variableId} >
            <VariableTypeScalar
              key={"recipeVariable" + i}
              variableId={variableId}
              permissions={{ ...permissions }}
            />
          </li>
        );
        else if (variable.type === RecipeDataTypes.DataSeries) return (
          <li className="padding-bottom-75 margin-bottom-75" key={variableId}>
            <DataSeriesVariableEditor
              key={"recipeVariable" + i}
              variableId={variableId}
              permissions={{ ...permissions }}
              availableDataSeries={availableRoadmaps}
              roadmapLookup={roadmapLookup}
              dataSeriesNamesById={dataSeriesNamesById}
            />
          </li>
        );
        else if (variable.type === RecipeDataTypes.External) return (
          <li className="padding-bottom-75 margin-bottom-75" key={variableId}>
            <VariableTypeExternal
              key={"recipeVariable" + i}
              variableId={variableId}
              permissions={{ ...permissions }}
            />
          </li>
        );
        else console.warn("Unknown variable type", { variable }, "for variable", variableId);
      })}
    </ul>
  );
}