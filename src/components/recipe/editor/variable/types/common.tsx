"use client";

import { useRecipe } from "@/components/recipe/contextProvider";
import { RecipeDataTypes, RecipeVariable } from "@/functions/recipe-parser/types";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { InputRules, defaultInputRules } from "./rules";
import styles from '../../editor.module.css' with {type: 'css'}
import { changeName, changeType, deleteVariable } from "@/components/recipe/contextFunctions";
import { IconEdit, IconTrashXFilled } from "@tabler/icons-react";
import TextSingleAutocomplete from "@/components/form/elements/combobox/textSingleAutocomplete";
import { Unit } from "mathjs";

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
  const { t } = useTranslation(["common", "components"]);
  const { recipe, setRecipe } = useRecipe();
  const variable = recipe?.variables[name] as RecipeVariable;
  const [editable, setEditable] = useState<boolean>(false)

  rules = { ...defaultInputRules, ...rules };

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
            />
          </div>
          <div className="floating-label" style={{ "--background": "linear-gradient(var(--gray-95) 50%, white 100%)" } as React.CSSProperties}>
            <label htmlFor={`variable-unit-${name}`}>
              {t("components:recipe_editor.unit_placeholder")}
            </label>
            <TextSingleAutocomplete
              props={{
                id: `variable-unit-${name}`,
                name: `variable-unit-${name}`,
                defaultValue: variable.unit || "",
                placeholder: " ",
                style: { gridRow: '1', gridColumn: '2', width: '125px' }
              }}
              options={Object.keys(Unit.UNITS).map(unit => ({ name: unit, value: unit }))}
            />
          </div>
          <div className="floating-label" style={{ "--background": "linear-gradient(var(--gray-95) 50%, white 100%)" } as React.CSSProperties}>
            <label htmlFor={`variable-type-${name}`}>
              {t("components:recipe_editor.variable_type_label")}
            </label>
            <select
              id={`variable-type-${name}`}
              style={{ gridRow: '2', gridColumn: '1' }}
              defaultValue={variable.type}
              onChange={(e) => changeType(name, e.target.value, setRecipe)}
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
      {rules.allowDeleteVariables &&
        <button
          disabled={!editable}
          className="padding-25 round transparent margin-left-50"
          style={{ verticalAlign: 'middle' }}
          type="button"
          title={t("common:tsx.delete")}
          onClick={() => deleteVariable(name, setRecipe)}
        >
          <IconTrashXFilled width={20} height={20} className="grid" />
        </button>
      }
    </fieldset>
  )
}