"use client";

import { RecipeError } from "@/functions/recipe/types/errors";
import { isDataSeriesVariable } from "@/functions/recipe/types/typeguards";
import { useTranslation } from "react-i18next";
import React, { useCallback, useMemo } from "react";
import type { RecipeContextType, TreeItem } from "@/components/types";
import SelectSingleTree from "@/components/form/elements/combobox/selectSingleTree";
import { clientSafeGetOneRoadmapIteration } from "@/fetchers/client";
import { CommonVariable, useRecipe, VectorPickerSelect } from "@/components/recipe";
import type { ClientRoadmapIteration } from "@/types";
import { RecipeEditorPermissions } from "@/types/consts";

type AvailableRoadmapOption = { id: string; name: string; };

function useRoadmapTreeItems(
  availableRoadmaps: AvailableRoadmapOption[],
  roadmapLookup: Record<string, ClientRoadmapIteration>,
) {
  const { t } = useTranslation("components");

  return useMemo(() => {
    return availableRoadmaps.map((roadmap): TreeItem => ({
      expanded: false,
      name: roadmap.name,
      value: `roadmap:${roadmap.id}`,
      onExpand: async () => {
        const data = roadmapLookup[roadmap.id] ?? await clientSafeGetOneRoadmapIteration(roadmap.id);
        if (!data) return [];

        return data.goals.map((goal): TreeItem => {
          const goalDisplayName = goal.name || goal.indicator_parameter;
          const goalChildren: TreeItem[] = [];

          if (goal.data_series) {
            goalChildren.push({
              name: goalDisplayName,
              value: goal.data_series.id,
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
            if (!effect.data_series) continue;
            goalChildren.push({
              name: `${goalDisplayName} - ${t("common:effect_one")}`,
              value: effect.data_series.id,
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
  }, [availableRoadmaps, roadmapLookup, t]);
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
  dataSeriesNamesById = {},
  roadmapLookup = {},
}: {
  variableId: string;
  permissions?: RecipeEditorPermissions;
  availableDataSeries?: AvailableDataSeries;
  dataSeriesNamesById?: Record<string, string>;
  roadmapLookup?: Record<string, ClientRoadmapIteration>;
}) {
  const { t } = useTranslation("components");
  const { recipe, upsertVariable, getVariable } = useRecipe();
  const variable = getVariable(variableId);
  const fieldIdBase = `recipe-data-series-${variableId.replace(/[^A-Za-z0-9_-]/g, "-")}`;

  const treeItems = useRoadmapTreeItems(availableDataSeries, roadmapLookup);
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
      name: dataSeriesNamesById[variable.dataSeriesId] || variable.dataSeriesId,
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
        <SelectSingleTree
          key={`recipeVariable-${fieldIdBase}`}
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
  dataSeriesNamesById = {},
  roadmapLookup = {},
}: {
  variableId: string;
  availableDataSeries?: AvailableRoadmapOption[];
  permissions?: RecipeEditorPermissions;
  dataSeriesNamesById?: Record<string, string>;
  roadmapLookup?: Record<string, ClientRoadmapIteration>;
}) {
  const { t } = useTranslation("components");
  const { recipe, upsertVariable, getVariable } = useRecipe();
  const variable = getVariable(variableId);

  const treeItems = useRoadmapTreeItems(availableDataSeries, roadmapLookup);
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
      name: dataSeriesNamesById[variable.dataSeriesId] || variable.dataSeriesId,
      value: variable.dataSeriesId,
      expanded: null,
    }
    : undefined;
    
  return (
    <SelectSingleTree
      key={`recipeVariable-${variableId}`}
      props={{
        id: `recipeVariable-${variableId}`,
        name: `recipeVariable-${variableId}`,
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