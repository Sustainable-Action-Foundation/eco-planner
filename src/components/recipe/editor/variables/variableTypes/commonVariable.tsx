"use client";

import { useRecipe } from "@/components/recipe/context/recipeContext.use";
import { RecipeDataTypes, RecipeVariable } from "@/functions/recipe-parser/types";
import React from "react";
import { useTranslation } from "react-i18next";
import { RecipeEditorPermissions } from "./recipeEditorPermissions";
import styles from "../../recipe.module.css" with { type: "css" }
import { updateVariableName, updateVariableType, removeVariable } from "@/components/recipe/variableEditingHelpers";
import { IconTrashXFilled } from "@tabler/icons-react";
import TextSingleAutocomplete from "@/components/form/elements/combobox/textSingleAutocomplete";
import { allOurUnits } from "@/math";
import { Popover, PopoverButton } from "@/components/generic/popovers/popovers";

export default function VariableTypeCommon({
  variableName,
  permissions,
  children,
}: {
  variableName: string;
  permissions?: RecipeEditorPermissions;
  children: React.ReactNode;
}) {
  const { t } = useTranslation(["common", "components"]);
  const { recipe, setRecipe } = useRecipe();
  const variable = recipe?.variables[variableName] as RecipeVariable;

  permissions = { ...RecipeEditorPermissions, ...permissions };

  return (
    <fieldset
      className={`flex gap-100 align-items-flex-start justify-content-space-between ${styles['variable-fieldset']}`}
    > 
      <div className="flex gap-25 align-items-flex-start">
        <div className="floating-label" style={{ "--background": "linear-gradient(var(--gray-95) 50%, white 100%)" } as React.CSSProperties}>
          <label htmlFor={`variable-name-${variableName}`}>
            {t("components:recipe_editor.variable_name_placeholder")}
          </label>
          <input
            id={`variable-name-${variableName}`}
            placeholder=" "
            style={{ gridRow: '1', gridColumn: '1' }}
            defaultValue={variableName}
            onChange={(e) => updateVariableName(variableName, e.target.value, setRecipe)}
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
        <div className="padding-left-25 flex gap-25 align-items-center" style={{borderLeft: '1px solid var(--gray-80)'}}>
          <div className="floating-label" style={{ "--background": "linear-gradient(var(--gray-95) 50%, white 100%)" } as React.CSSProperties}>
            <label htmlFor={`variable-type-${variableName}`}>
              {t("components:recipe_editor.variable_type_label")}
            </label>
            <select
              id={`variable-type-${variableName}`}
              style={{ gridRow: '2', gridColumn: '1' }}
              defaultValue={variable.type}
              onChange={(e) => updateVariableType(variableName, e.target.value, setRecipe)}
            >
              <option value={RecipeDataTypes.DataSeries}>{t("components:recipe_editor.data_series")}</option>
              <option value={RecipeDataTypes.External}>{t("components:recipe_editor.external_data")}</option>
              <option value={RecipeDataTypes.Scalar}>{t("components:recipe_editor.scalar")}</option>
            </select>
          </div>
          <span>—</span>
        </div>
        {children}
      </div>
      {permissions.allowDeleteVariables &&
        <>
          <PopoverButton
            anchorName={`--delete-variable-${variableName}-toggle`}
            popoverTarget={`delete-variable-${variableName}`}
            className="padding-25 round transparent margin-left-50"
            style={{ verticalAlign: 'middle' }}
          >
            <IconTrashXFilled width={20} height={20} className="grid" />
          </PopoverButton>
          <Popover
            style={{boxShadow: '0 0 .5rem -.25rem rgba(0,0,0,.25)'}}
            id={`delete-variable-${variableName}`}
            positionAnchor={`--delete-variable-${variableName}-toggle`}
            popover="auto"
            anchorInlinePosition="center"
            popoverDirection={{vertical: "down", horizontal: "left"}}
          >
            <div
              className="padding-50 smooth"
              style={{backgroundColor: 'white', border: '1px solid var(--gray)',}}
            >
              <p className="padding-inline-50 margin-top-50 margin-bottom-0 text-align-center">{t("components:recipe_editor.delete_variable")}<br />
                <span className="font-weight-600">{variableName}?</span>
              </p>
              <button
                className="width-100 margin-top-100 transparent red font-weight-600 color-purewhite margin-bottom-50"
                type="button"
                title={t("common:tsx.delete")}
                onClick={() => removeVariable(variableName, setRecipe)}
              >
                {t("common:tsx.delete")}
              </button>
              <button 
                className={`width-100 transparent padding-25 ${styles['cancel-button']}`}
                type="button" 
                popoverTarget={`delete-variable-${variableName}`} 
                popoverTargetAction="hide" 
              >
                {t("common:tsx.cancel")}
              </button>
            </div>
          </Popover>            
        </>
      }
    </fieldset>
  )
}