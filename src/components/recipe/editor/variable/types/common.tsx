"use client";

import { useRecipe } from "@/components/recipe/contextProvider";
import { RecipeDataTypes, RecipeVariables } from "@/functions/recipe-parser/types";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { InputRules, defaultInputRules } from "./rules";
import styles from '../../editor.module.css' with {type: 'css'}
import { changeName, changeType, changeUnit, deleteVariable } from "@/components/recipe/contextFunctions";
import { IconEdit, IconTrashXFilled } from "@tabler/icons-react";

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
  const [editable, setEditable] = useState<boolean>(true)

  rules = { ...defaultInputRules, ...rules };

  useEffect(() => {
    console.log(editable, !rules.allowNameEditing)
  }, [editable, rules.allowNameEditing])

  return (
    <li>
      <fieldset disabled={!editable} className={`padding-25 margin-block-25 smooth ${styles['variable-fieldset']}`} style={{ backgroundColor: 'var(--gray)' }}>
        <legend className="padding-inline-50">
          <label>
            <input
              defaultValue={name}
              onChange={(e) => changeName(name, e.target.value, setRecipe)}
              type="text"
              placeholder={t("components:recipe_editor.variable_name_placeholder")}
              readOnly={!rules.allowNameEditing || (rules.allowNameEditing && !editable)}
              disabled={!rules.allowNameEditing || (rules.allowNameEditing && !editable)}
            />
          </label>
          <select
            defaultValue={variable.type}
            onChange={(e) => changeType(name, e.target.value, setRecipe)}
            disabled={!rules.allowTypeEditing || (rules.allowTypeEditing && !editable)}
          >
            <option value={RecipeDataTypes.DataSeries}>{t("components:recipe_editor.data_series")}</option>
            <option value={RecipeDataTypes.External}>{t("components:recipe_editor.external_data")}</option>
            <option value={RecipeDataTypes.Scalar}>{t("components:recipe_editor.scalar")}</option>
          </select>
          <input
            defaultValue={variable.unit || ""}
            onChange={(e) => changeUnit(name, e.target.value, setRecipe)}
            type="text"
            disabled={!rules.allowValueEditing || (rules.allowTypeEditing && !editable)}
            readOnly={!rules.allowValueEditing || (rules.allowValueEditing && !editable)}
            placeholder={t("components:recipe_editor.unit_placeholder")}
          />
          <button
            className="padding-25 round transparent margin-left-50"
            style={{ verticalAlign: 'middle' }}
            type="button"
            title="Edit" // TODO: I18n
            onClick={() => setEditable(!editable)}
          >
            <IconEdit width={20} height={20} className="grid" />
          </button>
        </legend>
        {children}
        {rules.allowDeleteVariables &&
          <button
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