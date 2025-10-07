"use client"

import { ReactElement, } from "react";
import { useTranslation } from "react-i18next";
import { useRecipe } from "../../contextProvider"; 

// TODO: Does this take historical data into account? Do we need to account for it?
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

      {
        /* TODO: We want the unit to be visible
        TODO: We also want a non-generic title which is visible
      <strong className="block bold text-align-center">
        {t("components:copy_and_scale.resulting_data_series")}
        {resultingUnit ? ` (${resultingUnit})` : ""}
      </strong>
      */}

      <div
        className="grid padding-bottom-50 margin-top-50 padding-inline-50"
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
            {(value as number)?.toFixed(1) || "-"}
          </div>
        ))}
      </div>
    </>
  )
}