"use client";

import { lenientIsRawDataSeriesByLink, RawDataSeriesByLink, RawRecipe, RawRecipeVariables, RecipeVariableExternalDataset, RecipeVariableScalar, RecipeVariableType, RecipeVariableTypeMap } from "@/functions/recipe-parser/types";
import { IconTrash } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import React from "react";
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
  const variable = recipe?.variables[name] as RawRecipeVariables;

  rules = { ...defaultInputRules, ...rules };

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    setRecipe(prev => {
      if (!prev) return null;
      const newVariables: Record<string, RawRecipeVariables> = { ...prev.variables };
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
      const newVariables: Record<string, RawRecipeVariables> = { ...prev.variables };
      const currentVar = newVariables[name];
      if (currentVar && e.target.value && RecipeVariableTypeMap[e.target.value]) {
        newVariables[name] = { ...currentVar, type: RecipeVariableTypeMap[e.target.value] } as RawRecipeVariables;
      }
      return { ...prev, variables: newVariables };
    });
  }

  function handleDelete() {
    setRecipe(prev => {
      if (!prev) return null;
      const newVariables: Record<string, RawRecipeVariables> = { ...prev.variables };
      delete newVariables[name];
      return { ...prev, variables: newVariables };
    });
  }

  return <li style={{
    display: 'flex',
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
      <option value={RecipeVariableType.DataSeries}>{t("components:recipe_editor.data_series")}</option>
      <option value={RecipeVariableType.External}>{t("components:recipe_editor.external_data")}</option>
      <option value={RecipeVariableType.Scalar}>{t("components:recipe_editor.scalar")}</option>
    </select>

    {/* Variable specific inputs */}
    <div style={{ flex: 1, display: 'flex', flexFlow: 'row nowrap', columnGap: 'inherit' }}>
      {children}
    </div>

    {/* Unit */}
    <input defaultValue={variable.type === RecipeVariableType.DataSeries && lenientIsRawDataSeriesByLink(variable) && variable.dataSeries?.unit || ""} type="text" placeholder={t("components:recipe_editor.unit_placeholder")} style={{ width: '10ch' }} />

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
  const variable = recipe?.variables[name] as RecipeVariableScalar;

  rules = { ...defaultInputRules, ...rules };

  function handleValueChange(e: React.ChangeEvent<HTMLInputElement>) {
    setRecipe(prev => {
      if (!prev) return null;
      const currentVar = prev.variables[name];
      const newVariables: Record<string, RawRecipeVariables> = { ...prev.variables };

      if (currentVar.type === RecipeVariableType.Scalar && e.target.value) {
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
}: {
  name: string;
  rules?: InputRules;
  availableRoadmaps?: { id: string; name: string; }[];
  availableDataSeries?: { id: string; name: string; roadmapId: string; unit?: string; }[];
}) {
  const { t } = useTranslation("components");
  const { recipe, setRecipe } = useRecipe();
  const variable = recipe?.variables[name] as RawRecipeVariables;

  if (!lenientIsRawDataSeriesByLink(variable)) {
    console.error(`Variable "${name}" is not a valid DataSeriesVariable`, variable);
    return null;
  }

  rules = { ...defaultInputRules, ...rules };

  function handleRoadmapChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setRecipe(prev => {
      if (!prev) return null;
      const newVariables: Record<string, RawRecipeVariables> = { ...prev.variables };
      const currentVar = newVariables[name];
      if (currentVar && e.target.value) {
        const selectedRoadmap = availableRoadmaps.find(r => r.id === e.target.value);
        if (selectedRoadmap) {
          newVariables[name] = {
            ...currentVar,
            roadmap: { name: selectedRoadmap.name, id: selectedRoadmap.id },
          } as RawDataSeriesByLink;
        }
      }
      return { ...prev, variables: newVariables };
    });
  }

  function handleDataSeriesChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setRecipe(prev => {
      if (!prev) return null;
      const newVariables: Record<string, RawRecipeVariables> = { ...prev.variables };
      const currentVar = newVariables[name];
      if (currentVar && e.target.value) {
        const selectedDataSeries = availableDataSeries.find(ds => ds.id === e.target.value);
        if (selectedDataSeries) {
          newVariables[name] = {
            ...currentVar,
            dataSeries: { name: selectedDataSeries.name, id: selectedDataSeries.id, roadmapId: selectedDataSeries.roadmapId },
            link: selectedDataSeries.id,
          } as RawDataSeriesByLink;
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
      value={variable.roadmap?.id || ""}
      onChange={handleRoadmapChange}
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
      value={variable.link || variable.dataSeries?.id || ""}
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
  const variable = recipe?.variables[name] as RecipeVariableExternalDataset;

  rules = { ...defaultInputRules, ...rules };

  return <CommonVariable
    name={name}
    rules={rules}
  >
    {/* Dataset */}
    <select disabled={!rules.allowValueEditing}>
      <option value="">{t("components:recipe_editor.dataset")}</option>
    </select>

    {/* Table */}
    <select disabled={!rules.allowValueEditing}>
      <option value="">{t("components:recipe_editor.table")}</option>
    </select>

    {/* Selection */}
    <input type="text" placeholder={t("components:recipe_editor.selection")} disabled={!rules.allowValueEditing} />

    {/* Pick */}
    <VectorIndexPicker />
  </CommonVariable>;
}

export enum VectorIndexPickerType {
  Whole = "whole",
  Last = "last",
  First = "first",
  Median = "median",
  Mean = "mean",
}

function VectorIndexPicker() {
  const { t } = useTranslation("components");

  return <select>
    <option value={VectorIndexPickerType.Whole}>{t("components:recipe_editor.pick_whole")}</option>
    <option value={VectorIndexPickerType.Last}>{t("components:recipe_editor.pick_last")}</option>
    <option value={VectorIndexPickerType.First}>{t("components:recipe_editor.pick_first")}</option>
    <option value={VectorIndexPickerType.Median}>{t("components:recipe_editor.pick_median")}</option>
    <option value={VectorIndexPickerType.Mean}>{t("components:recipe_editor.pick_mean")}</option>
  </select>;
}