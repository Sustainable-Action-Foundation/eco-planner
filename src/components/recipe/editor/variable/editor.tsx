'use client'

import { RecipeDataTypes, RecipeVariable } from "@/functions/recipe-parser/types";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import clientSafeGetRoadmaps from "@/fetchers/clientSafeGetRoadmaps";
import VariableTypeDataSeries from "./types/dataserie";
import VariableTypeExternal from "./types/external";
import VariableTypeScalar from "./types/scalar";
import { useRecipe } from "../../contextProvider";
import styles from '../editor.module.css'

export default function VariableEditor({
  allowAddVariables = false,
  allowDeleteVariables = false,
  allowNameEditing = false,
  allowTypeEditing = false,
  allowValueEditing = true,
}: {
  allowAddVariables?: boolean;
  allowDeleteVariables?: boolean;
  allowNameEditing?: boolean;
  allowTypeEditing?: boolean;
  allowValueEditing?: boolean;
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
      {Object.entries(recipe?.variables || []).map(([name, variable], i) => {
        const rules = {
          allowAddVariables,
          allowDeleteVariables,
          allowNameEditing,
          allowTypeEditing,
          allowValueEditing,
        };
        switch (variable.type) {
          case RecipeDataTypes.Scalar:
            return (
              <li className="padding-bottom-75 margin-bottom-75" key={name}>
                <VariableTypeScalar
                  key={"recipeVariable" + i}
                  name={name}
                  rules={rules}
                />
              </li>
            )
          case RecipeDataTypes.DataSeries:
            return (
              <li className="padding-bottom-75 margin-bottom-75" key={name}>
                <VariableTypeDataSeries
                  key={"recipeVariable" + i}
                  name={name}
                  rules={rules}
                  availableRoadmaps={availableRoadmaps}
                />
              </li>
            )
          case RecipeDataTypes.External:
            return (
              <li className="padding-bottom-75 margin-bottom-75" key={name}>
                <VariableTypeExternal
                  key={"recipeVariable" + i}
                  name={name}
                  rules={rules}
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