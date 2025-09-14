'use client'

import { ReactElement, } from "react";
import { useTranslation } from "react-i18next";
import { Locales } from "i18n.config";
import { IconAlertTriangleFilled, IconCircleCheckFilled, IconCircleXFilled } from "@tabler/icons-react";
import { useRecipe } from "../contextProvider";

// TODO: Rename
export function RecipeErrorAndWarnings() {
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

// TODO: remove this once things work
export function DEBUG_Recipe() {
  return <pre style={{ width: '90ch', overflowX: 'scroll' }}>
    {JSON.stringify(useRecipe(), null, 2)}
  </pre>
}

// TODO: Rename
/* 
 * Form interacting components
 */
export function ResultingDataSeries({ FormElement }: { FormElement?: ReactElement }) {
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

// TODO: Rename
export function ResultingRecipe({ FormElement }: { FormElement?: ReactElement }) {
  const { recipe } = useRecipe();

  if (!recipe) {
    return null;
  }

  return (<>
    {FormElement && <FormElement.type {...(FormElement.props || {})} value={JSON.stringify(recipe)} />}
  </>);
}