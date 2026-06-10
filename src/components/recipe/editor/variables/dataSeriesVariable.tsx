"use client";

import { isDataSeriesVariable, RecipeError } from "@/functions/recipe/types";
import { useTranslation } from "react-i18next";
import React, { useCallback, useMemo } from "react";
import type { TreeItem } from "@/components/types";
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
              name: `${goalDisplayName} - ${t("common:baseline_one")}`,
              value: goal.baseline.id,
              expanded: null,
            });
          }

          for (const effect of goal.effects) {
            if (!effect.dataSeries) continue;
            goalChildren.push({
              name: `${goalDisplayName} - ${t("common:effect_one")}`,
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
  variableId: string,
  upsertVariable: RecipeContextType["upsertVariable"],
) {
  return useCallback((treeValue: TreeItem | null) => {
    upsertVariable(variableId, (prev) => {
      if (!treeValue?.value) {
        return { ...prev, dataSeriesId: undefined };
      }

      // Only leaf nodes represent data series IDs.
      if (treeValue.value.startsWith("roadmap:") || treeValue.value.startsWith("goal:")) {
        return { ...prev, dataSeriesId: undefined };
      }

      return { ...prev, dataSeriesId: treeValue.value };
    });
  }, [upsertVariable, variableId]);
}

type AvailableDataSeries = AvailableRoadmapOption[];

// TODO: Fix labels
export function DataSeriesVariableEditor({
  variableId,
  permissions: incomingPermissions,
  availableDataSeries = [],
}: {
  variableId: string;
  permissions?: RecipeEditorPermissions;
  availableDataSeries?: AvailableDataSeries;
}) {
  const { t } = useTranslation("components");
  const { recipe, upsertVariable, getVariable } = useRecipe();
  const variable = getVariable(variableId);
  const fieldIdBase = `recipe-data-series-${variableId.replace(/[^A-Za-z0-9_-]/g, "-")}`;

  const treeItems = useRoadmapTreeItems(availableDataSeries);
  const handleDataSeriesChange = useHandleDataSeriesChange(variableId, upsertVariable);

  if (!variable) {
    console.error(`Variable "${variableId}" not found in recipe`, { recipe, variableId, variable, availableDataSeries });
    throw new RecipeError(`Variable "${variableId}" not found in recipe`);
  }

  if (!isDataSeriesVariable(variable)) {
    console.error(`Variable "${variableId}" is not a valid DataSeriesVariable`, variable);
    throw new RecipeError(`Variable "${variableId}" is not a valid DataSeriesVariable`);
  }

  const defaultTreeValue = variable.dataSeriesId
    ? {
      name: variable.dataSeriesId,
      value: variable.dataSeriesId,
      expanded: null,
    }
    : undefined;

  const permissions = { ...RecipeEditorPermissions, ...incomingPermissions };

  return (
    <CommonVariable
      variableId={variableId}
      permissions={{ ...permissions }}
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
          defaultValue={defaultTreeValue}
          treeItems={treeItems}
          onChange={handleDataSeriesChange}
        />
      </div>
      <div className="inline-block floating-label" style={{ width: "200px", "--background": "linear-gradient(var(--gray-95) 50%, white 100%)" } as React.CSSProperties}>
        <label htmlFor="variable-tree-vector-index-picker">
          {t("components:recipe_editor.vector_index_picker_label")}
        </label>
        <VectorPickerSelect permissions={{ ...permissions }} variableId={variableId} />
      </div>
    </CommonVariable >
  );
}

export function DataSeriesVariableSimpleEditor({
  variableId,
  availableDataSeries = [],
  permissions: incomingPermissions,
}: {
  variableId: string;
  availableDataSeries?: AvailableRoadmapOption[];
  permissions?: RecipeEditorPermissions;
}) {
  const { t } = useTranslation("components");
  const { recipe, upsertVariable, getVariable } = useRecipe();
  const variable = getVariable(variableId);

  const treeItems = useRoadmapTreeItems(availableDataSeries);
  const handleDataSeriesChange = useHandleDataSeriesChange(variableId, upsertVariable);

  const permissions = { ...RecipeEditorPermissions, ...incomingPermissions };

  if (!variable) {
    console.error(`Variable "${variableId}" not found in recipe`, recipe);
    return null;
  }

  if (!isDataSeriesVariable(variable)) {
    console.error(`Variable "${variableId}" is not a valid DataSeriesVariable`, variable);
    return null;
  }

  const defaultTreeValue = variable.dataSeriesId
    ? {
      name: variable.dataSeriesId,
      value: variable.dataSeriesId,
      expanded: null,
    }
    : undefined;

  return (
    <SelectSingleTreeSearch
      props={{
        id: "recipeVariable" + variableId,
        name: "recipeVariable" + variableId,
        placeholder: t("components:recipe_editor.select_data_series"),
        required: true,
        disabled: !permissions.allowValueEditing,
      }}
      defaultValue={defaultTreeValue}
      treeItems={treeItems}
      onChange={handleDataSeriesChange}
    />
  );
}