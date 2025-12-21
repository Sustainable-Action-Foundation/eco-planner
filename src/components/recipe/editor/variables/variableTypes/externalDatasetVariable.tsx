"use client"

import { useRecipe } from "@/components/recipe/context/recipeContext.use";
import { RecipeExternalDataset } from "@/functions/recipe-parser/types";
import { useTranslation } from "react-i18next";
import { RecipeEditorPermissions } from "./recipeEditorPermissions";
import { updateExternalVariableDataset, updateExternalVariableSelection, updateExternalVariableTable } from "@/components/recipe/variableEditingHelpers";
import VariableTypeCommon from "./commonVariable";
import VectorPickerSelect from "./vectorPickerSelect";
import { ExternalDataset } from "@/lib/api/utility";
import RecipeQueryBuilder from "@/components/form/api/recipeQueryBuilder";

// TODO: Fix labels
export default function VariableTypeExternal({
  variableName,
  permissions,
}: {
  variableName: string;
  permissions?: RecipeEditorPermissions;
}) {
  const { t } = useTranslation("components");

  permissions = { ...RecipeEditorPermissions, ...permissions };

  return (
    <>
      <VariableTypeCommon
        variableName={variableName}
        permissions={permissions}
      >
        <RecipeQueryBuilder variableName={variableName} />
        <div className="floating-label inline-block" style={{ "--background": "linear-gradient(var(--gray-95) 50%, white 100%)" } as React.CSSProperties}>
          <label htmlFor="variable-tree-vector-index-picker">
            {t("components:recipe_editor.vector_index_picker_label")}
          </label>
          <VectorPickerSelect permissions={permissions} variableName={variableName} />
        </div>
      </VariableTypeCommon>
    </>
  )
}


export function VariableTypeExternalSimple({
  variableName,
  permissions
}: {
  variableName: string,
  permissions?: RecipeEditorPermissions
}) {
  const { t } = useTranslation("components");
  const { recipe, setRecipe } = useRecipe();
  const variable = recipe?.variables[variableName] as RecipeExternalDataset;

  permissions = { ...RecipeEditorPermissions, ...permissions };

  return (
    <div className="flex gap-25"> {/* TODO: Figure out how to deal with labels here */} {/* TODO: Implement modal */}
      <select
        value={variable.dataset || ""}
        disabled={!permissions.allowValueEditing}
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
        disabled={!permissions.allowValueEditing}
        placeholder={t("components:recipe_editor.table")}
      />
      <input
        className="inline width-auto"
        value={JSON.stringify(variable.selection) || ""}
        onChange={(e) => updateExternalVariableSelection(variableName, e.target.value, setRecipe)}
        type="text"
        disabled={!permissions.allowValueEditing}
        placeholder={t("components:recipe_editor.selection")}
      />
    </div>
  )
}