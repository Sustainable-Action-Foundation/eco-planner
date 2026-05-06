"use client";

import { RecipeError } from "@/functions/recipe/types";
import React from "react";
import { useTranslation } from "react-i18next";
import { RecipeEditorPermissions, useRecipe } from "@/components/recipe";
import styles from "../../recipe.module.css" with { type: "css" };
import { IconTrashXFilled } from "@tabler/icons-react";
import TextSingleAutocomplete from "@/components/form/elements/combobox/textSingleAutocomplete";
import { allOurUnits } from "@/math";

// TODO: Fix labels
export function CommonVariable({
  variableId,
  permissions: incomingPermissions,
  children,
}: {
  variableId: string;
  permissions?: RecipeEditorPermissions;
  children: React.ReactNode;
}) {
  const { t } = useTranslation(["common", "components"]);

  const { upsertVariable, getVariable } = useRecipe();
  const variable = getVariable(variableId);
  if (!variable) throw new RecipeError(`Variable with id "${variableId}" not found in recipe context.`);

  const permissions = { ...RecipeEditorPermissions, ...incomingPermissions };

  return (
    <fieldset
      className={`flex gap-100 align-items-flex-start justify-content-space-between ${styles['variable-fieldset']}`}
    >
      <fieldset className="flex-grow-100">
        <p style={{ marginTop: 0 }}>{variable.type}</p> {/* TODO: i18n */}

        <div className="flex gap-25 align-items-center margin-bottom-75">
          {/* Name */}
          <div className="floating-label" style={{ "--background": "linear-gradient(var(--gray-95) 50%, white 100%)" } as React.CSSProperties}>
            <label htmlFor={`variable-name-${variableId}`}>
              {t("components:recipe_editor.variable_name_placeholder")}
            </label>
            <input
              disabled={!permissions.allowNameEditing}
              id={`variable-name-${variableId}`}
              placeholder=" "
              style={{ gridRow: '1', gridColumn: '1' }}
              defaultValue={variable.name}
              onChange={(e) => upsertVariable(variableId, v => ({ ...v, name: e.target.value }))}
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
                disabled: !permissions.allowValueEditing,
                id: `variable-unit-${variableId}`,
                name: `variable-unit-${variableId}`,
                defaultValue: variable.unit || "",
                placeholder: " ",
                style: { gridRow: '1', gridColumn: '2', width: '125px' },
              }}
              options={allOurUnits.map(unit => ({ name: unit, value: unit }))}
            />
          </div>
        </div>

        {/* Type specific things go here */}
        <div className="flex gap-25 align-items-center ">
          {children}
        </div>
      </fieldset>

      {/* Delete */}
      {permissions.allowDeleteVariables &&
        <button
          className="padding-25 round transparent margin-left-50"
          style={{ verticalAlign: 'middle' }}
          type="button"
          title={t("common:tsx.delete")}
          onClick={() => upsertVariable(variableId, null)}
        >
          <IconTrashXFilled width={20} height={20} className="grid" />
        </button>
      }
    </fieldset >
  );
}