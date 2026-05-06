'use client'

import { RecipeDataTypes } from "@/functions/recipe/types";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { clientSafeGetOneRoadmap, clientSafeGetRoadmaps } from "@/fetchers/client";
import { useRecipe } from "../context/recipeContext.use";
import styles from '../recipe.module.css' with { type: "css" };
import { RecipeEditorPermissions, VariableCreator, DataSeriesVariableEditor, VariableTypeExternal, VariableTypeScalar } from "@/components/recipe";

export function VariablesEditor({
  permissions: incomingPermissions,
}: {
  permissions?: RecipeEditorPermissions;
}) {
  const { t } = useTranslation("components");
  const { recipe } = useRecipe();

  const [availableRoadmaps, setAvailableRoadmaps] = useState<{ id: string; name: string; }[]>([]);

  const permissions = { ...RecipeEditorPermissions, ...incomingPermissions };

  // On mount, fetch all roadmaps user has access to
  useEffect(() => {
    async function fetchRoadmaps() {
      try {
        const roadmaps = await clientSafeGetRoadmaps();

        const roadmapsWithData = await Promise.all(
          roadmaps.map(async (roadmap) => {
            const fullRoadmap = await clientSafeGetOneRoadmap(roadmap.id);
            if (!fullRoadmap) return null;

            const hasInterestingChildren = fullRoadmap.goals.some((goal) => {
              if (goal.dataSeries || goal.baseline) return true;
              return goal.effects.some((effect) => !!effect.dataSeries);
            });

            if (!hasInterestingChildren) return null;
            return roadmap;
          }),
        );

        setAvailableRoadmaps(
          roadmapsWithData
            .filter((roadmap): roadmap is NonNullable<typeof roadmap> => !!roadmap)
            .map((roadmap) => ({
              id: roadmap.id,
              name: t("common:roadmap_version_name", { name: roadmap.metaRoadmap.name, version: roadmap.version }),
            })),
        );
      }
      catch (e) {
        console.error("Failed to fetch roadmaps", e);
      }
    }

    fetchRoadmaps().catch((e: unknown) => {
      const errorMessage = e instanceof Error ? e.message : String(e);
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
        )
        else if (variable.type === RecipeDataTypes.DataSeries) return (
          <li className="padding-bottom-75 margin-bottom-75" key={variableId}>
            <DataSeriesVariableEditor
              key={"recipeVariable" + i}
              variableId={variableId}
              permissions={{ ...permissions }}
              availableDataSeries={availableRoadmaps}
            />
          </li>
        )
        else if (variable.type === RecipeDataTypes.External) return (
          <li className="padding-bottom-75 margin-bottom-75" key={variableId}>
            <VariableTypeExternal
              key={"recipeVariable" + i}
              variableId={variableId}
              permissions={{ ...permissions }}
            />
          </li>
        )
        else console.warn("Unknown variable type", { variable }, "for variable", variableId);
      })}
    </ul>
  );
}