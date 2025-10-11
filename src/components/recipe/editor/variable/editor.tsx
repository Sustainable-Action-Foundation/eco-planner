'use client'

import { RecipeDataTypes, RecipeVariables } from "@/functions/recipe-parser/types";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import clientSafeGetOneRoadmap from "@/fetchers/clientSafeGetOneRoadmap";
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
  const { recipe, setRecipe } = useRecipe();

  const [availableRoadmaps, setAvailableRoadmaps] = useState<{ id: string; name: string; }[]>([]);
  const [selectedRoadmaps, setSelectedRoadmaps] = useState<string[]>([]);
  const [availableDataSeries, setAvailableDataSeries] = useState<{ id: string; name: string; roadmapId: string; }[]>([]); 

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

  // On selecting a roadmap, fetch its data series as selectable options
  useEffect(() => {
    if (!recipe || !recipe.variables) return;

    if (selectedRoadmaps.length === 0) {
      return;
    }

    // TODO: Need to do this when we expand a roadmap in our tree select instead of when we select one like we did previously
    async function fetchOneDataSeries(roadmapId: string) {
      try {
        const roadmapData = await clientSafeGetOneRoadmap(roadmapId);
        if (!roadmapData?.goals) return;

        const goals = roadmapData?.goals;
        if (!goals || !Array.isArray(goals) || goals.length === 0) {
          console.warn("No goals found in roadmap", roadmapId);
          return;
        }

        const series = goals.filter(g => g.dataSeries).map(goal => {
          if (!goal.dataSeries) return null;
          return {
            id: goal.dataSeries.id,
            name: goal.name || goal.indicatorParameter,
            roadmapId: roadmapId,
            ...(goal.dataSeries.unit ? { unit: goal.dataSeries.unit } : {})
          }
        });
        if (!series || series.length === 0) {
          console.warn("No data series found in roadmap", roadmapId);
          return;
        }

        const nonNullSeries = series.filter(ds => ds !== null);

        setAvailableDataSeries(nonNullSeries);
      }
      catch (e) {
        console.error("Failed to fetch data series for roadmap", e);
      }
    }

    async function fetchAllDataSeries() {
      if (!selectedRoadmaps || selectedRoadmaps.length === 0) return;

      // TODO: even though it iterates it will override the last fetched data series
      for (const roadmapId of selectedRoadmaps) {
        await fetchOneDataSeries(roadmapId);
      }
    }

    fetchAllDataSeries().catch(e => { throw e; });

  }, [recipe, selectedRoadmaps]);

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
              <VariableTypeScalar
                key={"recipeVariable" + i}
                name={name}
                rules={rules}
              />
            )
          case RecipeDataTypes.DataSeries:
            return (
              <VariableTypeDataSeries
                key={"recipeVariable" + i}
                name={name}
                rules={rules}
                availableRoadmaps={availableRoadmaps}
                availableDataSeries={availableDataSeries}
                setSelectedRoadmaps={setSelectedRoadmaps}
              />
            )
          case RecipeDataTypes.External:
            return (
              <VariableTypeExternal
                key={"recipeVariable" + i}
                name={name}
                rules={rules}
              />
            )
          default:
            variable = variable as RecipeVariables;
            console.warn("Unknown variable type", variable.type, "for variable", name);
        }
      })}
    </ul>
  );
}