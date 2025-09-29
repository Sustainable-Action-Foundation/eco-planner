"use client";

// TODO: I18n
// TODO: Replace roadmap/goal select with treeselect
// TODO: Fix labels

import { RecipeVariables, RecipeDataTypes, isRecipeDataSeries, RecipeScalar, RecipeExternalDataset, VectorIndexPickerOptions } from "@/functions/recipe-parser/types";
import { IconEdit, IconTrashXFilled } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import React, { useEffect, useState } from "react";
import { useRecipe } from "../../contextProvider";
import { ExternalDataset } from "@/lib/api/utility";
import SelectSingleTreeSearch from "../../../form/elements/combobox/selectSingleTreeSearch";
import { treeItem } from "../../../types";
import clientSafeGetOneRoadmap from "@/fetchers/clientSafeGetOneRoadmap";
import clientSafeGetRoadmaps from "@/fetchers/clientSafeGetRoadmaps";
import styles from '../editor.module.css' with {type: 'css'}
import { changeDataSeries, changeDataset, changeExternalSelection, changeName, changeScalarValue, changeTable, changeType, changeUnit, deleteVariable } from "../../contextFunctions";

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


// TODO: Pass the value of this as a prop?
// TODO: Must also include effects
const generateTreeItems = async (): Promise<Array<treeItem>> => {
  const roadmaps = await clientSafeGetRoadmaps();
  const treeItems: Array<treeItem> = roadmaps
    .filter((roadmap) => roadmap._count.goals > 0)
    .map((roadmap) => ({
      name: roadmap.metaRoadmap.name,
      value: roadmap.id,
      expanded: false,
      onExpand: async (): Promise<Array<treeItem>> => {
        const fullRoadmap = await clientSafeGetOneRoadmap(roadmap.id);
        if (!fullRoadmap) return [];
        return fullRoadmap.goals.map((goal) => ({
          name: goal.name ?? goal.indicatorParameter,
          value: goal.id,
          expanded: null
        }))
      }
    }));
  return treeItems
}

// const roadmapTreeStructure = await generateTreeItems()

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
  const [editable, setEditable] = useState<boolean>(true)

  rules = { ...defaultInputRules, ...rules };

  useEffect(() => {
    console.log(editable, !rules.allowNameEditing)
  }, [editable, rules.allowNameEditing])

  return (
    <li>
      <fieldset disabled={!editable} className={`padding-25 margin-block-25 smooth ${styles['variable-fieldset']}`} style={{ backgroundColor: 'var(--gray)' }}>
        <legend className="padding-inline-50">
          <label>
            <input
              defaultValue={name}
              onChange={(e) => changeName(name, e.target.value, setRecipe)}
              type="text"
              placeholder={t("components:recipe_editor.variable_name_placeholder")}
              readOnly={!rules.allowNameEditing || (rules.allowNameEditing && !editable)}
              disabled={!rules.allowNameEditing || (rules.allowNameEditing && !editable)}
            />
          </label>
          <select
            defaultValue={variable.type}
            onChange={(e) => changeType(name, e.target.value, setRecipe)}
            disabled={!rules.allowTypeEditing || (rules.allowTypeEditing && !editable)}
          >
            <option value={RecipeDataTypes.DataSeries}>{t("components:recipe_editor.data_series")}</option>
            <option value={RecipeDataTypes.External}>{t("components:recipe_editor.external_data")}</option>
            <option value={RecipeDataTypes.Scalar}>{t("components:recipe_editor.scalar")}</option>
          </select>
          <input
            defaultValue={variable.unit || ""}
            onChange={(e) => changeUnit(name, e.target.value, setRecipe)}
            type="text"
            disabled={!rules.allowValueEditing || (rules.allowTypeEditing && !editable)}
            readOnly={!rules.allowValueEditing || (rules.allowValueEditing && !editable)}
            placeholder={t("components:recipe_editor.unit_placeholder")}
          />
          <button
            className="padding-25 round transparent margin-left-50"
            style={{ verticalAlign: 'middle' }}
            type="button"
            title="Edit" // TODO: I18n
            onClick={() => setEditable(!editable)}
          >
            <IconEdit width={20} height={20} className="grid" />
          </button>
        </legend>
        {children}
        {rules.allowDeleteVariables &&
          <button
            className="padding-25 round transparent margin-left-50"
            style={{ verticalAlign: 'middle' }}
            type="button"
            title="delete" // TODO: I18n
            onClick={() => deleteVariable(name, setRecipe)}
          >
            <IconTrashXFilled width={20} height={20} className="grid" />
          </button>
        }
      </fieldset>
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

  return (
    <CommonVariable
      name={name}
      rules={rules}
    >
      <input
        defaultValue={variable.value}
        onChange={(e) => changeScalarValue(name, e.target.value, setRecipe)}
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
        onChange={(e) => changeDataSeries(name, e.target.value, availableDataSeries, setRecipe)}
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

      {/*
      <SelectSingleTreeSearch // TODO: Fix disabled state
        props={{
          id: 'variable-tree', // TODO: Name and id must be dynamic
          name: '', 
          placeholder: 'Välj målbana eller effekt' // TODO: i18n
        }}
        treeItems={roadmapTreeStructure}
        onChange={(value) => handleDataSeriesChange(value ? value.value : '')}
      />
       */}
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

  return (
    <CommonVariable
      name={name}
      rules={rules}
    >
      <select
        defaultValue={variable.dataset || ""}
        disabled={!rules.allowValueEditing}
        onChange={(e) => changeDataset(name, e.target.value, setRecipe)}
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
        onChange={(e) => changeTable(name, e.target.value, setRecipe)}
        type="text"
        disabled={!rules.allowValueEditing}
        placeholder={t("components:recipe_editor.table")}
      />

      <input
        defaultValue={JSON.stringify(variable.selection) || ""}
        onChange={(e) => changeExternalSelection(name, e.target.value, setRecipe)}
        type="text"
        disabled={!rules.allowValueEditing}
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