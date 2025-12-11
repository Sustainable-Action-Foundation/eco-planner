"use client"

import { useRecipe } from "@/components/recipe/contextProvider";
import { isRecipeDataSeries, RecipeVariable } from "@/functions/recipe-parser/types";
// import { useTranslation } from "react-i18next";
import { InputRules, defaultInputRules } from "./rules";
import { changeDataSeries } from "@/components/recipe/contextFunctions";
import VariableTypeCommon from "./common";
import VectorIndexPicker from "./vectorIndexPicker";
import React, { useCallback, useEffect, useState } from "react";
import { inputElement, treeItem } from "@/components/types";
import SelectSingleTreeSearch from "@/components/form/elements/combobox/selectSingleTreeSearch";
import clientSafeGetOneRoadmap from "@/fetchers/clientSafeGetOneRoadmap";
import { Recipe } from "@/functions/recipe-parser/types";

function useRoadmapTreeItems(availableRoadmaps: { id: string; name: string; }[]) {
  const [treeItems, setTreeItems] = useState<treeItem[]>([]);

  useEffect(() => {
    const newItems: treeItem[] = availableRoadmaps.map((roadmap) => ({
      expanded: null,
      name: roadmap.name,
      value: roadmap.id,
      onExpand: async () => {
        const data = await clientSafeGetOneRoadmap(roadmap.id);
        if (!data) return [];
        return data.goals.map((goal) => ({
          name: goal.name ? goal.name : goal.indicatorParameter,
          value: goal.dataSeries ? goal.dataSeries.id : '',
          expanded: null,
        }));
      },
    }));

    setTreeItems(newItems);
  }, [availableRoadmaps]);

  return treeItems;
}

export function useHandleDataSeriesChange(
  name: string,
  setRecipe: React.Dispatch<React.SetStateAction<Recipe | null>>
) {
  return useCallback(
    (selectedDataSeries: treeItem | null) => {
      if (selectedDataSeries?.value) {
        changeDataSeries(name, selectedDataSeries.value, setRecipe);
      }
    },
    [name, setRecipe]
  );
}

// TODO: I18n
// TODO: Fix labels
// TODO: Check usage of inputrules (prop that has been removed)
export default function VariableTypeDataSeries({
  name,
  rules,
  availableRoadmaps = [],
  props
}: {
  name: string;
  rules?: InputRules;
  availableRoadmaps?: { id: string; name: string; }[];
  props: inputElement;
}) {
  // const { t } = useTranslation("components");
  const { recipe, setRecipe } = useRecipe();
  const variable = recipe?.variables[name] as RecipeVariable;

  const treeItems = useRoadmapTreeItems(availableRoadmaps);
  const handleDataSeriesChange = useHandleDataSeriesChange(name, setRecipe);

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
      {/* TODO: Why is this height mismatched */}
      <div className="inline-block floating-label" style={{ verticalAlign: "top", width: "200px", "--background": "linear-gradient(var(--gray-95) 50%, white 100%)" } as React.CSSProperties}>
        <label htmlFor="variable-tree">
          Välj målbana eller effekt {/* TODO: i18n */}
        </label>
        <SelectSingleTreeSearch
          props={{
            id: props.id,
            name: props.name,
            placeholder: props.placeholder,
          }}
          treeItems={treeItems}
          onChange={handleDataSeriesChange}
        />
      </div>
      <div className="inline-block floating-label" style={{ width: "200px", "--background": "linear-gradient(var(--gray-95) 50%, white 100%)" } as React.CSSProperties}>
        <label htmlFor="variable-tree-vector-index-picker">
          Värde {/* TODO: i18n */}
        </label>
        <VectorIndexPicker rules={rules} varName={name} />
      </div>
    </VariableTypeCommon >
  )
}

// TODO: Check usage of inputrules (prop that has been removed)
export function VariableTypeDataSeriesSimple({
  name,
  availableRoadmaps = [],
  props
}: {
  name: string;
  availableRoadmaps?: { id: string; name: string; }[];
  props: inputElement;
}) {
  // const { t } = useTranslation("components");
  const { recipe, setRecipe } = useRecipe();
  const variable = recipe?.variables[name] as RecipeVariable;

  const treeItems = useRoadmapTreeItems(availableRoadmaps);
  const handleDataSeriesChange = useHandleDataSeriesChange(name, setRecipe);

  if (!isRecipeDataSeries(variable)) {
    console.error(`Variable "${name}" is not a valid DataSeriesVariable`, variable);
    return null;
  }

  return (
    <SelectSingleTreeSearch
      props={{
        id: props.id,
        name: props.name,
        placeholder: props.placeholder,
        required: props.required
      }}
      treeItems={treeItems}
      onChange={handleDataSeriesChange}
    />
  )
}