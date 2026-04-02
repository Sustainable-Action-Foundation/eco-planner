"use client"

import { useTranslation } from "react-i18next";
import { RecipeEditorPermissions } from "../recipeEditorPermissions";
import { updateExternalVariableDataset, updateExternalVariableSelection, updateExternalVariableTable } from "@/components/recipe/variableEditingHelpers";
import { ExternalDataset } from "@/lib/api/utility";
import RecipeQueryBuilder from "@/components/form/api/recipeQueryBuilder";
import type { ExternalVariable } from "@/functions/recipe/types";
import { useRecipe, CommonVariable, VectorPickerSelect } from "@/components/recipe";

// TODO: Fix labels
export function VariableTypeExternal({
  variableName,
  permissions,
}: {
  variableName: string;
  permissions?: RecipeEditorPermissions;
}) {
  const { t } = useTranslation("components");
  const { recipe } = useRecipe();
  // TODO: Handle undefined variable
  const variable = recipe?.variables[variableName] as ExternalVariable;

  permissions = { ...RecipeEditorPermissions, ...permissions };

  return (
    <>
      <CommonVariable
        variableId={variableName}
        permissions={permissions}
      >
        <RecipeQueryBuilder variableName={variableName} />
        <div className="floating-label inline-block" style={{ "--background": "linear-gradient(var(--gray-95) 50%, white 100%)" } as React.CSSProperties}>
          <label htmlFor="variable-tree-vector-index-picker">
            {t("components:recipe_editor.vector_index_picker_label")}
          </label>
          <VectorPickerSelect permissions={permissions} variableName={variableName} />
        </div>
      </CommonVariable>
      <div className="flex gap-25 margin-left-300 margin-top-100"> {/* TODO: Handle overflow a bit better here */}
        <span style={{ whiteSpace: "nowrap" }}>{t("components:recipe_editor.dataset")}: {variable.dataset || ""},</span>
        <span style={{ whiteSpace: "nowrap" }}>{t("components:recipe_editor.table")}: {variable.tableId || ""},</span>
        <span style={{ whiteSpace: "nowrap", maxWidth: '400px', textOverflow: 'ellipsis', overflow: 'hidden' }}>{t("components:recipe_editor.selection")}: {JSON.stringify(variable.selection) || ""}</span>
      </div>
    </>
  )
}


export function VariableTypeExternalSimple({
  variableName,
  permissions,
  props = {},
}: {
  variableName: string,
  permissions?: RecipeEditorPermissions
  props?: React.InputHTMLAttributes<HTMLInputElement>;
}) {
  const { t } = useTranslation("components");
  const { recipe, setVariable } = useRecipe();
  const variable = recipe?.variables[variableName] as ExternalVariable;

  permissions = { ...RecipeEditorPermissions, ...permissions };

  return (
    <div
      className="flex gap-25"
      {...props}
    > {/* TODO: Figure out how to deal with labels here */}
      <select
        value={variable.dataset || ""}
        disabled={!permissions.allowValueEditing}
        onChange={(e) => updateExternalVariableDataset(variableName, e.target.value, setVariable)}
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
        onChange={(e) => updateExternalVariableTable(variableName, e.target.value, setVariable)}
        type="text"
        disabled={!permissions.allowValueEditing}
        placeholder={t("components:recipe_editor.table")}
      />
      <input
        className="inline width-auto"
        value={JSON.stringify(variable.selection) || ""}
        onChange={(e) => updateExternalVariableSelection(variableName, e.target.value, setVariable)}
        type="text"
        disabled={!permissions.allowValueEditing}
        placeholder={t("components:recipe_editor.selection")}
      />
    </div>
  )
}