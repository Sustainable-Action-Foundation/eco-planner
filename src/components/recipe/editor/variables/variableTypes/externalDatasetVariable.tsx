"use client"

import { useTranslation } from "react-i18next";
import { RecipeEditorPermissions } from "./recipeEditorPermissions";
import VariableTypeCommon from "./commonVariable";
import VectorPickerSelect from "./vectorPickerSelect";
import RecipeQueryBuilder from "@/components/form/api/recipeQueryBuilder";

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
        <RecipeQueryBuilder variableIsSimple={false} variableName={variableName} />
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
}: {
  variableName: string,
}) {

  return (
    <RecipeQueryBuilder variableIsSimple={true} variableName={variableName} /> 
  )
}