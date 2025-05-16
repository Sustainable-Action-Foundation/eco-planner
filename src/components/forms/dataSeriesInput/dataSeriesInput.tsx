"use client";

import { dataSeriesDataFieldNames } from "@/types";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import styles from "./dataSeriesInput.module.css";
import { dataSeriesPattern, isValidPastedInput, isValidSingleInputForGrid, isValidSingleInputForTextField } from "./utils";

export default function DataSeriesInput({
  dataSeriesString, // TODO - rename "dataSeriesString" to "dataSeriesInput" or "initialValue" (latter suggested by chatgpt)
  inputName = "dataSeries",
  inputId = "dataSeries",
  labelKey = "forms:data_series_input.data_series",
  summaryKey,
}: {
  dataSeriesString?: string;
  inputName?: string;
  inputId?: string;
  labelKey?: string;
  summaryKey?: string;
}) {

  const { t } = useTranslation();
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
      {summaryKey && (
        <details className="margin-block-75">
          <summary>
            {t(summaryKey)}
          </summary>
          <p>
            <Trans
              i18nKey={"forms:data_series_input.data_series_info"}
              components={{ strong: <strong />, br: <br /> }}
            />
          </p>
        </details>
      )}

      <fieldset className="block margin-block-75">
        <legend className={styles.dataSeriesInputLegend}>{t(labelKey)}</legend>
        {/* TODO: Make this allow .csv files and possibly excel files */}
        <div
          className="padding-25 smooth"
          style={{ border: "1px solid var(--gray-90)" }}
        >
          <div className={`flex flex-direction-row justify-content-center padding-bottom-25`}>
            {/* Button for toggling table visibility */}
            <button
              type="button"
              className={`${styles.tableControlsButton} ${styles.tableVisibilityButton}`}
              title={tableIsVisible ? t("forms:data_series_input.hide_table") : t("forms:data_series_input.show_table")}
              onClick={() => {
                setTableIsVisible(!tableIsVisible);
              }}
            >
              {/* Display different text and image depending on if the table is visible or not */}
              {tableIsVisible ? (
                <>
                  <Image src="/icons/circleMinus.svg" alt={t("forms:data_series_input.hide_table")} width={24} height={24} />
                  <p>{t("forms:data_series_input.hide_table")}</p>
                </>
              ) : (
                <>
                  <Image src="/icons/circlePlus.svg" alt={t("forms:data_series_input.show_table")} width={24} height={24} />
                  <p>{t("forms:data_series_input.show_table")}</p>
                </>
              )}
            </button>
          </div>

          {tableIsVisible && (
            <div
              className={`${styles.inputTable} smooth`}
            >
              {dataSeriesDataFieldNames.map((value, index) => (
                <label key={`year-${index}`} className="flex align-items-center">
                  <p
                    className="padding-left-100 padding-right-100 margin-0 margin-right-25"
                    style={{ width: "auto" }}
                  >
                    {value.replace("val", "")}
                  </p>
                  <input
                    type="number"
                    id={value}
                    name={`${inputName}Input`}
                    value={dataSeriesValues[index] ?? ""}
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
            </div>
          )}
        </div>
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