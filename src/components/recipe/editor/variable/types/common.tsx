"use client";

import { useRecipe } from "@/components/recipe/contextProvider";
import { RecipeDataTypes, RecipeVariables } from "@/functions/recipe-parser/types";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { InputRules, defaultInputRules } from "./rules";
import styles from '../../editor.module.css' with {type: 'css'}
import { changeName, changeType, changeUnit, deleteVariable } from "@/components/recipe/contextFunctions";
import { IconEdit, IconTrashXFilled } from "@tabler/icons-react";
import TextSingleAutocomplete from "@/components/form/elements/combobox/textSingleAutocomplete";
import { Unit } from "mathjs";

// TODO: I18n
// TODO: Fix labels
export default function VariableTypeCommon({
  name,
  rules,
  children,
}: {
  name: string;
  rules?: InputRules;
  children: React.ReactNode;
}) {
  const { t } = useTranslation("components");
  const { recipe, setRecipe } = useRecipe();
  const variable = recipe?.variables[name] as RecipeVariables;
  const [editable, setEditable] = useState<boolean>(false)

  rules = { ...defaultInputRules, ...rules };

  return (
    <li className="padding-bottom-75 margin-bottom-75">
      <fieldset
        className={`flex gap-100 align-items-flex-start justify-content-space-between ${styles['variable-fieldset']}`}
      >
        <legend className="margin-bottom-100 flex align-items-center gap-25" style={{textTransform: 'capitalize'}}>
          <button
            className="padding-25 round transparent "
            style={{ verticalAlign: 'middle' }}
            type="button"
            title="Edit variable" // TODO: I18n
            aria-label="Edit variable" // TODO: I18n
            onClick={() => setEditable(!editable)}
          >
            <IconEdit width={20} height={20} className="grid" />
          </button>
          {name}
        </legend>
        <fieldset className="grid gap-25" style={{ gridTemplateColumns: 'auto auto', gridTemplateRows: 'auto auto', rowGap: '.5rem' }}>
          <div className="focusable floating-label" style={{ "--background": "linear-gradient(var(--gray-95) 50%, white 100%)" } as React.CSSProperties}>
            <label htmlFor={`variable-name-${name}`}>
              {t("components:recipe_editor.variable_name_placeholder")}
            </label>
            <input
              id={`variable-name-${name}`}
              placeholder=" "
              style={{ gridRow: '1', gridColumn: '1' }}
              defaultValue={name}
              onChange={(e) => changeName(name, e.target.value, setRecipe)}
              type="text"
              readOnly={!rules.allowNameEditing || (rules.allowNameEditing && !editable)}
              disabled={!rules.allowNameEditing || (rules.allowNameEditing && !editable)}
            />
          </div>
          <div className="focusable floating-label" style={{ "--background": "linear-gradient(var(--gray-95) 50%, white 100%)" } as React.CSSProperties}>
            <label htmlFor={`variable-unit-${name}`}>
              {t("components:recipe_editor.unit_placeholder")}
            </label>
            {/* <input
              id={`variable-unit-${name}`}
              style={{ gridRow: '1', gridColumn: '2' }}
              defaultValue={variable.unit || ""}
              onChange={(e) => changeUnit(name, e.target.value, setRecipe)}
              type="text"
              disabled={!rules.allowValueEditing || (rules.allowTypeEditing && !editable)}
              readOnly={!rules.allowValueEditing || (rules.allowValueEditing && !editable)}
              placeholder=" "
            /> */}
            <TextSingleAutocomplete 
              props={{
                id: `variable-unit-${name}`, 
                name: `variable-unit-${name}`,
                defaultValue: variable.unit || "",
                disabled: !rules.allowValueEditing || (rules.allowTypeEditing && !editable),
                placeholder: " ",
                style: { gridRow: '1', gridColumn: '2', width: '125px' }
              }}
              options={Object.keys(Unit.UNITS).map(unit => ({ name: unit, value: unit }))}
            />
          </div>
          <div className="focusable floating-label" style={{ "--background": "linear-gradient(var(--gray-95) 50%, white 100%)" } as React.CSSProperties}>
            <label htmlFor={`variable-type-${name}`}>
              Typ {/* TODO: i18n  */}
            </label>
            <select
              id={`variable-type-${name}`}
              style={{ gridRow: '2', gridColumn: '1' }}
              defaultValue={variable.type}
              onChange={(e) => changeType(name, e.target.value, setRecipe)}
              disabled={!rules.allowTypeEditing || (rules.allowTypeEditing && !editable)}
            >
              <option value={RecipeDataTypes.DataSeries}>{t("components:recipe_editor.data_series")}</option>
              <option value={RecipeDataTypes.External}>{t("components:recipe_editor.external_data")}</option>
              <option value={RecipeDataTypes.Scalar}>{t("components:recipe_editor.scalar")}</option>
            </select>
          </div>
        </fieldset>
        <div className="flex-grow-100">
          {children}
        </div>
        {rules.allowDeleteVariables &&
          <button
            disabled={!editable}
            className="padding-25 round transparent margin-left-50"
            style={{ verticalAlign: 'middle' }}
            type="button"
            title="delete" // TODO: I18n
            onClick={() => deleteVariable(name, setRecipe)}
          >
            <IconTrashXFilled width={20} height={20} className="grid" />
          </button>
        }
      </fieldset>
    </li>
  )
}