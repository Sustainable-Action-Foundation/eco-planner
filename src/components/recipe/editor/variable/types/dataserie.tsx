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
import clientSafeGetOneRoadmap from "@/fetchers/clientSafeGetOneRoadmap";

// TODO: I18n
// TODO: Fix labels
// TODO: Check usage of inputrules (prop that has been removed)
export default function VariableTypeDataSeries({
  name,
  rules,
  availableRoadmaps = [],
}: {
  name: string;
  rules?: InputRules;
  availableRoadmaps?: { id: string; name: string; }[];
}) {
  const { t } = useTranslation("components");
  const { recipe, setRecipe } = useRecipe();
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
        changeDataSeries(name, selectedDataSeries.value, setRecipe);
      }
    },
    [name, setRecipe]
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
      <SelectSingleTreeSearch // TODO: Fix disabled state
        props={{
          id: 'variable-tree', // TODO: Name and id must be dynamic
          name: '',
          placeholder: 'Välj målbana eller effekt' // TODO: i18n
        }}
        treeItems={treeItems}
        onChange={handleDataSeriesChange}
      />

      <VectorIndexPicker />

    </VariableTypeCommon >
  )
}

// TODO: Check usage of inputrules (prop that has been removed)
export function VariableTypeDataSeriesSimple({
  name,
  availableRoadmaps = [],
}: {
  name: string;
  availableRoadmaps?: { id: string; name: string; }[];
}) {
  const { t } = useTranslation("components");
  const { recipe, setRecipe } = useRecipe();
  const variable = recipe?.variables[name] as RecipeVariables;

  const [treeItems, setTreeItems] = useState<treeItem[]>([]);

  useEffect(() => { // TODO: This useeffect can probably be abstractated, we use it in above component aswell
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

  const handleDataSeriesChange = useCallback( // TODO: This callback can probably be abstractated, we use it in above component aswell
    (selectedDataSeries: treeItem | null) => {
      if (selectedDataSeries?.value) {
        changeDataSeries(name, selectedDataSeries.value, setRecipe);
      }
    },
    [name, setRecipe]
  );

  if (!isRecipeDataSeries(variable)) {
    console.error(`Variable "${name}" is not a valid DataSeriesVariable`, variable);
    return null;
  }

  return (
    <SelectSingleTreeSearch // TODO: Fix disabled state
      props={{
        id: 'variable-tree', // TODO: Name and id must be dynamic
        name: '',
        placeholder: 'Välj målbana eller effekt' // TODO: i18n
      }}
      treeItems={treeItems}
      onChange={handleDataSeriesChange}
    />
  )
}