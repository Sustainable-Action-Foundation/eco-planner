"use client"

import { useRecipe } from "@/components/recipe/contextProvider";
import { RecipeExternalDataset } from "@/functions/recipe-parser/types";
import { useTranslation } from "react-i18next";
import { InputRules, defaultInputRules } from "./rules";
import { changeDataset, changeExternalSelection, changeTable } from "@/components/recipe/contextFunctions";
import VariableTypeCommon from "./common";
import VectorIndexPicker from "./vectorIndexPicker";
import { ExternalDataset } from "@/lib/api/utility";

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
      <div className="floating-label inline-block" style={{ "--background": "linear-gradient(var(--gray-95) 50%, white 100%)" } as React.CSSProperties}>
        <label htmlFor="external-variable-dataset">
          {t("components:recipe_editor.dataset")}
        </label>
        <select
          id="external-variable-dataset" /* TODO: This ID needs to be dynamic */
          defaultValue={variable.dataset || ""}
          disabled={!rules.allowValueEditing}
          onChange={(e) => changeDataset(name, e.target.value, setRecipe)}
        >
          <option disabled value="">{t("components:recipe_editor.select_dataset")}</option>
          {/* <option value={variable.dataset}>{variable.dataset}</option> */}
          {ExternalDataset.knownDatasetKeys.map((datasetName, i) => (
            <option key={`datasetOption-${i}`} value={datasetName}>
              {datasetName}
            </option>
          ))}
        </select>
      </div>

      <div className="floating-label inline-block" style={{ "--background": "linear-gradient(var(--gray-95) 50%, white 100%)" } as React.CSSProperties}>
        <label htmlFor="external-variable-table">
          {t("components:recipe_editor.table")}
        </label>
        <input
          id="external-variable-table" /* TODO: This ID needs to be dynamic */
          defaultValue={variable.tableId || ""}
          onChange={(e) => changeTable(name, e.target.value, setRecipe)}
          type="text"
          disabled={!rules.allowValueEditing}
          placeholder=" "
        />
      </div>

      <div className="floating-label inline-block" style={{ "--background": "linear-gradient(var(--gray-95) 50%, white 100%)" } as React.CSSProperties}>
        <label htmlFor="external-variable-selection">
          {t("components:recipe_editor.selection")}
        </label>
        <input
          id="external-variable-selection" /* TODO: This ID needs to be dynamic */
          defaultValue={JSON.stringify(variable.selection) || ""}
          onChange={(e) => changeExternalSelection(name, e.target.value, setRecipe)}
          type="text"
          disabled={!rules.allowValueEditing}
          placeholder=" "
        />
      </div>

      <div className="floating-label inline-block" style={{ "--background": "linear-gradient(var(--gray-95) 50%, white 100%)" } as React.CSSProperties}>
        <label htmlFor="variable-tree-vector-index-picker">
          {t("components:recipe_editor.vector_index_picker_label")}
        </label>
        <VectorIndexPicker rules={rules} varName={name} />
      </div>
    </VariableTypeCommon>
  )
}


export function VariableTypeExternalSimple({
  name,
  rules
}: {
  name: string,
  rules?: InputRules
}) {
  const { t } = useTranslation("components");
  const { recipe, setRecipe } = useRecipe();
  const variable = recipe?.variables[name] as RecipeExternalDataset;

  rules = { ...defaultInputRules, ...rules };

  return (
    <div className="flex gap-25"> {/* TODO: Figure out how to deal with labels here */}
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
        className="inline width-auto"
        defaultValue={variable.tableId || ""}
        onChange={(e) => changeTable(name, e.target.value, setRecipe)}
        type="text"
        disabled={!rules.allowValueEditing}
        placeholder={t("components:recipe_editor.table")}
      />
      <input
        className="inline width-auto"
        defaultValue={JSON.stringify(variable.selection) || ""}
        onChange={(e) => changeExternalSelection(name, e.target.value, setRecipe)}
        type="text"
        disabled={!rules.allowValueEditing}
        placeholder={t("components:recipe_editor.selection")}
      />
    </div>
  )
}