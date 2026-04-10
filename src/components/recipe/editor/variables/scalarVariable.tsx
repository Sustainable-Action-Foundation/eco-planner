"use client"

import { useRecipe } from "@/components/recipe/context/recipeContext.use";
import { RecipeDataTypes, type ScalarVariable } from "@/functions/recipe/types";
import { useTranslation } from "react-i18next";
import { RecipeEditorPermissions } from "../recipeEditorPermissions";
import { CommonVariable } from "@/components/recipe";

// TODO: Fix labels
export function VariableTypeScalar({
  name,
  permissions,
}: {
  name: string;
  permissions?: RecipeEditorPermissions;
}) {
  const { t } = useTranslation("components");
  const { recipe, setVariable } = useRecipe();
  const variable = recipe?.variables[name] as ScalarVariable;

  permissions = { ...RecipeEditorPermissions, ...permissions };

  return (
    <CommonVariable
      variableId={name}
      permissions={permissions}
    >
      <div className="floating-label inline-block" style={{ "--background": "linear-gradient(var(--gray-95) 50%, white 100%)" } as React.CSSProperties}>
        <label htmlFor="variable-tree-vector-index-picker">
          {t("components:recipe_editor.scalar")}
        </label>
        <input
          defaultValue={variable.value}
          onChange={(e) => setVariable(name, prev => prev.type === RecipeDataTypes.Scalar
            ? { ...prev, value: Number(e.target.value) }
            : prev
          )}
          type="number"
          placeholder=" "
          disabled={!permissions.allowValueEditing}
          readOnly={!permissions.allowValueEditing}
        />
      </div>
    </CommonVariable>
  )
}

export function VariableTypeScalarSimple({
  variableName,
  permissions,
  props = {},
}: {
  variableName: string;
  permissions?: RecipeEditorPermissions;
  props?: React.InputHTMLAttributes<HTMLInputElement>;
}) {
  const { t } = useTranslation("components");
  const { recipe, setVariable } = useRecipe();
  const variable = recipe?.variables[variableName] as ScalarVariable;

  permissions = { ...RecipeEditorPermissions, ...permissions };

  return (
    <input
      className="inline width-auto"
      defaultValue={variable.value}
      onChange={(e) => setVariable(variableName, prev => prev.type === RecipeDataTypes.Scalar
        ? { ...prev, value: Number(e.target.value) }
        : prev
      )}
      type="number"
      placeholder={t("components:recipe_editor.scalar")}
      disabled={!permissions.allowValueEditing}
      readOnly={!permissions.allowValueEditing}
      {...props}
    />
  )
}