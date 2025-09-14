"use client";

// TODO: I18n
// TODO: Replace roadmap/goal select with treeselect
// TODO: Fix labels

import { RecipeVariables, RecipeDataTypes, isRecipeDataSeries, RecipeDataSeries, RecipeScalar, RecipeExternalDataset, isRecipeExternalDatasetSelection, emptyRecipeDataTypes, VectorIndexPickerOptions } from "@/functions/recipe-parser/types";
import { IconTrashXFilled } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import React from "react";
import { useRecipe } from "./contextProvider";
import { ExternalDataset } from "@/lib/api/utility";
import { JSONValue } from "@/types";

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

      const newName = e.target.value.trim();
      if (!newName) {
        console.warn("Variable name cannot be empty");
        return prev; // Do not update if name is empty
      }

      const copyOfVariables: Record<string, RecipeVariables> = { ...prev.variables };

      const variableContent = copyOfVariables[name];
      if (!variableContent) {
        console.warn(`Variable '${name}' does not exist in the recipe`);
        return prev; // Do not update if variable does not exist
      }

      // Copy the variable content to the new name
      copyOfVariables[newName] = { ...variableContent };
      // Remove the old variable name
      delete copyOfVariables[name];

      return { ...prev, variables: copyOfVariables };
    });
  }

  function handleTypeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setRecipe(prev => {
      if (!prev) return null;

      const copyOfVariables = { ...prev.variables };

      const currentVar = copyOfVariables[name];
      if (!currentVar) {
        console.warn(`Variable '${name}' does not exist in the recipe`);
        return prev; // Do not update if variable does not exist
      }

      const newType = e.target.value;
      if (!newType || !Object.values(RecipeDataTypes).includes(newType as RecipeDataTypes)) {
        console.warn(`Data type '${newType}' is not a valid RecipeDataType`);
        return prev; // Do not update if the type is invalid
      }

      const newVar = { ...emptyRecipeDataTypes[newType as RecipeDataTypes] };
      if (!newVar || !newVar.type || Object.keys(newVar).length === 0) {
        console.warn(`No empty variable defined for data type '${newType}'`);
        return prev; // Do not update if no empty variable is defined
      }

      // Replace old variable with new one and remove its data. TODO: keep as much data as possible
      copyOfVariables[name] = newVar as RecipeVariables;

      return { ...prev, variables: copyOfVariables };
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

  return (
    <li className="margin-block-25 flex align-items-center">
      <input
        defaultValue={name}
        onChange={handleNameChange}
        type="text"
        placeholder={t("components:recipe_editor.variable_name_placeholder")}
        readOnly={!rules.allowNameEditing}
        disabled={!rules.allowNameEditing}
      />
      <select
        defaultValue={variable.type}
        onChange={handleTypeChange}
        disabled={!rules.allowTypeEditing}
      >
        <option value={RecipeDataTypes.DataSeries}>{t("components:recipe_editor.data_series")}</option>
        <option value={RecipeDataTypes.External}>{t("components:recipe_editor.external_data")}</option>
        <option value={RecipeDataTypes.Scalar}>{t("components:recipe_editor.scalar")}</option>
      </select>
      <input
        defaultValue={variable.unit || ""}
        onChange={handleUnitChange}
        type="text"
        disabled={!rules.allowValueEditing}
        readOnly={!rules.allowValueEditing}
        placeholder={t("components:recipe_editor.unit_placeholder")}
      />
      {children}
      {rules.allowDeleteVariables &&
        <button
          className="padding-25 round transparent margin-left-50"
          style={{ verticalAlign: 'middle' }}
          type="button"
          onClick={handleDelete}
        >
          <IconTrashXFilled width={20} height={20} className="grid" />
        </button>
      }
    </li>
  )
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

  return (
    <CommonVariable
      name={name}
      rules={rules}
    >
      <input
        defaultValue={variable.value}
        onChange={handleValueChange}
        type="number"
        placeholder={t("components:recipe_editor.scalar")}
        disabled={!rules.allowValueEditing}
        readOnly={!rules.allowValueEditing}
      />
    </CommonVariable>
  )
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

      const selectedDataSeriesId = e.target.value;
      if (!selectedDataSeriesId) {
        console.warn("No data series selected");
        return prev; // Do not update if no data series is selected
      }

      if (availableDataSeries.every(ds => ds.id !== selectedDataSeriesId)) {
        console.warn(`Data series with ID '${selectedDataSeriesId}' not found in available data series`);
        return prev; // Do not update if the selected data series is not available
      }

      const newVariables: Record<string, RecipeVariables> = { ...prev.variables };
      const currentVar = newVariables[name];
      if (!currentVar) {
        console.warn(`Variable '${name}' does not exist in the recipe`);
        return prev; // Do not update if variable does not exist
      }

      newVariables[name] = {
        ...currentVar,
        link: selectedDataSeriesId,
      } as RecipeDataSeries;

      return { ...prev, variables: newVariables };
    });
  }

  return (
    <CommonVariable
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
        onChange={handleDataSeriesChange}
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
      <VectorIndexPicker />

    </CommonVariable >
  )
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

  function handleTableChange(e: React.ChangeEvent<HTMLInputElement>) {
    setRecipe(prev => {
      if (!prev) return null;
      const newVariables: Record<string, RecipeVariables> = { ...prev.variables };
      const currentVar = newVariables[name];
      if (currentVar && typeof e.target.value === "string" && e.target.value && e.target.value.trim()) {
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
          const selection = JSON.parse(e.target.value) as JSONValue;
          if (!isRecipeExternalDatasetSelection(selection)) {
            console.warn("Invalid selection format", selection);
            return prev; // Do not update if selection is invalid
          }
          newVariables[name] = {
            ...currentVar,
            selection: selection,
          } as RecipeExternalDataset;
        }
        catch (error) {
          console.warn("Failed to parse selection JSON", error);
        }
      }
      return { ...prev, variables: newVariables };
    });
  }

  return (
    <CommonVariable
      name={name}
      rules={rules}
    >
      <select
        defaultValue={variable.dataset || ""}
        disabled={!rules.allowValueEditing}
        onChange={handleDatasetChange}
      >
        <option value="">{t("components:recipe_editor.dataset")}</option>
        {/* <option value={variable.dataset}>{variable.dataset}</option> */}
        {ExternalDataset.knownDatasetKeys.map((datasetName, i) => (
          <option key={`datasetOption-${i}`} value={datasetName}>
            {datasetName}
          </option>
        ))}
      </select>

      <input
        defaultValue={variable.tableId || ""}
        onChange={handleTableChange}
        type="text"
        disabled={!rules.allowValueEditing}
        placeholder={t("components:recipe_editor.table")}
      />

      <input
        defaultValue={JSON.stringify(variable.selection) || ""}
        onChange={handleSelectionChange}
        type="text"
        disabled={!rules.allowValueEditing}
        style={{ width: '50ch' }}
        placeholder={t("components:recipe_editor.selection")}
      />

      <VectorIndexPicker rules={rules} />
    </CommonVariable>
  )
}


function VectorIndexPicker({ rules }: { rules?: InputRules }) {
  const { t } = useTranslation("components");

  rules = { ...defaultInputRules, ...rules };

  return <select
    defaultValue={VectorIndexPickerOptions.Default}
    disabled={!rules.allowValueEditing}
  >
    <option value={VectorIndexPickerOptions.Whole}>{t("components:recipe_editor.pick_whole")}</option>
    <option value={VectorIndexPickerOptions.Last}>{t("components:recipe_editor.pick_last")}</option>
    <option value={VectorIndexPickerOptions.First}>{t("components:recipe_editor.pick_first")}</option>
    <option value={VectorIndexPickerOptions.Median}>{t("components:recipe_editor.pick_median")}</option>
    <option value={VectorIndexPickerOptions.Mean}>{t("components:recipe_editor.pick_mean")}</option>
  </select>;
}