"use client"

import { useRecipe } from "@/components/recipe/contextProvider";
import { isRecipeDataSeries, RecipeVariables } from "@/functions/recipe-parser/types";
import { useTranslation } from "react-i18next";
import { InputRules, defaultInputRules } from "./rules";
import { changeDataSeries } from "@/components/recipe/contextFunctions";
import VariableTypeCommon from "./common";
import VectorIndexPicker from "./vectorIndexPicker";
import React, { useCallback, useEffect, useState } from "react";
import { treeItem } from "@/components/types";
import SelectSingleTreeSearch from "@/components/form/elements/combobox/selectSingleTreeSearch";
import getOneRoadmap from "@/fetchers/getOneRoadmap";
import clientSafeGetOneRoadmap from "@/fetchers/clientSafeGetOneRoadmap";
import { Goal } from "@/types";

// TODO: I18n
// TODO: Replace roadmap/goal select with treeselect
// TODO: Fix labels
export default function VariableTypeDataSeries({
  name,
  rules,
  availableRoadmaps = [],
  availableDataSeries = [],
  setSelectedRoadmaps,
}: {
  name: string;
  rules?: InputRules;
  availableRoadmaps?: { id: string; name: string; }[];
  availableDataSeries?: { id: string; name: string; roadmapId: string; unit?: string; }[];
  setSelectedRoadmaps: React.Dispatch<React.SetStateAction<string[]>>;
}) {
  const { t } = useTranslation("components");
  const { recipe, setRecipe } = useRecipe();
  const [selectedRoadmap, setLocalRoadmap] = React.useState<string | null>(null);
  const variable = recipe?.variables[name] as RecipeVariables;
  const [treeItems, setTreeItems] = useState<treeItem[]>([]);

  useEffect(() => {
    const newItems: treeItem[] = availableRoadmaps.map((roadmap) => ({
      expanded: null,
      name: roadmap.name,
      value: roadmap.id,
      onExpand: () => {
        return clientSafeGetOneRoadmap(roadmap.id).then((data) => {
          if (!data) return [];
          return data.goals.map((goal) => ({
            name: goal.name ? goal.name : goal.indicatorParameter,
            value: goal.dataSeries ? goal.dataSeries.id : '',
            expanded: null,
          }));
        });
      },
    }));

    setTreeItems(newItems);
  }, [availableRoadmaps]);

  const handleDataSeriesChange = useCallback(
    (selectedDataSeries: treeItem | null) => {
      if (selectedDataSeries?.value) {
        changeDataSeries(name, selectedDataSeries.value, availableDataSeries, setRecipe);
      }
    },
    [name, availableDataSeries, setRecipe]
  );

  if (!isRecipeDataSeries(variable)) {
    console.error(`Variable "${name}" is not a valid DataSeriesVariable`, variable);
    return null;
  }

  rules = { ...defaultInputRules, ...rules };

  return (
    <VariableTypeCommon
      name={name}
      rules={rules}
    >
      
      <select
        defaultValue={selectedRoadmap || ""}
        onChange={(e) => {
          setLocalRoadmap(e.target.value || null);
          setSelectedRoadmaps(prev => [...new Set([...prev, e.target.value].filter(Boolean))]);
        }}
        disabled={!rules.allowValueEditing}
      >
        <option disabled={true} value={""}>{t("components:recipe_editor.select_roadmap")}</option>
        {availableRoadmaps.map((r, i) => (
          <option key={`roadmapOption-${i}`} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
      <select
        value={variable.link || ""}
        onChange={(e) => changeDataSeries(name, e.target.value, availableDataSeries, setRecipe)}
        disabled={!rules.allowValueEditing}
      >
        <option disabled={true} value="">{t("components:recipe_editor.goal_or_effect")}</option>
        {availableDataSeries
          .map(ds => ({ ...ds, displayName: ds.unit ? `(${ds.unit}) ${ds.name}` : ds.name }))
          .sort((a, b) => a.displayName.localeCompare(b.displayName))
          .map(ds => (
            <option key={`dataSeries-${ds.id}`} value={ds.id}>
              {ds.displayName}
            </option>
          ))}
      </select>
      

      <SelectSingleTreeSearch // TODO: Fix disabled state
        props={{
          id: 'variable-tree', // TODO: Name and id must be dynamic
          name: '',
          placeholder: 'Välj målbana eller effekt' // TODO: i18n
        }}
        treeItems={treeItems}
        onChange={handleDataSeriesChange}
      // onChange={(value) => handleDataSeriesChange(value ? value.value : '')}
      />

      <VectorIndexPicker />

    </VariableTypeCommon >
  )
}

export function VariableTypeDataSeriesSimple({
  name,
  rules,
  availableRoadmaps = [],
  availableDataSeries = [],
  setSelectedRoadmaps,
}: {
  name: string;
  rules?: InputRules;
  availableRoadmaps?: { id: string; name: string; }[];
  availableDataSeries?: { id: string; name: string; roadmapId: string; unit?: string; }[];
  setSelectedRoadmaps: React.Dispatch<React.SetStateAction<string[]>>;
}) {
  const { t } = useTranslation("components");
  const { recipe, setRecipe } = useRecipe();
  const [selectedRoadmap, setLocalRoadmap] = React.useState<string | null>(null);
  const variable = recipe?.variables[name] as RecipeVariables;

  if (!isRecipeDataSeries(variable)) {
    console.error(`Variable "${name}" is not a valid DataSeriesVariable`, variable);
    return null;
  }

  rules = { ...defaultInputRules, ...rules };

  return (
    <div className="flex gap-25">
      <select
        defaultValue={selectedRoadmap || ""}
        onChange={(e) => {
          setLocalRoadmap(e.target.value || null);
          setSelectedRoadmaps(prev => [...new Set([...prev, e.target.value].filter(Boolean))]);
        }}
        disabled={!rules.allowValueEditing}
      >
        <option disabled={true} value={""}>{t("components:recipe_editor.select_roadmap")}</option>
        {availableRoadmaps.map((r, i) => (
          <option key={`roadmapOption-${i}`} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
      <select
        value={variable.link || ""}
        onChange={(e) => changeDataSeries(name, e.target.value, availableDataSeries, setRecipe)}
        disabled={!rules.allowValueEditing}
      >
        <option disabled={true} value="">{t("components:recipe_editor.goal_or_effect")}</option>
        {availableDataSeries
          .map(ds => ({ ...ds, displayName: ds.unit ? `(${ds.unit}) ${ds.name}` : ds.name }))
          .sort((a, b) => a.displayName.localeCompare(b.displayName))
          .map(ds => (
            <option key={`dataSeries-${ds.id}`} value={ds.id}>
              {ds.displayName}
            </option>
          ))}
      </select>
    </div>
  )
}