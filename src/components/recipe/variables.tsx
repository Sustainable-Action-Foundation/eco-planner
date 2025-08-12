import { RecipeVariableType } from "@/functions/recipe-parser/types";
import { IconTrash } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

function CommonVariable({ children }: { children?: React.ReactNode }) {
  const { t } = useTranslation("components");

  return <li style={{
    display: 'flex',
    columnGap: '1ch',
  }}>
    {/* Variable name */}
    <input type="text" placeholder={t("components:recipe_editor.variable_name_placeholder")} style={{ width: '17ch' }} />

    {/* Data type */}
    <select>
      <option value={RecipeVariableType.DataSeries}>{t("components:recipe_editor.data_series")}</option>
      <option value={RecipeVariableType.External}>{t("components:recipe_editor.external_data")}</option>
      <option value={RecipeVariableType.Scalar}>{t("components:recipe_editor.scalar")}</option>
    </select>

    {/* Variable specific inputs */}
    <div style={{ flex: 1, display: 'flex', flexFlow: 'row nowrap', columnGap: 'inherit' }}>
      {children}
    </div>

    {/* Unit */}
    <input type="text" placeholder={t("components:recipe_editor.variable_unit_placeholder")} style={{ width: '10ch' }} />

    {/* Delete */}
    <button type="button" style={{
      width: '5ch',
      backgroundColor: 'red',
      color: 'white',
      fontWeight: 'bold',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <IconTrash />
    </button>
  </li>;
}

export function ScalarVariable() {
  const { t } = useTranslation("components");

  return <CommonVariable>
    <input type="number" placeholder={t("components:recipe_editor.scalar")} />
  </CommonVariable>;
}

export function DataSeriesVariable() {
  const { t } = useTranslation("components");

  return <CommonVariable>
    {/* Roadmap */}
    <select>
      <option value="">{t("common:recipe_editor.select_roadmap")}</option>
    </select>

    {/* Goal or effect */}
    <select>
      <option value="">{t("components:recipe_editor.goal_or_effect")}</option>
    </select>

    {/* Pick */}
    <VectorIndexPicker />
  </CommonVariable>;
}

export function ExternalVariable() {
  const { t } = useTranslation("components");

  return <CommonVariable>
    {/* Dataset */}
    <select>
      <option value="">{t("components:recipe_editor.dataset")}</option>
    </select>

    {/* Table */}
    <select>
      <option value="">{t("components:recipe_editor.table")}</option>
    </select>

    {/* Selection */}
    <input type="text" placeholder={t("components:recipe_editor.selection")} />

  </CommonVariable>;
}

export enum VectorIndexPickerType {
  Whole = "whole",
  Last = "last",
  First = "first",
  Median = "median",
  Mean = "mean",
}

function VectorIndexPicker() {
  const { t } = useTranslation("components");

  return <select>
    <option value={VectorIndexPickerType.Whole}>{t("components:recipe_editor.pick_whole")}</option>
    <option value={VectorIndexPickerType.Last}>{t("components:recipe_editor.pick_last")}</option>
    <option value={VectorIndexPickerType.First}>{t("components:recipe_editor.pick_first")}</option>
    <option value={VectorIndexPickerType.Median}>{t("components:recipe_editor.pick_median")}</option>
    <option value={VectorIndexPickerType.Mean}>{t("components:recipe_editor.pick_mean")}</option>
  </select>;
}