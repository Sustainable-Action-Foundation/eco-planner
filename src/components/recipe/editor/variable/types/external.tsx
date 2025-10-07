"use client"

import { useRecipe } from "@/components/recipe/contextProvider";
import { RecipeExternalDataset } from "@/functions/recipe-parser/types";
import { useTranslation } from "react-i18next";
import { InputRules, defaultInputRules } from "./rules";
import { changeDataset, changeExternalSelection, changeTable } from "@/components/recipe/contextFunctions";
import VariableTypeCommon from "./common";
import VectorIndexPicker from "./vectorIndexPicker";
import { ExternalDataset } from "@/lib/api/utility";

// TODO: I18n
// TODO: Fix labels
export default function VariableTypeExternal({
  name,
  rules,
}: {
  name: string;
  rules?: InputRules;
}) {
  const { t } = useTranslation("components");
  const { recipe, setRecipe } = useRecipe();
  const variable = recipe?.variables[name] as RecipeExternalDataset;

  rules = { ...defaultInputRules, ...rules };

  return (
    <VariableTypeCommon
      name={name}
      rules={rules}
    >
      <select
        defaultValue={variable.dataset || ""}
        disabled={!rules.allowValueEditing}
        onChange={(e) => changeDataset(name, e.target.value, setRecipe)}
      >
        <option value="">{t("components:recipe_editor.dataset")}</option>
        {/* <option value={variable.dataset}>{variable.dataset}</option> */}
        {ExternalDataset.knownDatasetKeys.map((datasetName, i) => (
          <option key={`datasetOption-${i}`} value={datasetName}>
            {datasetName}
          </option>
        ))}
      </select>

      <input
        defaultValue={variable.tableId || ""}
        onChange={(e) => changeTable(name, e.target.value, setRecipe)}
        type="text"
        disabled={!rules.allowValueEditing}
        placeholder={t("components:recipe_editor.table")}
      />

      <input
        defaultValue={JSON.stringify(variable.selection) || ""}
        onChange={(e) => changeExternalSelection(name, e.target.value, setRecipe)}
        type="text"
        disabled={!rules.allowValueEditing}
        placeholder={t("components:recipe_editor.selection")}
      />

      <VectorIndexPicker rules={rules} />
    </VariableTypeCommon>
  )
}