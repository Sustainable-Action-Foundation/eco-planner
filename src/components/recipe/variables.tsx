import { RawDataSeriesByLink, RawRecipe, RawRecipeVariables, RecipeVariableExternalDataset, RecipeVariableScalar, RecipeVariableType } from "@/functions/recipe-parser/types";
import { IconTrash } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import React from "react";

type CommonVariableProps = {
  children?: React.ReactNode;
  name: string;
  variable: RawRecipeVariables;
  allowNameEditing?: boolean;
  allowTypeEditing?: boolean;
  allowDeleteVariables?: boolean;
  setRecipe: React.Dispatch<React.SetStateAction<RawRecipe | null>>;
};

function CommonVariable({
  children,
  name,
  variable,
  allowNameEditing = false,
  allowTypeEditing = false,
  allowDeleteVariables = false,
  setRecipe,
}: CommonVariableProps) {
  const { t } = useTranslation("components");

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setRecipe(prev => {
      if (!prev) return null;
      const newVariables = Object.fromEntries(
        Object.entries(prev.variables).map(([key, value]) => {
          if (key === name) {
            return [newName, value];
          }
          return [key, value];
        })
      );
      return { ...prev, variables: newVariables };
    });
  };

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = e.target.value as RecipeVariableType;
    setRecipe(prev => {
      if (!prev) return null;
      const newVariables: Record<string, RawRecipeVariables> = { ...prev.variables };

      if (newType === RecipeVariableType.Scalar) {
        newVariables[name] = {
          type: RecipeVariableType.Scalar,
          value: 1
        };
      } else if (newType === RecipeVariableType.DataSeries) {
        newVariables[name] = {
          type: RecipeVariableType.DataSeries,
          link: null,
        };
      } else if (newType === RecipeVariableType.External) {
        newVariables[name] = {
          type: RecipeVariableType.External,
          dataset: "SCB",
          tableId: "",
          selection: [],
        };
      }
      return {
        ...prev,
        variables: newVariables
      };
    });
  };

  const handleDelete = () => {
    setRecipe(prev => {
      if (!prev) return null;
      const newVars = { ...prev.variables };
      delete newVars[name];
      return {
        ...prev,
        variables: newVars
      }
    });
  };

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
      readOnly={!allowNameEditing}
      disabled={!allowNameEditing}
      onChange={handleNameChange}
    />

    {/* Data type */}
    <select
      value={variable.type}
      onChange={handleTypeChange}
      disabled={!allowTypeEditing}
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
    <input type="text" placeholder={t("components:recipe_editor.unit_placeholder")} style={{ width: '10ch' }} />

    {/* Delete */}
    {allowDeleteVariables &&
      <button type="button" style={{
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

type ScalarVariableProps = {
  name: string;
  variable: RecipeVariableScalar;
  allowValueEditing?: boolean;
  setRecipe: React.Dispatch<React.SetStateAction<RawRecipe | null>>;
  allowNameEditing?: boolean;
  allowTypeEditing?: boolean;
  allowDeleteVariables?: boolean;
};

export function ScalarVariable({ name, variable, allowValueEditing, setRecipe, allowDeleteVariables, allowNameEditing, allowTypeEditing }: ScalarVariableProps) {
  const { t } = useTranslation("components");

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRecipe(prev => {
      if (!prev) return null;
      const currentVar = prev.variables[name];
      const newVariables: Record<string, RawRecipeVariables> = { ...prev.variables };

      if (currentVar.type === RecipeVariableType.Scalar) {
        const newValue = parseFloat(e.target.value);
        if (!isNaN(newValue)) {
          newVariables[name] = { ...currentVar, value: newValue };
        } else if (e.target.value === "") {
          newVariables[name] = { ...currentVar, value: 0 };
        }
      }
      return { ...prev, variables: newVariables };
    });
  };

  return <CommonVariable
    name={name}
    variable={variable}
    setRecipe={setRecipe}
    allowDeleteVariables={allowDeleteVariables}
    allowNameEditing={allowNameEditing}
    allowTypeEditing={allowTypeEditing}
  >
    <input
      type="number"
      placeholder={t("components:recipe_editor.scalar")}
      value={variable.value}
      onChange={handleValueChange}
      disabled={!allowValueEditing}
      readOnly={!allowValueEditing}
    />
  </CommonVariable>;
}

type DataSeriesVariableProps = {
  name: string;
  variable: RawDataSeriesByLink;
  allowValueEditing?: boolean;
  setRecipe: React.Dispatch<React.SetStateAction<RawRecipe | null>>;
  selectableRoadmaps: { id: string; name: string; }[] | null;
  selectableDataSeries: { id: string; name: string; roadmapId: string; }[] | null;
  roadmap: { id: string; name: string; } | null;
  setRoadmap: React.Dispatch<React.SetStateAction<{ id: string; name: string; } | null>>;
  allowNameEditing?: boolean;
  allowTypeEditing?: boolean;
  allowDeleteVariables?: boolean;
};

export function DataSeriesVariable({
  name,
  variable,
  allowValueEditing,
  setRecipe,
  selectableRoadmaps,
  selectableDataSeries,
  roadmap,
  setRoadmap,
  allowDeleteVariables,
  allowNameEditing,
  allowTypeEditing
}: DataSeriesVariableProps) {
  const { t } = useTranslation("components");

  const handleRoadmapChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedRoadmap = selectableRoadmaps?.find(r => r.id === e.target.value) || null;
    setRoadmap(selectedRoadmap);
  };

  const handleDataSeriesChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedDataSeries = selectableDataSeries?.find(ds => ds.id === e.target.value) || null;
    setRecipe(prev => {
      if (!prev) return null;
      const newVariables: Record<string, RawRecipeVariables> = { ...prev.variables };
      newVariables[name] = {
        ...newVariables[name],
        link: selectedDataSeries ? selectedDataSeries.id : null,
      } as RawDataSeriesByLink;
      return { ...prev, variables: newVariables };
    });
  };

  return <CommonVariable
    name={name}
    variable={variable}
    setRecipe={setRecipe}
    allowDeleteVariables={allowDeleteVariables}
    allowNameEditing={allowNameEditing}
    allowTypeEditing={allowTypeEditing}
  >
    {/* Roadmap */}
    <select
      value={roadmap?.id || "none"}
      onChange={handleRoadmapChange}
      disabled={!allowValueEditing}
    >
      <option value={"none"}>{t("common:recipe_editor.select_roadmap")}</option>
      {selectableRoadmaps?.map(r => (
        <option key={r.id} value={r.id}>
          {r.name}
        </option>
      ))}
    </select>

    {/* Goal or effect */}
    {roadmap && selectableDataSeries && (
      <select
        value={variable.link || "none"}
        onChange={handleDataSeriesChange}
        disabled={!allowValueEditing}
      >
        <option value="none">{t("components:recipe_editor.goal_or_effect")}</option>
        {selectableDataSeries.map(ds => (
          <option key={ds.id} value={ds.id}>
            {ds.name}
          </option>
        ))}
      </select>
    )}

    {/* Pick */}
    <VectorIndexPicker />
  </CommonVariable>;
}

type ExternalVariableProps = {
  name: string;
  variable: RecipeVariableExternalDataset;
  allowValueEditing?: boolean;
  setRecipe: React.Dispatch<React.SetStateAction<RawRecipe | null>>;
  allowNameEditing?: boolean;
  allowTypeEditing?: boolean;
  allowDeleteVariables?: boolean;
};

export function ExternalVariable({ name, variable, allowValueEditing, setRecipe, allowDeleteVariables, allowNameEditing, allowTypeEditing }: ExternalVariableProps) {
  const { t } = useTranslation("components");

  return <CommonVariable
    name={name}
    variable={variable}
    setRecipe={setRecipe}
    allowDeleteVariables={allowDeleteVariables}
    allowNameEditing={allowNameEditing}
    allowTypeEditing={allowTypeEditing}
  >
    {/* Dataset */}
    <select disabled={!allowValueEditing}>
      <option value="">{t("components:recipe_editor.dataset")}</option>
    </select>

    {/* Table */}
    <select disabled={!allowValueEditing}>
      <option value="">{t("components:recipe_editor.table")}</option>
    </select>

    {/* Selection */}
    <input type="text" placeholder={t("components:recipe_editor.selection")} disabled={!allowValueEditing} />

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