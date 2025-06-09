"use client";

import { dataSeriesDataFieldNames } from "@/types";
import Image from "next/image";
import { useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import styles from "./dataSeriesInput.module.css";
import { dataSeriesPattern, isValidPastedInput, isValidSingleInputForGrid, isValidSingleInputForTextField } from "./utils";
import { IconCaretDownFilled, IconCaretUpFilled } from "@tabler/icons-react";

export default function DataSeriesInput({
  dataSeriesString, // TODO - rename "dataSeriesString" to "dataSeriesInput" or "initialValue" (latter suggested by chatgpt)
  inputName = "dataSeries",
  inputId = "dataSeries",
  labelKey = "forms:data_series_input.data_series",
}: {
  dataSeriesString?: string;
  inputName?: string;
  inputId?: string;
  labelKey?: string;
}) {

  const { t } = useTranslation("forms");
  const [dataSeriesValues, setDataSeriesValues] = useState<string[]>(
    dataSeriesString && dataSeriesString.length > 0
      ? dataSeriesString.split(/[\t;]/).slice(0, dataSeriesDataFieldNames.length)
      : Array.from({ length: dataSeriesDataFieldNames.length }, () => ""),
  );
  const isPasting = useRef(false);
  const [tableIsVisible, setTableIsVisible] = useState(true);

  // TODO - this might not be necessary, since we are using the dataSeriesString prop to set the initial values
  // useEffect(() => {
  //   console.warn("dataSeriesString changed")
  //   if (dataSeriesString) {
  //     setDataSeriesValues(
  //       dataSeriesString
  //         .split(/[\t;]/)
  //         .slice(0, dataSeriesDataFieldNames.length)
  //     );
  //   }
  // }, [dataSeriesString]);

  function handleValueChange(e: React.ChangeEvent<HTMLInputElement>, index: number) {
    if (isPasting.current) return;

    const newValues = [...dataSeriesValues];
    newValues[index] = e.target.value;
    setDataSeriesValues(newValues);
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>, startIndex: number) {
    isPasting.current = true;
    // Splits input at tabs, newlines, carriage returns, vertical tabs, and semicolons (other whitespace is trimmed a few lines below)
    const pastedValues = e.clipboardData.getData("text").split(/[\t\n\r\v;]/);
    const newValues = [...dataSeriesValues];

    for (let i = 0; i < pastedValues.length && i + startIndex < dataSeriesDataFieldNames.length; i++) {
      const targetIndex = startIndex + i;
      if (targetIndex < newValues.length) {
        newValues[targetIndex] = pastedValues[i].trim();
      } else {
        newValues.push(pastedValues[i].trim());
      }
    }

    setDataSeriesValues(newValues);

    setTimeout(() => {
      isPasting.current = false;
    }, 0);
  }

  return (
    <>
      <fieldset className="block margin-block-100 fieldset-unset-pseudo-class">
        <legend
          className="flex flex-wrap-wrap gap-100 justify-content-space-between align-items-center width-100 margin-bottom-100 padding-bottom-25"
          style={{ borderBottom: '1px solid var(--gray)' }}
        >
          {t(labelKey)}
          <button
            type="button"
            className="round transparent flex gap-50 align-items-center padding-inline-75"
            title={tableIsVisible ? t("forms:data_series_input.hide_table") : t("forms:data_series_input.show_table")}
            onClick={() => { setTableIsVisible(!tableIsVisible) }}
          >
            {tableIsVisible ? (
              <>
                {t("forms:data_series_input.hide_table")}
                <IconCaretUpFilled width={20} height={20} style={{minWidth: '20px'}} />
              </>
            ) : (
              <>
                {t("forms:data_series_input.show_table")}
                <IconCaretDownFilled width={20} height={20} style={{minWidth: '20px'}} />
              </>
            )}
          </button>
        </legend>
        {/* TODO: Make this allow .csv files and possibly excel files */}
        <label className={`${styles['spreadsheet-label']} grid padding-left-100 gap-100 gray-90 font-weight-600`}>
          <span className="padding-50 text-align-center">{t("forms:data_series_input.year")}</span>
          <span className="padding-50 padding-left-100" style={{ borderLeft: '1px solid var(--gray)' }}>{t("forms:data_series_input.value")}</span>
        </label>
        {tableIsVisible && (
          <>
            {dataSeriesDataFieldNames.map((value, index) => (
              <label
                key={`year-${index}`}
                className={`${styles['spreadsheet-label']} grid place-items-center padding-left-100 gap-100`}
              >
                {value.replace("val", "")}
                <input
                  type="number"
                  id={value}
                  name={`${inputName}Input`}
                  value={dataSeriesValues[index] ?? ""}
                  className={`${styles['spreadsheet-input']} purewhite`}
                  onWheel={(e) => {
                    // Prevent the value from changing when scrolling
                    (e.target as HTMLInputElement).blur();

                    // Refocus the input on the next tick to prevent the scroll from changing the value
                    setTimeout(() => {
                      (e.target as HTMLInputElement).focus();
                    }, 0);
                  }}
                  onChange={(e) => handleValueChange(e, index)}
                  onBeforeInput={(e) => {
                    // Make sure the input is valid
                    const inputEvent = e.nativeEvent as InputEvent;
                    if (inputEvent.data && !isValidSingleInputForGrid(inputEvent.data)) {
                      e.preventDefault();
                    }
                  }}
                  onPaste={(e) => {
                    // Make sure the pasted input is valid before handling paste
                    const pasted = e.clipboardData.getData("text");
                    if (!isValidPastedInput(pasted)) {
                      e.preventDefault();
                    } else {
                      handlePaste(e, index);
                    }
                  }}
                />
              </label>
            ))}
          </>
        )}
      </fieldset>

      <details className="margin-block-75">
        <summary>
          {t("forms:data_series_input.advanced")}
        </summary>
        <p>
          <Trans
            i18nKey={"forms:data_series_input.data_series_advanced_info"}
            components={{ strong: <strong />, br: <br /> }}
          />
        </p>

        <label className="block margin-block-75">
          {t(labelKey)}

          {/* This input gives the user the option to enter their data series as a string */}
          <input
            type="text"
            name={inputName}
            required
            id={inputId}
            pattern={dataSeriesPattern}
            title={t("forms:data_series_input.data_series_tooltip")}
            value={dataSeriesValues.join(";")}
            className="margin-block-25"
            onBeforeInput={(e) => {
              if (isPasting.current) return;

              const inputEvent = e.nativeEvent as InputEvent;
              if (inputEvent.data && !isValidSingleInputForTextField(inputEvent.data)) {
                e.preventDefault();
              }
            }}
            onPaste={(e) => {
              const pasted = e.clipboardData.getData("text");
              if (!isValidPastedInput(pasted)) {
                e.preventDefault();
                return;
              }

              isPasting.current = true;
              setTimeout(() => {
                isPasting.current = false;
              }, 0);
            }}
            onChange={(e) => {
              const values = e.target.value
                .split(/[\t;]/)
                .map((v) => v.trim())
                .slice(0, dataSeriesDataFieldNames.length);
              setDataSeriesValues(values);
            }}
          />
        </label>
      </details>
    </>
  )
}