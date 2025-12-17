"use client"

import { useRecipe } from "@/components/recipe/contextProvider";
import { RecipeScalar } from "@/functions/recipe-parser/types";
import { useTranslation } from "react-i18next";
import { InputRules, defaultInputRules } from "./rules";
import { updateScalarVariableValue } from "@/components/recipe/contextFunctions";
import VariableTypeCommon from "./common";

// TODO: Fix labels
export default function VariableTypeScalar({
  name,
  rules,
}: {
  name: string;
  rules?: InputRules;
}) {
  const { t } = useTranslation("components");
  const { recipe, setRecipe } = useRecipe();
  const variable = recipe?.variables[name] as RecipeScalar;

  rules = { ...defaultInputRules, ...rules };

  return (
    <VariableTypeCommon
      name={name}
      rules={rules}
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
          disabled={!rules.allowValueEditing}
          readOnly={!rules.allowValueEditing}
        />
      </div>
    </VariableTypeCommon>
  )
}

export function VariableTypeScalarSimple({
  name,
  rules,
  props = {},
}: {
  name: string;
  rules?: InputRules;
  props?: React.InputHTMLAttributes<HTMLInputElement>;
}) {
  const { t } = useTranslation("components");
  const { recipe, setRecipe } = useRecipe();
  const variable = recipe?.variables[name] as RecipeScalar;

  rules = { ...defaultInputRules, ...rules };

  return (
    <input
      className="inline width-auto"
      defaultValue={variable.value}
      onChange={(e) => updateScalarVariableValue(name, e.target.value, setRecipe)}
      type="number"
      placeholder={t("components:recipe_editor.scalar")}
      disabled={!rules.allowValueEditing}
      readOnly={!rules.allowValueEditing}
      {...props}
    />
  )
}