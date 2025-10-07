"use client"

import { useRecipe } from "@/components/recipe/contextProvider";
import { RecipeScalar } from "@/functions/recipe-parser/types";
import { useTranslation } from "react-i18next";
import { InputRules, defaultInputRules } from "./rules";
import { changeScalarValue } from "@/components/recipe/contextFunctions";
import VariableTypeCommon from "./common";

// TODO: I18n
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
      <input
        defaultValue={variable.value}
        onChange={(e) => changeScalarValue(name, e.target.value, setRecipe)}
        type="number"
        placeholder={t("components:recipe_editor.scalar")}
        disabled={!rules.allowValueEditing}
        readOnly={!rules.allowValueEditing}
      />
    </VariableTypeCommon>
  )
}