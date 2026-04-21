"use client"

import { useTranslation } from "react-i18next";
import { RecipeEditorPermissions } from "../recipeEditorPermissions";
import { ExternalDataset, isDataSetKeys } from "@/lib/api/utility";
import RecipeQueryBuilder from "@/components/form/api/recipeQueryBuilder";
import type { ExternalVariable } from "@/functions/recipe/types";
import { isStringifiedExternalSelection, RecipeDataTypes } from "@/functions/recipe/types";
import { useRecipe, CommonVariable, VectorPickerSelect } from "@/components/recipe";

// TODO: Fix labels
export function VariableTypeExternal({
  variableId,
  permissions: incomingPermissions,
}: {
  variableId: string;
  permissions?: RecipeEditorPermissions;
}) {
  const { t } = useTranslation("components");

  const { getVariable } = useRecipe();
  const variable = getVariable(variableId, RecipeDataTypes.External);
  if (!variable) throw new Error(`External variable with id "${variableId}" not found.`);

  const permissions = { ...RecipeEditorPermissions, ...incomingPermissions };

  return (
    <>
      <CommonVariable
        variableId={variableId}
        permissions={{ ...permissions }}
      >
        <RecipeQueryBuilder variableId={variableId} />
        <div className="floating-label inline-block" style={{ "--background": "linear-gradient(var(--gray-95) 50%, white 100%)" } as React.CSSProperties}>
          <label htmlFor="variable-tree-vector-index-picker">
            {t("components:recipe_editor.vector_index_picker_label")}
          </label>
          <VectorPickerSelect permissions={{ ...permissions }} variableId={variableId} />
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
  variableId,
  permissions: incomingPermissions,
  props = {},
}: {
  variableId: string,
  permissions?: RecipeEditorPermissions
  props?: React.InputHTMLAttributes<HTMLInputElement>;
}) {
  const { t } = useTranslation("components");

  const { upsertVariable, getVariable } = useRecipe();
  const variable = getVariable(variableId, RecipeDataTypes.External);
  if (!variable) throw new Error(`External variable with id "${variableId}" not found.`);

  const permissions = { ...RecipeEditorPermissions, ...incomingPermissions };

  return (
    <div
      {...props}
    > {/* TODO: Figure out how to deal with labels here */}
      <RecipeQueryBuilder
        variableId={variableId}
        initialDataSource={variable.dataset ?? undefined}
        initialTableId={variable.tableId ?? undefined}
        initialSelection={variable.selection}
      />

      {/* 
        Hidden since the query builder is supposed to replace these 
        TODO: make this component pretty and UX friendly 
      */}
      <div hidden className="display-hidden">
        {/* Dataset */}
        <select
          value={variable.dataset || ""}
          disabled={!permissions.allowValueEditing}
          onChange={(e) => upsertVariable(variableId, prev => prev.type === RecipeDataTypes.External
            ? { ...prev, dataset: isDataSetKeys(e.target.value) ? e.target.value : prev.dataset }
            : prev
          )}
        >
          <option value="">{t("components:recipe_editor.dataset")}</option>
          {ExternalDataset.knownDatasetKeys.map((datasetName, i) => (
            <option key={`datasetOption-${i}`} value={datasetName}>
              {datasetName}
            </option>
          ))}
        </select>

        {/* Table */}
        <input
          className="inline width-auto"
          value={variable.tableId || ""}
          onChange={(e) => upsertVariable(variableId, prev => prev.type === RecipeDataTypes.External
            ? { ...prev, tableId: e.target.value }
            : prev
          )}
          type="text"
          disabled={!permissions.allowValueEditing}
          placeholder={t("components:recipe_editor.table")}
        />

        {/* Selection */}
        <input
          className="inline width-auto"
          value={JSON.stringify(variable.selection) || ""}
          onChange={(e) => upsertVariable(variableId, prev => prev.type === RecipeDataTypes.External
            ? {
              ...prev, selection: isStringifiedExternalSelection(e.target.value)
                ? JSON.parse(e.target.value) as ExternalVariable["selection"]
                : prev.selection
            }
            : prev
          )}
          type="text"
          disabled={!permissions.allowValueEditing}
          placeholder={t("components:recipe_editor.selection")}
        />
      </div>
    </div>
  )
}