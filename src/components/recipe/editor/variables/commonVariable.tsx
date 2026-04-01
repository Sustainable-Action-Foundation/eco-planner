"use client";

import { useRecipe } from "@/components/recipe/context/recipeContext.use";
import { RecipeDataTypes, RecipeError } from "@/functions/recipe/types";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { RecipeEditorPermissions } from "@/components/recipe";
import styles from "../recipe.module.css" with { type: "css" }
import { updateVariableName, updateVariableType, removeVariable } from "@/components/recipe/variableEditingHelpers";
import { IconEdit, IconTrashXFilled } from "@tabler/icons-react";
import TextSingleAutocomplete from "@/components/form/elements/combobox/textSingleAutocomplete";
import { allOurUnits } from "@/math";

// TODO: Fix labels
export function VariableTypeCommon({
  variableName,
  permissions,
  children,
}: {
  variableName: string;
  permissions?: RecipeEditorPermissions;
  children: React.ReactNode;
}) {
  const { t } = useTranslation(["common", "components"]);
  const { setVariable, getVariable, setVariables } = useRecipe();
  const variable = getVariable(variableName);
  const [editable, setEditable] = useState<boolean>(false)

  if (!variable) {
    throw new RecipeError(`Variable ${variableName} not found in recipe context`);
    return null;
  }

  permissions = { ...RecipeEditorPermissions, ...permissions };

  return (
    <fieldset
      className={`flex gap-100 align-items-flex-start justify-content-space-between ${styles['variable-fieldset']}`}
    >
      <button
        className="padding-25 round transparent "
        style={{ verticalAlign: 'middle' }}
        type="button"
        title={t("components:recipe_editor.edit_variable")}
        aria-label={t("components:recipe_editor.edit_variable")}
        onClick={() => setEditable(!editable)}
      >
        <IconEdit width={20} height={20} className="grid" />
      </button>
      <fieldset disabled={!editable} className="flex-grow-100">
        <div className="flex gap-25 align-items-center margin-bottom-75">
          <div className="floating-label" style={{ "--background": "linear-gradient(var(--gray-95) 50%, white 100%)" } as React.CSSProperties}>
            <label htmlFor={`variable-name-${variableName}`}>
              {t("components:recipe_editor.variable_name_placeholder")}
            </label>
            <input
              id={`variable-name-${variableName}`}
              placeholder=" "
              style={{ gridRow: '1', gridColumn: '1' }}
              defaultValue={variableName}
              onChange={(e) => updateVariableName(variableName, e.target.value, setVariables)}
              type="text"
            />
          </div>
          <div className="floating-label" style={{ "--background": "linear-gradient(var(--gray-95) 50%, white 100%)" } as React.CSSProperties}>
            <label htmlFor={`variable-unit-${variableName}`}>
              {t("components:recipe_editor.unit_placeholder")}
            </label>
            <TextSingleAutocomplete
              props={{
                id: `variable-unit-${variableName}`,
                name: `variable-unit-${variableName}`,
                defaultValue: variable.unit || "",
                placeholder: " ",
                style: { gridRow: '1', gridColumn: '2', width: '125px' }
              }}
              options={allOurUnits.map(unit => ({ name: unit, value: unit }))}
            />
          </div>
          <div className="floating-label" style={{ "--background": "linear-gradient(var(--gray-95) 50%, white 100%)" } as React.CSSProperties}>
            <label htmlFor={`variable-type-${variableName}`}>
              {t("components:recipe_editor.variable_type_label")}
            </label>
            <select
              id={`variable-type-${variableName}`}
              style={{ gridRow: '2', gridColumn: '1' }}
              defaultValue={variable.type}
              onChange={(e) => updateVariableType(variableName, e.target.value, setVariable)}
            >
              <option value={RecipeDataTypes.DataSeries}>{t("components:recipe_editor.data_series")}</option>
              <option value={RecipeDataTypes.External}>{t("components:recipe_editor.external_data")}</option>
              <option value={RecipeDataTypes.Scalar}>{t("components:recipe_editor.scalar")}</option>
            </select>
          </div>
        </div>
        <div className="flex gap-25 align-items-center ">
          {children}
        </div>
      </fieldset>
      {permissions.allowDeleteVariables &&
        <button
          disabled={!editable}
          className="padding-25 round transparent margin-left-50"
          style={{ verticalAlign: 'middle' }}
          type="button"
          title={t("common:tsx.delete")}
          onClick={() => removeVariable(variableName, setVariables)}
        >
          <IconTrashXFilled width={20} height={20} className="grid" />
        </button>
      }
    </fieldset>
  )
}