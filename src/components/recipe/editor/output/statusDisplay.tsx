"use client"

import { useTranslation } from "react-i18next";
import { Locales } from "i18n.config";
import { IconAlertTriangleFilled, IconCircleCheckFilled, IconCircleXFilled, IconInfoCircle } from "@tabler/icons-react";
import { useRecipe } from "../../context/recipeContext.provider";
import { isEmptyRecipe } from "@/functions/recipe-parser/types";

export default function OutputStatus({
  hideWhenNoRecipe = false,
}: {
  hideWhenNoRecipe?: boolean,
}) {
  const { t } = useTranslation("components");
  const { recipe, error, warnings } = useRecipe();

  if (
    (!recipe || isEmptyRecipe(recipe))
    && hideWhenNoRecipe
  ) {
    return null;
  }

  return (
    <>
      {/* Errors! */}
      {error ?
        <div lang={Locales.enSE} className="flex align-items-flex-start gap-50 margin-block-50" style={{ color: 'red', fontSize: '14px' }}>
          <IconCircleXFilled width={16} height={16} style={{ minWidth: '16px', marginTop: '2px' }} color="red" aria-label={t("components:copy_and_scale.evaluation_error_title")} />
          {`[EN] ${error}`}
        </div>
        : null}

      {/* No errors */}
      {!error && recipe && (Object.values(recipe?.variables).length !== 0 && recipe.eq.trim() !== "") ?
        <div lang={Locales.enSE} className="flex align-items-flex-start gap-50 margin-block-50" style={{ color: 'green', fontSize: '14px' }}>
          <IconCircleCheckFilled width={16} height={16} style={{ minWidth: '16px', marginTop: '2px' }} color="green" /> {/* TODO: Aria-label */}
          {t("components:recipe_editor.no_errors")}
        </div>
        : null}

      {/* Non breaking warnings */}
      {warnings.length > 0 ?
        <ul lang={Locales.enSE} className="margin-0 padding-0" style={{ color: 'darkorange', listStyle: 'none', fontSize: '14px' }}>
          {warnings.map((warning, i) => (
            <li key={i} className="flex align-items-flex-start gap-50 margin-block-50">
              <IconAlertTriangleFilled width={16} height={16} style={{ minWidth: '16px', marginTop: '2px' }} color="darkorange" aria-label={t("components:copy_and_scale.evaluation_warning_title")} /> {/* TODO: Check this translation */}
              {`[EN] ${warning}`}
            </li>
          ))}
        </ul>
        : null}

      {/* All good */}
      {warnings.length === 0 && !error &&
        <div className="flex align-items-flex-start gap-50 margin-block-50" style={{ fontSize: '14px' }} >
          <IconInfoCircle width={16} height={16} style={{ minWidth: '16px', marginTop: '2px' }} color="var(--gray-70)" aria-label={t("components:recipe_editor.status.no_issues_icon_aria_label")} />
          {t("components:recipe_editor.no_warnings")}
        </div>
      }
    </>
  );
}