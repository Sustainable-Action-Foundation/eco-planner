"use client"

import { useRecipe } from "@/components/recipe/contextProvider";
import { RecipeScalar } from "@/functions/recipe/types";
import { useTranslation } from "react-i18next";
import { RecipeEditorPermissions } from "./recipeEditorPermissions";
import { updateScalarVariableValue } from "@/components/recipe/variableEditingHelpers";
import VariableTypeCommon from "./commonVariable";

// TODO: Fix labels
export default function VariableTypeScalar({
  name,
  permissions,
}: {
  name: string;
  permissions?: RecipeEditorPermissions;
}) {
  const { t } = useTranslation("components");
  const { recipe, setRecipe } = useRecipe();
  const variable = recipe?.variables[name] as RecipeScalar;

  permissions = { ...RecipeEditorPermissions, ...permissions };

  return (
    <VariableTypeCommon
      variableName={name}
      permissions={permissions}
    >
      <div className="floating-label inline-block" style={{ "--background": "linear-gradient(var(--gray-95) 50%, white 100%)" } as React.CSSProperties}>
        <label htmlFor="variable-tree-vector-index-picker">
          {t("components:recipe_editor.scalar")}
        </label>
        <input
          defaultValue={variable.value}
          onChange={(e) => updateScalarVariableValue(name, e.target.value, setRecipe)}
          type="number"
          placeholder=" "
          disabled={!permissions.allowValueEditing}
          readOnly={!permissions.allowValueEditing}
        />
      </div>
    </VariableTypeCommon>
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
  const { recipe, setRecipe } = useRecipe();
  const variable = recipe?.variables[variableName] as RecipeScalar;

  permissions = { ...RecipeEditorPermissions, ...permissions };

  return (
    <input
      className="inline width-auto"
      defaultValue={variable.value}
      onChange={(e) => updateScalarVariableValue(variableName, e.target.value, setRecipe)}
      type="number"
      placeholder={t("components:recipe_editor.scalar")}
      disabled={!permissions.allowValueEditing}
      readOnly={!permissions.allowValueEditing}
      {...props}
    />
  )
}