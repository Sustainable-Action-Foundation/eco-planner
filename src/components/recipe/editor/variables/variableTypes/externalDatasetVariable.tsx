"use client"

import { useRecipe } from "@/components/recipe/contextProvider";
import { RecipeExternalDataset } from "@/functions/recipe-parser/types";
import { useTranslation } from "react-i18next";
import { RecipeEditorPermissions } from "./variableRules";
import { updateExternalVariableDataset, updateExternalVariableSelection, updateExternalVariableTable } from "@/components/recipe/variableEditingHelpers";
import VariableTypeCommon from "./commonVariable";
import VectorPickerSelect from "./vectorPickerSelect";
import { ExternalDataset } from "@/lib/api/utility";
import RecipeQueryBuilder from "@/components/form/api/recipeQueryBuilder";

// TODO: Fix labels
export default function VariableTypeExternal({
  variableName,
  rules,
}: {
  variableName: string;
  rules?: RecipeEditorPermissions;
}) {
  const { t } = useTranslation("components");
  const { recipe, setRecipe } = useRecipe();
  const variable = recipe?.variables[variableName] as RecipeExternalDataset;

  rules = { ...RecipeEditorPermissions, ...rules };

  return (
    <VariableTypeCommon
      variableName={variableName}
      rules={rules}
    >
      <div className="floating-label inline-block" style={{ "--background": "linear-gradient(var(--gray-95) 50%, white 100%)" } as React.CSSProperties}>
        <label htmlFor="external-variable-dataset">
          {t("components:recipe_editor.dataset")}
        </label>
        <select
          id="external-variable-dataset" /* TODO: This ID needs to be dynamic */
          value={variable.dataset || ""}
          disabled={!rules.allowValueEditing}
          onChange={(e) => updateExternalVariableDataset(variableName, e.target.value, setRecipe)}
        >
          <option disabled value="">{t("components:recipe_editor.select_dataset")}</option>
          {/* <option value={variable.dataset}>{variable.dataset}</option> */}
          {ExternalDataset.knownDatasetKeys.map((datasetName, i) => (
            <option key={`datasetOption-${i}`} value={datasetName}>
              {datasetName}
            </option>
          ))}
        </select>
      </div>

      <div className="floating-label inline-block" style={{ "--background": "linear-gradient(var(--gray-95) 50%, white 100%)" } as React.CSSProperties}>
        <label htmlFor="external-variable-table">
          {t("components:recipe_editor.table")}
        </label>
        <input
          id="external-variable-table" /* TODO: This ID needs to be dynamic */
          value={variable.tableId || ""}
          onChange={(e) => updateExternalVariableTable(variableName, e.target.value, setRecipe)}
          type="text"
          disabled={!rules.allowValueEditing}
          placeholder=" "
        />
      </div>

      <div className="floating-label inline-block" style={{ "--background": "linear-gradient(var(--gray-95) 50%, white 100%)" } as React.CSSProperties}>
        <label htmlFor="external-variable-selection">
          {t("components:recipe_editor.selection")}
        </label>
        <input
          id="external-variable-selection" /* TODO: This ID needs to be dynamic */
          value={JSON.stringify(variable.selection) || ""}
          onChange={(e) => updateExternalVariableSelection(variableName, e.target.value, setRecipe)}
          type="text"
          disabled={!rules.allowValueEditing}
          placeholder=" "
        />
      </div>

      <div className="floating-label inline-block" style={{ "--background": "linear-gradient(var(--gray-95) 50%, white 100%)" } as React.CSSProperties}>
        <label htmlFor="variable-tree-vector-index-picker">
          {t("components:recipe_editor.vector_index_picker_label")}
        </label>
        <VectorPickerSelect rules={rules} variableName={variableName} />
      </div>

      <RecipeQueryBuilder variableName={variableName} />
    </VariableTypeCommon>
  )
}


export function VariableTypeExternalSimple({
  variableName,
  rules
}: {
  variableName: string,
  rules?: RecipeEditorPermissions
}) {
  const { t } = useTranslation("components");
  const { recipe, setRecipe } = useRecipe();
  const variable = recipe?.variables[variableName] as RecipeExternalDataset;

  rules = { ...RecipeEditorPermissions, ...rules };

  return (
    <div className="flex gap-25"> {/* TODO: Figure out how to deal with labels here */}
      <select
        value={variable.dataset || ""}
        disabled={!rules.allowValueEditing}
        onChange={(e) => updateExternalVariableDataset(variableName, e.target.value, setRecipe)}
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
        className="inline width-auto"
        value={variable.tableId || ""}
        onChange={(e) => updateExternalVariableTable(variableName, e.target.value, setRecipe)}
        type="text"
        disabled={!rules.allowValueEditing}
        placeholder={t("components:recipe_editor.table")}
      />
      <input
        className="inline width-auto"
        value={JSON.stringify(variable.selection) || ""}
        onChange={(e) => updateExternalVariableSelection(variableName, e.target.value, setRecipe)}
        type="text"
        disabled={!rules.allowValueEditing}
        placeholder={t("components:recipe_editor.selection")}
      />
    </div>
  )
}