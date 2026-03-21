'use client'

import { RecipeDataTypes } from "@/functions/recipe/types";
import type { RecipeVariable } from "@/functions/recipe/types";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { clientSafeGetRoadmaps } from "@/fetchers/client";
import VariableTypeDataSeries from "./variableTypes/dataSeriesVariable";
import VariableTypeExternal from "./variableTypes/externalDatasetVariable";
import VariableTypeScalar from "./variableTypes/scalarVariable";
import { useRecipe } from "../../context/recipeContext.use";
import styles from '../recipe.module.css' with { type: "css" };
import VariableCreator from "./variableCreator";
import { RecipeEditorPermissions } from "./variableTypes/recipeEditorPermissions";

export default function VariableEditor({
  permissions = RecipeEditorPermissions,
}: {
  permissions?: RecipeEditorPermissions;
}) {
  const { t } = useTranslation("components");
  const { recipe } = useRecipe();

  const [availableRoadmaps, setAvailableRoadmaps] = useState<{ id: string; name: string; }[]>([]);

  // On mount, fetch all roadmaps user has access to
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

  return (
    <ul
      className={`list-style-none padding-50 margin-0 flex-grow-100 ${styles['variable-list']}`}
    >
      {Object.keys(recipe?.variables || []).length === 0 &&
        <li className="padding-bottom-75 margin-bottom-75">
          <div className="flex flex-direction-column align-items-center justify-content-center gap-25 padding-100 border-dashed border-2 border-gray-70 border-radius-8 background-color-gray-50">
            <p className="font-weight-500 gray-700 text-align-center">
              {t("components:recipe_editor.no_variables_yet")}
            </p>
            <VariableCreator allowAddVariables={true} />
          </div>
        </li>
      }
      {Object.entries(recipe?.variables || []).map(([name, variable], i) => {
        switch (variable.type) {
          case RecipeDataTypes.Scalar:
            return (
              <li className="padding-bottom-75 margin-bottom-75" key={name}>
                <VariableTypeScalar
                  key={"recipeVariable" + i}
                  name={name}
                  permissions={permissions}
                />
              </li>
            )
          case RecipeDataTypes.DataSeries:
            return (
              <li className="padding-bottom-75 margin-bottom-75" key={name}>
                <VariableTypeDataSeries
                  props={{
                    id: "recipeVariable" + i,
                    name: "recipeVariable" + i,
                  }}
                  key={"recipeVariable" + i}
                  variableName={name}
                  permissions={permissions}
                  availableRoadmaps={availableRoadmaps}
                />
              </li>
            )
          case RecipeDataTypes.External:
            return (
              <li className="padding-bottom-75 margin-bottom-75" key={name}>
                <VariableTypeExternal
                  key={"recipeVariable" + i}
                  variableName={name}
                  permissions={permissions}
                />
              </li>
            )
          default:
            variable = variable as RecipeVariable;
            console.warn("Unknown variable type", variable.type, "for variable", name);
        }
      })}
    </ul >
  );
}