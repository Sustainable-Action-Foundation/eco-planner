"use client"

import { VectorIndexPickerOptions } from "@/functions/recipe-parser/types";
import { useTranslation } from "react-i18next";
import { InputRules, defaultInputRules } from "./rules";

// TODO: Fix labels
export default function VectorIndexPicker({ rules }: { rules?: InputRules }) {
  const { t } = useTranslation("components");

  rules = { ...defaultInputRules, ...rules };

  return <select
    defaultValue={VectorIndexPickerOptions.Default}
    disabled={!rules.allowValueEditing}
  >
    <option value={VectorIndexPickerOptions.Whole}>{t("components:recipe_editor.pick_whole")}</option>
    <option value={VectorIndexPickerOptions.Last}>{t("components:recipe_editor.pick_last")}</option>
    <option value={VectorIndexPickerOptions.First}>{t("components:recipe_editor.pick_first")}</option>
    <option value={VectorIndexPickerOptions.Median}>{t("components:recipe_editor.pick_median")}</option>
    <option value={VectorIndexPickerOptions.Mean}>{t("components:recipe_editor.pick_mean")}</option>
  </select>;
}