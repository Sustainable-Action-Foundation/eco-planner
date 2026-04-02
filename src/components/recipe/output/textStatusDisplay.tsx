"use client"

import { useTranslation } from "react-i18next";
import { Locales } from "i18n.config";
import { IconAlertTriangleFilled, IconCircleCheckFilled, IconCircleXFilled, IconInfoCircle } from "@tabler/icons-react";
import { useRecipe } from "@/components/recipe";
import { isEmptyRecipe } from "@/functions/recipe";

export function TextStatus({
  showAllGood = true,
}: {
  showAllGood?: boolean,
}): React.ReactNode[] {
  const { t } = useTranslation("components");
  const { recipe, error, warnings } = useRecipe();

  const out: React.ReactNode[] = [];

  // Template guard
  if (recipe.isTemplate()) {
    out.push(
      <div lang={Locales.enSE} key="template" className="flex align-items-flex-start gap-50 margin-block-50" style={{ color: 'blue', fontSize: '14px' }}>
        <IconInfoCircle width={16} height={16} style={{ minWidth: '16px', marginTop: '2px' }} color="blue" aria-label={t("components:recipe_editor.status.template_recipe_icon_aria_label")} />
        {t("components:recipe_editor.status.template_recipe")}
      </div>
    );
    return out;
  }

  // Errors
  if (error) {
    out.push(
      <div lang={Locales.enSE} key="error" className="flex align-items-flex-start gap-50 margin-block-50" style={{ color: 'red', fontSize: '14px' }}>
        <IconCircleXFilled width={16} height={16} style={{ minWidth: '16px', marginTop: '2px' }} color="red" aria-label={t("components:copy_and_scale.evaluation_error_title")} />
        {`[EN] ${error}`}
      </div>
    );
  }

  // No errors, but maybe warnings so continue
  if (!error && !isEmptyRecipe(recipe)) {
    out.push(
      <div lang={Locales.enSE} key="no-error" className="flex align-items-flex-start gap-50 margin-block-50" style={{ color: 'green', fontSize: '14px' }}>
        <IconCircleCheckFilled width={16} height={16} style={{ minWidth: '16px', marginTop: '2px' }} color="green" /> {/* TODO: Aria-label */}
        {t("components:recipe_editor.no_errors")}
      </div>
    );
  }

  // Non breaking warnings
  if (warnings.length > 0) {
    out.push(
      <ul lang={Locales.enSE} key="warnings" className="margin-0 padding-0" style={{ color: 'darkorange', listStyle: 'none', fontSize: '14px' }}>
        {warnings.map((warning, i) => (
          <li key={i} className="flex align-items-flex-start gap-50 margin-block-50">
            <IconAlertTriangleFilled width={16} height={16} style={{ minWidth: '16px', marginTop: '2px' }} color="darkorange" aria-label={t("components:copy_and_scale.evaluation_warning_title")} /> {/* TODO: Check this translation */}
            {`[EN] ${warning}`}
          </li>
        ))}
      </ul>
    );
  }

  // All good, no warnings
  if (showAllGood && warnings.length === 0 && !error) {
    out.push(
      <div lang={Locales.enSE} key={"all-good"} className="flex align-items-flex-start gap-50 margin-block-50" style={{ fontSize: '14px' }} >
        <IconInfoCircle width={16} height={16} style={{ minWidth: '16px', marginTop: '2px' }} color="var(--gray-70)" aria-label={t("components:recipe_editor.status.no_issues_icon_aria_label")} />
        {t("components:recipe_editor.no_warnings")}
      </div>
    );
  }

  return out;
}