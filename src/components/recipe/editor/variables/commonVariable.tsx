"use client";

import type { RecipeVariable } from "@/functions/recipe/types";
import { emptyRecipesByDataType, RecipeDataTypes, RecipeError } from "@/functions/recipe/types";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { RecipeEditorPermissions, useRecipe } from "@/components/recipe";
import styles from "../../recipe.module.css" with { type: "css" }
import { IconEdit, IconTrashXFilled } from "@tabler/icons-react";
import TextSingleAutocomplete from "@/components/form/elements/combobox/textSingleAutocomplete";
import { allOurUnits } from "@/math";

// TODO: Fix labels
export function CommonVariable({
  variableId,
  permissions,
  children,
}: {
  variableId: string;
  permissions?: RecipeEditorPermissions;
  children: React.ReactNode;
}) {
  const { t } = useTranslation(["common", "components"]);

  const { setVariable, getVariable } = useRecipe();
  const variable = getVariable(variableId);
  if (!variable) throw new RecipeError(`Variable with id "${variableId}" not found in recipe context.`);

  const [editable, setEditable] = useState<boolean>(false)

  permissions = { ...RecipeEditorPermissions, ...permissions };

  return (
    <fieldset
      className={`flex gap-100 align-items-flex-start justify-content-space-between ${styles['variable-fieldset']}`}
    >
      {/* Edit protection */}
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

          {/* Name */}
          <div className="floating-label" style={{ "--background": "linear-gradient(var(--gray-95) 50%, white 100%)" } as React.CSSProperties}>
            <label htmlFor={`variable-name-${variableId}`}>
              {t("components:recipe_editor.variable_name_placeholder")}
            </label>
            <input
              id={`variable-name-${variableId}`}
              placeholder=" "
              style={{ gridRow: '1', gridColumn: '1' }}
              defaultValue={variable.name}
              onChange={(e) => setVariable(variableId, v => ({ ...v, name: e.target.value }))}
              type="text"
            />
          </div>

          {/* Unit */}
          <div className="floating-label" style={{ "--background": "linear-gradient(var(--gray-95) 50%, white 100%)" } as React.CSSProperties}>
            <label htmlFor={`variable-unit-${variableId}`}>
              {t("components:recipe_editor.unit_placeholder")}
            </label>
            <TextSingleAutocomplete
              props={{
                id: `variable-unit-${variableId}`,
                name: `variable-unit-${variableId}`,
                defaultValue: variable.unit || "",
                placeholder: " ",
                style: { gridRow: '1', gridColumn: '2', width: '125px' }
              }}
              options={allOurUnits.map(unit => ({ name: unit, value: unit }))}
            />
          </div>

          {/* Variable Type */}
          {/* TODO: you should not be allowed to switch?? */}
          <div className="floating-label" style={{ "--background": "linear-gradient(var(--gray-95) 50%, white 100%)" } as React.CSSProperties}>
            <label htmlFor={`variable-type-${variableId}`}>
              {t("components:recipe_editor.variable_type_label")}
            </label>
            <select
              id={`variable-type-${variableId}`}
              style={{ gridRow: '2', gridColumn: '1' }}
              defaultValue={variable.type}
              onChange={(e) => setVariable(variableId, v => {
                const newType = e.target.value as RecipeDataTypes;
                if (!Object.values(RecipeDataTypes).includes(newType)) {
                  console.error(`Invalid variable type selected: ${newType}`, variable, "->", v);
                  return v;
                }
                return {
                  ...emptyRecipesByDataType[newType],
                  name: v.name,
                  unit: v.unit,
                  template: v.template,
                } satisfies RecipeVariable;
              })}
            >
              <option value={RecipeDataTypes.DataSeries}>{t("components:recipe_editor.data_series")}</option>
              <option value={RecipeDataTypes.External}>{t("components:recipe_editor.external_data")}</option>
              <option value={RecipeDataTypes.Scalar}>{t("components:recipe_editor.scalar")}</option>
            </select>
          </div>
        </div>

        {/* Type specific things go here */}
        <div className="flex gap-25 align-items-center ">
          {children}
        </div>
      </fieldset>

      {/* Delete */}
      {
        permissions.allowDeleteVariables &&
        <button
          disabled={!editable}
          className="padding-25 round transparent margin-left-50"
          style={{ verticalAlign: 'middle' }}
          type="button"
          title={t("common:tsx.delete")}
          onClick={() => setVariable(variableId, null)}
        >
          <IconTrashXFilled width={20} height={20} className="grid" />
        </button>
      }
    </fieldset >
  )
}