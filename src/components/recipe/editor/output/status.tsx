"use client"

import { useTranslation } from "react-i18next";
import { Locales } from "i18n.config";
import { IconAlertTriangleFilled, IconCircleCheckFilled, IconCircleXFilled } from "@tabler/icons-react";
import { useRecipe } from "../../contextProvider"; 

export default function OutputStatus() {
  const { t } = useTranslation("components");
  const { error, warnings } = useRecipe();

  return (
    <>
      {error ?
        <div lang={Locales.enSE} className="flex align-items-flex-start gap-50 margin-block-50" style={{ color: 'red', fontSize: '14px' }}>
          <IconCircleXFilled width={16} height={16} style={{ minWidth: '16px', marginTop: '2px' }} color="red" aria-label={t("components:copy_and_scale.evaluation_error_title")} />
          {error}
        </div>
        : null}

      {!error ?
        <div lang={Locales.enSE} className="flex align-items-flex-start gap-50 margin-block-50" style={{ color: 'green', fontSize: '14px' }}>
          <IconCircleCheckFilled width={16} height={16} style={{ minWidth: '16px', marginTop: '2px' }} color="green" /> {/* TODO: Aria-label */}
          Recipe is valid
        </div>
        : null}

      {warnings.length > 0 ?
        <ul className="margin-0 padding-0" lang={Locales.enSE} style={{ color: 'darkorange', listStyle: 'none', fontSize: '14px' }}>
          {warnings.map((warning, i) => (
            <li key={i} className="flex align-items-flex-start gap-50 margin-block-50">
              <IconAlertTriangleFilled width={16} height={16} style={{ minWidth: '16px', marginTop: '2px' }} color="darkorange" aria-label={t("components:copy_and_scale.evaluation_warning_title")} /> {/* TODO: Check this translation */}
              {warning}
            </li>
          ))}
        </ul>
        : null}
    </>
  );
}