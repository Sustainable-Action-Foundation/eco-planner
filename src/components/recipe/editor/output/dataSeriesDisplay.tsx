"use client"

import { useTranslation } from "react-i18next";
import { useRecipe } from "../../context/recipeContext.use";
import { IconInfoCircle } from "@tabler/icons-react";
import { Locales } from "i18n.config";

// TODO: Does this take historical data into account? Do we need to account for it?
export default function OutputDataSeries() {
  const { t } = useTranslation("components");
  const { resultingDataSeries, resultingUnit } = useRecipe();

  if (!resultingDataSeries) {
    return <div style={{ fontSize: '14px' }} lang={Locales.enSE} className="flex align-items-flex-start gap-50 margin-top-50">
      <IconInfoCircle width={16} height={16} style={{ minWidth: '16px', marginTop: '2px' }} color="var(--gray-70)" aria-label={t("components:recipe_editor.status.no_issues_icon_aria_label")} />
      {t("components:recipe_editor.missing_resulting_data_series")}
    </div>;
  }

  return (
    <>
      {/* TODO: We also want a non-generic title which is visible */}
      <strong className="block bold text-align-center">
        {t("components:copy_and_scale.resulting_data_series")}
        {resultingUnit ? ` (${resultingUnit})` : ""}
      </strong>

      <div
        className="grid padding-bottom-100 margin-top-50 padding-inline-50"
        style={{
          gridTemplateColumns: `repeat(${Object.keys(resultingDataSeries).length}, 1fr)`,
          gridTemplateRows: 'auto auto',
          overflowX: 'scroll',
          scrollbarWidth: 'thin',
          contain: 'inline-size',
          columnGap: '1rem',
          fontSize: '14px'
        }}
      >
        {Object.keys(resultingDataSeries).map((year, i) => (
          <div
            key={i + "resulting-data-series-header" + year}
            className={`font-weight-600 text-align-center ${i === 0 ? "" : "padding-left-100"}`}
            style={{ gridRow: 1, borderLeft: i === 0 ? 'none' : '1px solid var(--gray-70)' }}
          >
            {year.replace("val", "")}
          </div>
        ))}
        {Object.values(resultingDataSeries).map((value, i) => (
          <div
            key={i + "resulting-data-series-value" + String(value)}
            className={`text-align-center ${i === 0 ? "" : "padding-left-100"}`}
            style={{ gridRow: 2, borderLeft: i === 0 ? 'none' : '1px solid var(--gray-70)' }}
          >
            {value?.toFixed(1) || "-"}
          </div>
        ))}
      </div>
    </>
  )
}