"use client"

import { isDataSeriesVariable, RecipeError } from "@/functions/recipe/types";
import { useTranslation } from "react-i18next";
import React, { useCallback, useMemo } from "react";
import type { InputElement, TreeItem } from "@/components/types";
import SelectSingleTreeSearch from "@/components/form/elements/combobox/selectSingleTreeSearch";
import { clientSafeGetOneRoadmap } from "@/fetchers/client";
import { RecipeEditorPermissions, CommonVariable, useRecipe, VectorPickerSelect } from "@/components/recipe";
import type { RecipeContextType } from "@/components/recipe";

type AvailableRoadmapOption = { id: string; name: string; };

function useRoadmapTreeItems(availableRoadmaps: AvailableRoadmapOption[]) {
  const { t } = useTranslation("components");

  return useMemo(() => {
    return availableRoadmaps.map((roadmap): TreeItem => ({
      expanded: false,
      name: roadmap.name,
      value: `roadmap:${roadmap.id}`,
      onExpand: async () => {
        const data = await clientSafeGetOneRoadmap(roadmap.id);
        if (!data) return [];

        return data.goals.map((goal): TreeItem => {
          const goalDisplayName = goal.name || goal.indicatorParameter;
          const goalChildren: TreeItem[] = [];

          if (goal.dataSeries) {
            goalChildren.push({
              name: goalDisplayName,
              value: goal.dataSeries.id,
              expanded: null,
            });
          }

          if (goal.baseline) {
            goalChildren.push({
              name: `${goalDisplayName} ${t("components:recipe_editor.baseline")}`,
              value: goal.baseline.id,
              expanded: null,
            });
          }

          for (const effect of goal.effects) {
            if (!effect.dataSeries) continue;
            goalChildren.push({
              name: `${goalDisplayName} ${t("components:recipe_editor.effect")}`,
              value: effect.dataSeries.id,
              expanded: null,
            });
          }

          return {
            name: goalDisplayName,
            value: `goal:${goal.id}`,
            expanded: goalChildren.length > 0 ? false : null,
            ...(goalChildren.length > 0 ? { childNodes: goalChildren } : {}),
          };
        });
      },
    }));
  }, [availableRoadmaps, t]);
}

function useHandleDataSeriesChange(
  variableName: string,
  setVariable: RecipeContextType["setVariable"],
) {
  return useCallback((treeValue: TreeItem | null) => {
    setVariable(variableName, (prev) => {
      if (!treeValue?.value) {
        return { ...prev, dataSeriesId: undefined };
      }

      // Only leaf nodes represent data series IDs.
      if (treeValue.value.startsWith("roadmap:") || treeValue.value.startsWith("goal:")) {
        return { ...prev, dataSeriesId: undefined };
      }

      return { ...prev, dataSeriesId: treeValue.value };
    });
  }, [setVariable, variableName]);
}

type AvailableDataSeries = AvailableRoadmapOption[];

// TODO: Fix labels
// TODO: Check usage of permissions (prop that has been removed)
export function DataSeriesVariableEditor({
  variableId,
  permissions,
  availableDataSeries = [],
}: {
  variableId: string;
  permissions?: RecipeEditorPermissions;
  availableDataSeries?: AvailableDataSeries;
}) {
  const { t } = useTranslation("components");
  const { recipe, setVariable, getVariable } = useRecipe();
  const variable = getVariable(variableId);
  const fieldIdBase = `recipe-data-series-${variableId.replace(/[^A-Za-z0-9_-]/g, "-")}`;

  const treeItems = useRoadmapTreeItems(availableDataSeries);
  const handleDataSeriesChange = useHandleDataSeriesChange(variableId, setVariable);

  if (!variable) {
    console.error(`Variable "${variableId}" not found in recipe`, { recipe, variableId, variable, availableDataSeries });
    throw new RecipeError(`Variable "${variableId}" not found in recipe`);
  }

  if (!isDataSeriesVariable(variable)) {
    console.error(`Variable "${variableId}" is not a valid DataSeriesVariable`, variable);
    throw new RecipeError(`Variable "${variableId}" is not a valid DataSeriesVariable`);
  }

  permissions = { ...RecipeEditorPermissions, ...permissions };

  return (
    <CommonVariable
      variableId={variableId}
      permissions={permissions}
    >
      {/* TODO: Why is this height mismatched */}
      <div className="inline-block floating-label" style={{ verticalAlign: "top", width: "200px", "--background": "linear-gradient(var(--gray-95) 50%, white 100%)" } as React.CSSProperties}>
        <label htmlFor={fieldIdBase}>
          {t("components:recipe_editor.select_data_series")}
        </label>
        <SelectSingleTreeSearch
          props={{
            id: fieldIdBase,
            name: fieldIdBase,
            placeholder: t("components:recipe_editor.select_data_series"),
            required: false,
          }}
          treeItems={treeItems}
          onChange={handleDataSeriesChange}
        />
      </div>
      <div className="inline-block floating-label" style={{ width: "200px", "--background": "linear-gradient(var(--gray-95) 50%, white 100%)" } as React.CSSProperties}>
        <label htmlFor="variable-tree-vector-index-picker">
          {t("components:recipe_editor.vector_index_picker_label")}
        </label>
        <VectorPickerSelect permissions={permissions} variableName={variableId} />
      </div>
    </CommonVariable >
  )
}

// TODO: Check usage of permissions (prop that has been removed)
export function DataSeriesVariableSimpleEditor({
  variableId,
  availableDataSeries = [],
  props,
}: {
  variableId: string;
  availableDataSeries?: AvailableRoadmapOption[];
  props: InputElement;
}) {
  const { recipe, setVariable, getVariable } = useRecipe();
  const variable = getVariable(variableId);

  const treeItems = useRoadmapTreeItems(availableDataSeries);
  const handleDataSeriesChange = useHandleDataSeriesChange(variableId, setVariable);

  if (!variable) {
    console.error(`Variable "${variableId}" not found in recipe`, recipe);
    return null;
  }

  if (!isDataSeriesVariable(variable)) {
    console.error(`Variable "${variableId}" is not a valid DataSeriesVariable`, variable);
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
        style: props.style,
      }}
      treeItems={treeItems}
      onChange={handleDataSeriesChange}
    />
  )
}