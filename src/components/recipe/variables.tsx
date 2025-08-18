"use client";

import { RecipeVariables, RecipeDataTypes, isRecipeDataSeries, RecipeDataSeries, RecipeScalar, RecipeExternalDataset } from "@/functions/recipe-parser/types";
import { IconTrash } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import React, { useEffect } from "react";
import { useRecipe } from "./recipeEditor";

type InputRules = {
  allowNameEditing?: boolean;
  allowTypeEditing?: boolean;
  allowValueEditing?: boolean;
  allowDeleteVariables?: boolean;
};
const defaultInputRules: InputRules = {
  allowNameEditing: true,
  allowTypeEditing: true,
  allowValueEditing: true,
  allowDeleteVariables: true,
};


function CommonVariable({
  name,
  rules,
  children,
}: {
  name: string;
  rules?: InputRules;
  children: React.ReactNode;
}) {
  const { t } = useTranslation("components");
  const { recipe, setRecipe } = useRecipe();
  const variable = recipe?.variables[name] as RecipeVariables;

  rules = { ...defaultInputRules, ...rules };

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    setRecipe(prev => {
      if (!prev) return null;
      const newVariables: Record<string, RecipeVariables> = { ...prev.variables };
      const currentVar = newVariables[name];
      if (currentVar) {
        newVariables[e.target.value] = { ...currentVar };
        delete newVariables[name];
      }
      return { ...prev, variables: newVariables };
    });
  }

  function handleTypeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setRecipe(prev => {
      if (!prev) return null;
      const newVariables: Record<string, RecipeVariables> = { ...prev.variables };
      const currentVar = newVariables[name];
      if (currentVar && e.target.value && RecipeDataTypes[e.target.value as keyof typeof RecipeDataTypes]) {
        newVariables[name] = { ...currentVar, type: RecipeDataTypes[e.target.value as keyof typeof RecipeDataTypes] } as RecipeVariables;
      }
      return { ...prev, variables: newVariables };
    });
  }

  function handleUnitChange(e: React.ChangeEvent<HTMLInputElement>) {
    setRecipe(prev => {
      if (!prev) return null;
      const newVariables: Record<string, RecipeVariables> = { ...prev.variables };
      const currentVar = newVariables[name];
      if (currentVar && e.target.value) {
        if (currentVar.type === RecipeDataTypes.DataSeries && isRecipeDataSeries(currentVar)) {
          newVariables[name] = { ...currentVar, unit: e.target.value } as RecipeDataSeries;
        }
      }
      return { ...prev, variables: newVariables };
    });
  }

  function handleDelete() {
    setRecipe(prev => {
      if (!prev) return null;
      const newVariables: Record<string, RecipeVariables> = { ...prev.variables };
      delete newVariables[name];
      return { ...prev, variables: newVariables };
    });
  }

  return <li style={{
    display: 'flex',
    flexFlow: 'row nowrap',
    columnGap: '1ch',
  }}>
    {/* Variable name */}
    <input
      type="text"
      placeholder={t("components:recipe_editor.variable_name_placeholder")}
      style={{ width: '17ch' }}
      value={name}
      readOnly={!rules.allowNameEditing}
      disabled={!rules.allowNameEditing}
      onChange={handleNameChange}
    />

    {/* Data type */}
    <select
      value={variable.type}
      onChange={handleTypeChange}
      disabled={!rules.allowTypeEditing}
    >
      <option value={RecipeDataTypes.DataSeries}>{t("components:recipe_editor.data_series")}</option>
      <option value={RecipeDataTypes.External}>{t("components:recipe_editor.external_data")}</option>
      <option value={RecipeDataTypes.Scalar}>{t("components:recipe_editor.scalar")}</option>
    </select>

    {/* Variable specific inputs */}
    <div style={{ flex: 1, display: 'flex', flexFlow: 'row nowrap', columnGap: 'inherit' }}>
      {children}
    </div>

    {/* Unit */}
    <input
      type="text"
      style={{ width: '10ch' }}
      value={variable.unit || ""}
      onChange={handleUnitChange}
      disabled={!rules.allowValueEditing}
      readOnly={!rules.allowValueEditing}
      placeholder={t("components:recipe_editor.unit_placeholder")}
    />

    {/* Delete */}
    {rules.allowDeleteVariables &&
      <button
        type="button"
        style={{
          width: '5ch',
          backgroundColor: 'red',
          color: 'white',
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onClick={handleDelete}
      >
        <IconTrash />
      </button>
    }
  </li>;
}


export function ScalarVariable({
  name,
  rules,
}: {
  name: string;
  rules?: InputRules;
}) {
  const { t } = useTranslation("components");
  const { recipe, setRecipe } = useRecipe();
  const variable = recipe?.variables[name] as RecipeScalar;

  rules = { ...defaultInputRules, ...rules };

  function handleValueChange(e: React.ChangeEvent<HTMLInputElement>) {
    setRecipe(prev => {
      if (!prev) return null;
      const currentVar = prev.variables[name];
      const newVariables: Record<string, RecipeVariables> = { ...prev.variables };

      if (currentVar.type === RecipeDataTypes.Scalar && e.target.value) {
        const newValue = parseFloat(e.target.value);
        if (!isNaN(newValue)) {
          newVariables[name] = { ...currentVar, value: newValue };
        }
      }
      return { ...prev, variables: newVariables };
    });
  }

  return <CommonVariable
    name={name}
    rules={rules}
  >
    <input
      type="number"
      placeholder={t("components:recipe_editor.scalar")}
      value={variable.value}
      onChange={handleValueChange}
      disabled={!rules.allowValueEditing}
      readOnly={!rules.allowValueEditing}
    />
  </CommonVariable>;
}


export function DataSeriesVariable({
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

  function handleDataSeriesChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setRecipe(prev => {
      if (!prev) return null;
      const newVariables: Record<string, RecipeVariables> = { ...prev.variables };
      const currentVar = newVariables[name];
      if (currentVar && e.target.value) {
        const selectedDataSeries = availableDataSeries.find(ds => ds.id === e.target.value);
        if (selectedDataSeries) {
          newVariables[name] = {
            ...currentVar,
            link: selectedDataSeries.id,
          } as RecipeDataSeries;
        }
      }
      return { ...prev, variables: newVariables };
    });
  }

  return <CommonVariable
    name={name}
    rules={rules}
  >
    {/* Roadmap */}
    <select
      value={selectedRoadmap || ""}
      onChange={(e) => {
        setLocalRoadmap(e.target.value || null);
        setSelectedRoadmaps(prev => [...new Set([...prev, e.target.value].filter(Boolean))]);
      }}
      disabled={!rules.allowValueEditing}
    >
      <option value={""}>{t("components:recipe_editor.select_roadmap")}</option>
      {availableRoadmaps.map((r, i) => (
        <option key={`roadmapOption-${i}`} value={r.id}>
          {r.name}
        </option>
      ))}
    </select>

    {/* Goal (data series) */}
    <select
      value={variable.link || ""}
      onChange={handleDataSeriesChange}
      disabled={!rules.allowValueEditing}
    >
      <option value="">{t("components:recipe_editor.goal_or_effect")}</option>
      {availableDataSeries
        .map(ds => ({ ...ds, displayName: ds.unit ? `(${ds.unit}) ${ds.name}` : ds.name }))
        .sort((a, b) => a.displayName.localeCompare(b.displayName))
        .map((ds, i) => (
          <option key={`dataSeriesOption-${i}`} value={ds.id}>
            {ds.displayName}
          </option>
        ))}
    </select>

    {/* Pick */}
    <VectorIndexPicker />
  </CommonVariable>;
}


export function ExternalVariable({
  name,
  rules,
}: {
  name: string;
  rules?: InputRules;
}) {
  const { t } = useTranslation("components");
  const { recipe, setRecipe } = useRecipe();
  const variable = recipe?.variables[name] as RecipeExternalDataset;

  rules = { ...defaultInputRules, ...rules };

  function handleDatasetChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setRecipe(prev => {
      if (!prev) return null;
      const newVariables: Record<string, RecipeVariables> = { ...prev.variables };
      const currentVar = newVariables[name];
      if (currentVar && e.target.value) {
        newVariables[name] = {
          ...currentVar,
          dataset: e.target.value,
        } as RecipeExternalDataset;
      }
      return { ...prev, variables: newVariables };
    });
  }

  function handleTableChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setRecipe(prev => {
      if (!prev) return null;
      const newVariables: Record<string, RecipeVariables> = { ...prev.variables };
      const currentVar = newVariables[name];
      if (currentVar && e.target.value) {
        newVariables[name] = {
          ...currentVar,
          tableId: e.target.value,
        } as RecipeExternalDataset;
      }
      return { ...prev, variables: newVariables };
    });
  }

  function handleSelectionChange(e: React.ChangeEvent<HTMLInputElement>) {
    setRecipe(prev => {
      if (!prev) return null;
      const newVariables: Record<string, RecipeVariables> = { ...prev.variables };
      const currentVar = newVariables[name];
      if (currentVar && e.target.value) {
        try {
          const selection = JSON.parse(e.target.value);
          if (Array.isArray(selection)) {
            newVariables[name] = {
              ...currentVar,
              selection: selection,
            } as RecipeExternalDataset;
          } else {
            console.error("Invalid selection format, expected an array", selection);
          }
        } catch (error) {
          console.error("Failed to parse selection JSON", error);
        }
      }
      return { ...prev, variables: newVariables };
    });
  }

  return <CommonVariable
    name={name}
    rules={rules}
  >
    {/* Dataset */}
    <select
      value={variable.dataset || ""}
      disabled={!rules.allowValueEditing}
      onChange={handleDatasetChange}
    >
      <option value="">{t("components:recipe_editor.dataset")}</option>
      <option value={variable.dataset}>{variable.dataset}</option>
    </select>

    {/* Table */}
    <select
      value={variable.tableId || ""}
      disabled={!rules.allowValueEditing}
      onChange={handleTableChange}
    >
      <option value="">{t("components:recipe_editor.table")}</option>
      <option value={variable.tableId}>{variable.tableId}</option>
    </select>

    {/* Selection */}
    <input
      type="text"
      value={JSON.stringify(variable.selection) || ""}
      disabled={!rules.allowValueEditing}
      style={{ width: '50ch' }}
      placeholder={t("components:recipe_editor.selection")}
      onChange={handleSelectionChange}
    />

    {/* Pick */}
    <VectorIndexPicker rules={rules} />
  </CommonVariable>;
}


export enum VectorIndexPickerType {
  Whole = "whole",
  Last = "last",
  First = "first",
  Median = "median",
  Mean = "mean",
  Default = Whole,
}

function VectorIndexPicker({ rules }: { rules?: InputRules }) {
  const { t } = useTranslation("components");

  rules = { ...defaultInputRules, ...rules };

  return <select
    disabled={!rules.allowValueEditing}
  >
    <option value={VectorIndexPickerType.Whole}>{t("components:recipe_editor.pick_whole")}</option>
    <option value={VectorIndexPickerType.Last}>{t("components:recipe_editor.pick_last")}</option>
    <option value={VectorIndexPickerType.First}>{t("components:recipe_editor.pick_first")}</option>
    <option value={VectorIndexPickerType.Median}>{t("components:recipe_editor.pick_median")}</option>
    <option value={VectorIndexPickerType.Mean}>{t("components:recipe_editor.pick_mean")}</option>
  </select>;
}