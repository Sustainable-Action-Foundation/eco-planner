"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import styles from "./dataSeriesInput.module.css";
import { IconCaretDownFilled, IconCaretUpFilled } from "@tabler/icons-react";
import { isISOIshDate } from "@/types";
import type { DateValuesWithUnit, ISOIshDate } from "@/types";

export default function DateValuesInput({
  initialDateValues = { unit: undefined, dateValues: {} },

  dateValues: controlledDateValues,
  dateValuesSetter,

  outputFormElement,
  label,
}: {
  initialDateValues?: DateValuesWithUnit | undefined;

  /** Controlled input type thing */
  dateValues?: DateValuesWithUnit | undefined;
  /** In case changes in the data series needs to be reported upwards instantly, not through the form */
  dateValuesSetter?: React.Dispatch<React.SetStateAction<DateValuesWithUnit>> | undefined;

  /** You may choose whether to read the result of this component via a set state action or forms */
  outputFormElement?: React.ReactElement<HTMLInputElement> | undefined;
  /** To translate, provide a t(key) so this receives a pre translated label */
  label: string;
}) {
  const { t } = useTranslation("forms");

  const [tableIsVisible, setTableIsVisible] = useState(true);

  const [uncontrolledDateValues, setUncontrolledDateValues] = useState<DateValuesWithUnit>(initialDateValues);
  const effectiveDateValues = controlledDateValues ?? uncontrolledDateValues;

  const [startDate, setStartDate] = useState<ISOIshDate>(`2020-01-01T00:00:00.000Z`);
  const [endDate, setEndDate] = useState<ISOIshDate>(`2050-01-01T00:00:00.000Z`);

  const [visualStartYear, setVisualStartYear] = useState<string>(String(new Date(startDate).getUTCFullYear()));
  const [visualEndYear, setVisualEndYear] = useState<string>(String(new Date(endDate).getUTCFullYear()));

  const updateDateValues = (updater: (prev: DateValuesWithUnit) => DateValuesWithUnit) => {
    const next = updater(effectiveDateValues);
    if (controlledDateValues === undefined) {
      setUncontrolledDateValues(next);
    }
    if (dateValuesSetter) {
      dateValuesSetter(next);
    }
  };

  const startISO = `${visualStartYear}-01-01T00:00:00.000Z`;
  const endISO = `${visualEndYear}-01-01T00:00:00.000Z`;
  const isStartISOValid = useMemo(() => isISOIshDate(startISO), [startISO]);
  const isEndISOValid = useMemo(() => isISOIshDate(endISO), [endISO]);

  const isStartDateValid = useMemo(
    () =>
      isStartISOValid
      && (!isEndISOValid || Number(visualStartYear) < Number(visualEndYear)),
    [isStartISOValid, isEndISOValid, visualStartYear, visualEndYear],
  );
  const isEndDateValid = useMemo(
    () =>
      isEndISOValid
      && (!isStartISOValid || Number(visualEndYear) > Number(visualStartYear)),
    [isEndISOValid, isStartISOValid, visualEndYear, visualStartYear],
  );

  useEffect(() => setVisualStartYear(String(new Date(startDate).getUTCFullYear())), [startDate]);
  useEffect(() => setVisualEndYear(String(new Date(endDate).getUTCFullYear())), [endDate]);

  const dates = useMemo<ISOIshDate[]>(() => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const result: ISOIshDate[] = [];
    for (let year = start.getUTCFullYear(); year <= end.getUTCFullYear(); year++) {
      const step = new Date(Date.UTC(year, 0, 1)).toISOString();
      if (!isISOIshDate(step)) throw new Error("Generated date is not ISOIshDate");
      result.push(step);
    }
    return result;
  }, [startDate, endDate]);

  return (
    <>
      {outputFormElement && React.cloneElement(outputFormElement, {
        value: JSON.stringify({ dateValues: effectiveDateValues.dateValues, unit: effectiveDateValues.unit } satisfies DateValuesWithUnit),
        type: "hidden",
        hidden: true,
        readOnly: true,
      })}

      <fieldset className="block fieldset-unset-pseudo-class">
        {/* Label and expand button */}
        <legend
          className="flex flex-wrap-wrap gap-100 justify-content-space-between align-items-center width-100 margin-bottom-100 padding-bottom-25"
          style={{ borderBottom: '1px solid var(--gray)' }}
        >
          {label}
          <button
            type="button"
            className="round transparent flex gap-50 align-items-center padding-inline-75"
            title={tableIsVisible
              ? t("forms:data_series_input.hide_table")
              : t("forms:data_series_input.show_table")
            }
            onClick={() => { setTableIsVisible(!tableIsVisible) }}
          >
            {tableIsVisible
              ? <>
                {t("forms:data_series_input.hide_table")}
                <IconCaretUpFilled width={20} height={20} style={{ minWidth: '20px' }} aria-hidden="true" />
              </>
              : <>
                {t("forms:data_series_input.show_table")}
                <IconCaretDownFilled width={20} height={20} style={{ minWidth: '20px' }} aria-hidden="true" />
              </>
            }
          </button>
        </legend>

        {/* Start and end year */}
        <div className="flex flex-wrap-wrap gap-100 margin-bottom-100">
          <label>
            {t("forms:data_series_input.start_year")}
            <input
              placeholder="2020"
              type="number"
              className={`block margin-top-25 ${!isStartDateValid ? 'border-color-red' : ''}`}
              value={visualStartYear}
              onChange={(e) => {
                const nextYear = e.target.value;
                setVisualStartYear(nextYear);
                const newDate = `${nextYear}-01-01T00:00:00.000Z`;
                if (isISOIshDate(newDate) && (!isEndISOValid || Number(nextYear) < Number(visualEndYear))) {
                  setStartDate(newDate);
                }
              }}
            />
            {!isStartDateValid && (
              <span role="alert" className="block text-color-red margin-top-25">
                {t("forms:data_series_input.invalid_start_year")}
              </span>
            )}
          </label>
          <label>
            {t("forms:data_series_input.end_year")}
            <input
              placeholder="2050"
              type="number"
              className={`block margin-top-25 ${!isEndDateValid ? 'border-color-red' : ''}`}
              value={visualEndYear}
              onChange={(e) => {
                const nextYear = e.target.value;
                setVisualEndYear(nextYear);
                const newDate = `${nextYear}-01-01T00:00:00.000Z`;
                if (isISOIshDate(newDate) && (!isStartISOValid || Number(nextYear) > Number(visualStartYear))) {
                  setEndDate(newDate);
                }
              }}
            />
            {!isEndDateValid && (
              <span role="alert" className="block text-color-red margin-top-25">
                {t("forms:data_series_input.invalid_end_year")}
              </span>
            )}
          </label>
        </div>

        {/* Table header */}
        <label className={`${styles['spreadsheet-label']} grid padding-left-100 gap-100 gray-90 font-weight-600`}>
          <span className="padding-50 text-align-center">{t("forms:data_series_input.year")}</span>
          <span className="padding-50 padding-left-100" style={{ borderLeft: '1px solid var(--gray)' }}>{t("forms:data_series_input.value")}</span>
        </label>
        {/* Table */}
        {tableIsVisible && (
          <>
            {dates.map(date => (
              <label
                key={`date-values-input-row-${date}`}
                className={`${styles['spreadsheet-label']} grid place-items-center padding-left-100 gap-100`}
              >
                {new Date(date).getUTCFullYear()}
                <input
                  type="number"
                  name={date}
                  className={`${styles['spreadsheet-input']} purewhite`}

                  value={effectiveDateValues.dateValues[date] ?? ""}
                  onChange={(e) => {
                    updateDateValues(prev => ({
                      ...prev,
                      dateValues: {
                        ...prev.dateValues,
                        [date]: (e.target.value === "") ? undefined : parseFloat(e.target.value),
                      },
                    }));
                  }}

                  // Prevent other than valid characters from being input
                  onBeforeInput={(e) => {
                    const inputEvent = e.nativeEvent;
                    if (
                      inputEvent.data
                      && !/^[0-9.,-]+$/.test(inputEvent.data)
                    ) {
                      e.preventDefault();
                    }
                  }}

                  // Prevent changing number input value with mouse wheel
                  onWheel={() => {
                    if (
                      typeof document !== "undefined"
                      && document.activeElement instanceof HTMLInputElement
                      && document.activeElement.type === "number"
                    ) {
                      document.activeElement.blur();
                    }
                  }}

                // TODO: add paste handling that will cooperate with the new floating date format
                />
              </label>
            ))}
          </>
        )}
      </fieldset>
    </>
  )
}