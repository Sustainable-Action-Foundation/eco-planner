"use client"

import { useRecipe } from "@/components/recipe/context/recipeContext.use";
import { isDataSeriesVariable } from "@/functions/recipe/types";
import { useTranslation } from "react-i18next";
import { RecipeEditorPermissions } from "./recipeEditorPermissions";
import { updateDataSeriesLink } from "@/components/recipe/variableEditingHelpers";
import React, { useCallback, useEffect, useState } from "react";
import type { InputElement, TreeItem } from "@/components/types";
import SelectSingleTreeSearch from "@/components/form/elements/combobox/selectSingleTreeSearch";
import type { RecipeContextType } from "@/components/recipe/context/recipeContext.internal";
import { clientSafeGetOneRoadmap, clientSafeGetOneDataSeries } from "@/fetchers/client";
import { VariableTypeCommon, VectorPickerSelect } from "@/components/recipe";

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
          name: !!goal.name ? goal.name : goal.indicatorParameter,
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
  variableName: string,
  setVariable: RecipeContextType["setVariable"],
) {
  return useCallback(
    (selectedDataSeriesLink: TreeItem | null) => {
      // Set the link immediately for responsiveness
      updateDataSeriesLink(variableName, selectedDataSeriesLink?.value || null, setVariable);

      // When unsetting variable
      if (!selectedDataSeriesLink?.value) return;

      // Dispatch async for "safely" setting state
      (async () => {
        try {
          // Fetch selected data series from db to get unit for UI use
          const db = await clientSafeGetOneDataSeries(selectedDataSeriesLink.value);
          const unit = typeof db?.unit !== "undefined" ? db?.unit : undefined;

          setVariable(variableName, (prevVar) => {
            return { ...prevVar, unit, };
          });
        }
        catch (e) {
          console.warn("Failed to fetch data series unit for selection", selectedDataSeriesLink.value, e);
        }
      })()
        .catch((e: unknown) => {
          const errorMessage = e instanceof Error ? e.message : String(e);
          console.error("Failed to fetch data series for selection", selectedDataSeriesLink.value, errorMessage);
        });
    },
    [variableName, setVariable]
  );
}

// TODO: Fix labels
// TODO: Check usage of permissions (prop that has been removed)
export function VariableTypeDataSeries({
  variableName,
  permissions,
  availableRoadmaps = [],
  props
}: {
  variableName: string;
  permissions?: RecipeEditorPermissions;
  availableRoadmaps?: { id: string; name: string; }[];
  props: InputElement;
}) {
  const { t } = useTranslation("components");
  const { recipe, setVariable, getVariable } = useRecipe();
  const variable = getVariable(variableName);

  const treeItems = useRoadmapTreeItems(availableRoadmaps);
  const handleDataSeriesChange = useHandleDataSeriesChange(variableName, setVariable);

  if (!variable) {
    console.error(`Variable "${variableName}" not found in recipe`, recipe);
    return null;
  }

  if (!isDataSeriesVariable(variable)) {
    console.error(`Variable "${variableName}" is not a valid DataSeriesVariable`, variable);
    return null;
  }

  permissions = { ...RecipeEditorPermissions, ...permissions };

  return (
    <VariableTypeCommon
      variableName={variableName}
      permissions={permissions}
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
        <VectorPickerSelect permissions={permissions} variableName={variableName} />
      </div>
    </VariableTypeCommon >
  )
}

// TODO: Check usage of permissions (prop that has been removed)
export function VariableTypeDataSeriesSimple({
  variableName,
  availableRoadmaps = [],
  props,
  goalName,
}: {
  variableName: string;
  availableRoadmaps?: { id: string; name: string; }[];
  props: InputElement;
  goalName?: string;
}) {
  const { recipe, setVariable, getVariable } = useRecipe();
  const variable = getVariable(variableName);

  const treeItems = useRoadmapTreeItems(availableRoadmaps);
  const handleDataSeriesChange = useHandleDataSeriesChange(variableName, setVariable);

  if (!variable) {
    console.error(`Variable "${variableName}" not found in recipe`, recipe);
    return null;
  }

  if (!isDataSeriesVariable(variable)) {
    console.error(`Variable "${variableName}" is not a valid DataSeriesVariable`, variable);
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
          value: variable.dataSeriesId || "",
          expanded: null,
        },
      } : {}}
    />
  )
}