"use client"

import { useRecipe } from "@/components/recipe/contextProvider";
import { isRecipeDataSeries, RecipeVariable } from "@/functions/recipe-parser/types";
import { useTranslation } from "react-i18next";
import { InputRules, defaultInputRules } from "./rules";
import { changeDataSeries } from "@/components/recipe/contextFunctions";
import VariableTypeCommon from "./common";
import VectorIndexPicker from "./vectorIndexPicker";
import React, { useCallback, useEffect, useState } from "react";
import { InputElement, TreeItem } from "@/components/types";
import SelectSingleTreeSearch from "@/components/form/elements/combobox/selectSingleTreeSearch";
import clientSafeGetOneRoadmap from "@/fetchers/clientSafeGetOneRoadmap";
import { Recipe } from "@/functions/recipe-parser/types";
import clientSafeGetOneDataSeries from "@/fetchers/clientSafeGetOneDataSeries";

function useRoadmapTreeItems(availableRoadmaps: { id: string; name: string; }[]) {
  const [treeItems, setTreeItems] = useState<TreeItem[]>([]);

  useEffect(() => {
    const newItems: TreeItem[] = availableRoadmaps.map((roadmap) => ({
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

// TODO: don't fetch again :sob: This data is fetched deeper down in the tree select but the scope jumping would probably be worse spaghetti than this solution
export function useHandleDataSeriesChange(
  name: string,
  setRecipe: React.Dispatch<React.SetStateAction<Recipe | null>>
) {
  return useCallback(
    (selectedDataSeriesLink: TreeItem | null) => {
      // Set the link immediately for responsiveness
      changeDataSeries(name, selectedDataSeriesLink?.value || null, setRecipe);

      // When unsetting variable
      if (!selectedDataSeriesLink?.value) return;

      // Dispatch async for "safely" setting state
      (async () => {
        try {
          // Fetch selected data series from db to get unit for UI use
          const db = await clientSafeGetOneDataSeries(selectedDataSeriesLink.value);
          const unitToSet = typeof db?.unit !== "undefined" ? db?.unit : undefined;

          setRecipe(prev => {
            if (!prev) return prev;

            const currentVar = prev.variables[name];

            if (!isRecipeDataSeries(currentVar)) return prev;
            if (!currentVar || currentVar.link !== selectedDataSeriesLink.value) return prev;

            const copy = { ...prev.variables };
            copy[name] = { ...copy[name], unit: unitToSet };
            return { ...prev, variables: copy };
          });
        } catch (e) {
          console.warn("Failed to fetch data-series unit for selection", selectedDataSeriesLink.value, e);
        }
      })()
        .catch(e => { console.error(e); });
    },
    [name, setRecipe]
  );
}

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
  props: InputElement;
}) {
  const { t } = useTranslation("components");
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
        <label htmlFor={props.id}>
          {t("components:recipe_editor.select_data_series")}
        </label>
        <SelectSingleTreeSearch
          props={{
            id: props.id,
            name: props.name,
            placeholder: props.placeholder,
            defaultValue: props.defaultValue,
            required: props.required,
          }}
          treeItems={treeItems}
          onChange={handleDataSeriesChange}
        />
      </div>
      <div className="inline-block floating-label" style={{ width: "200px", "--background": "linear-gradient(var(--gray-95) 50%, white 100%)" } as React.CSSProperties}>
        <label htmlFor="variable-tree-vector-index-picker">
          {t("components:recipe_editor.vector_index_picker_label")}
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
  props,
  goalName,
}: {
  name: string;
  availableRoadmaps?: { id: string; name: string; }[];
  props: InputElement;
  goalName?: string;
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
        required: props.required,
        disabled: props.disabled,
      }}
      treeItems={treeItems}
      onChange={handleDataSeriesChange}
      {...goalName ? {
        defaultValue: {
          name: goalName,
          value: variable.link || "",
          expanded: null,
        },
      } : {}}
    />
  )
}