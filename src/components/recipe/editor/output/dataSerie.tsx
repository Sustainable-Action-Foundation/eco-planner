"use client"

import { ReactElement, } from "react";
import { useTranslation } from "react-i18next";
import { useRecipe } from "../../contextProvider"; 

export default function OutputDataSeries({ FormElement }: { FormElement?: ReactElement }) {
  const { t } = useTranslation("components");
  const { resultingDataSeries, resultingUnit } = useRecipe();

  if (!resultingDataSeries) {
    return null;
  }

  return (
    <>
      {/* Hidden input for reading into the form */}
      {FormElement && <FormElement.type {...(FormElement.props || {})} value={JSON.stringify(resultingDataSeries)} />}

      {/* TODO: Keep unit but not title?
      <strong className="block bold text-align-center">
        {t("components:copy_and_scale.resulting_data_series")}
        {resultingUnit ? ` (${resultingUnit})` : ""}
      </strong>
      */}

      <div
        className="grid gap-100 padding-bottom-50"
        style={{
          gridTemplateColumns: `repeat(${Object.keys(resultingDataSeries).length}, 1fr)`,
          gridTemplateRows: 'auto auto',
          overflowX: 'scroll',
          scrollbarWidth: 'thin',
          contain: 'inline-size',
        }}
      >
        {Object.keys(resultingDataSeries).map((year, i) => (
          <div className="text-align-center" style={{ gridRow: 1 }} key={i + "resulting-data-series-header" + year}>{year.replace("val", "")}</div>
        ))}
        {Object.values(resultingDataSeries).map((value, i) => (
          <div className="text-align-center" style={{ gridRow: 2 }} key={i + "resulting-data-series-value" + String(value)}>{(value as number)?.toFixed(1) || "-"}</div>
        ))}
      </div>
    </>
  )
}