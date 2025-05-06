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

  const addYearRef = useRef<HTMLButtonElement>(null);
  const removeYearRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (dataSeriesString) {
      setDataSeriesValues(
        dataSeriesString
          .split(/[\t;]/)
          .slice(0, dataSeriesDataFieldNames.length)
      );
    }
  }, [dataSeriesString]);

  useEffect(() => {
    updateControlsState(
      addYearRef.current,
      removeYearRef.current,
      dataSeriesValues
    );
  }, [dataSeriesValues]);

  function handleValueChange(e: React.ChangeEvent<HTMLInputElement>, index: number) {
    if (isPasting.current) return;

    const newValues = [...dataSeriesValues];
    newValues[index] = e.target.value;
    setDataSeriesValues(newValues);
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>, startIndex: number) {
    isPasting.current = true;
    const pastedValues = e.clipboardData.getData("text").split(/[\t;]/);
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

  // Update the state of the add/remove buttons based on the number of values in the data series
  function updateControlsState(addColumnButton: HTMLElement | null, removeColumnButton: HTMLElement | null, valuesList: string[]) {
    if (valuesList.length >= dataSeriesDataFieldNames.length) {
      addColumnButton?.setAttribute("disabled", "true");
      removeColumnButton?.removeAttribute("disabled");
    } else if (valuesList.length <= 1) {
      addColumnButton?.removeAttribute("disabled");
      removeColumnButton?.setAttribute("disabled", "true");
    } else {
      addColumnButton?.removeAttribute("disabled");
      removeColumnButton?.removeAttribute("disabled");
    }
  }

  function addYear(e: React.MouseEvent<HTMLButtonElement>) {
    setDataSeriesValues((prevValues) => {
      if (prevValues.length >= dataSeriesDataFieldNames.length) return prevValues; // Prevent adding more years than the maximum allowed
      return [...prevValues, ""];
    });
  }

  function removeYear(e: React.MouseEvent<HTMLButtonElement>) {
    setDataSeriesValues((prevValues) => {
      if (prevValues.length <= 1) return prevValues; // Prevent removing the last year
      return prevValues.slice(0, -1);
    });
  }

  function ControlButtons(
    {
      className,
    }: {
      className?: string;
    }
  ) {
    return (
      <div className={`flex flex-direction-row justify-content-center ${className}`}>
        <button
          type="button"
          className={`${styles.tableControlsButton} ${styles.tableVisibilityButton}`}
          title={tableIsVisible ? t("forms:data_series_input.hide_table") : t("forms:data_series_input.show_table")}
          onClick={() => {
            setTableIsVisible(!tableIsVisible);
          }}
        >
          {tableIsVisible ? (
            <p>{t("forms:data_series_input.hide_table")}</p>
          ) : (
            <p>{t("forms:data_series_input.show_table")}</p>
          )}
        </button>
        
        <button
          type="button"
          className={`${styles.tableControlsButton}`}
          title={t("forms:data_series_input.add_year")}
          ref={addYearRef}
          // Make sure the button is displayed as it should be (diabled or not) depending on the number of years
          onLoad={(e) => updateControlsState((e.target as HTMLElement).parentElement, null, dataSeriesValues)}
          onClick={addYear}
        >
          <Image src="/icons/circlePlus.svg" alt={t("forms:data_series_input.add_year_to_table")} width={24} height={24} />
          <p>{t("forms:data_series_input.add_year_to_table")}</p>
        </button>
        <button
          type="button"
          className={`${styles.tableControlsButton}`}
          title={t("forms:data_series_input.remove_year")}
          ref={removeYearRef}
          // Make sure the button is displayed as it should be (diabled or not) depending on the number of years
          onLoad={(e) => updateControlsState(null, (e.target as HTMLElement).parentElement, dataSeriesValues)}
          onClick={removeYear}
        >
          <Image src="/icons/circleMinus.svg" alt={t("forms:data_series_input.remove_year_from_table")} width={24} height={24} />
          <p>{t("forms:data_series_input.remove_year_from_table")}</p>
        </button>
      </div>
    )
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
          style={{ border: "1px solid var(--gray-90)", maxWidth: "48.5rem" }}
        >
          <ControlButtons className={`${tableIsVisible && "padding-bottom-25"}`} />
          {tableIsVisible && (

            <div
              className={`${styles.inputTable} smooth `}
            >
              {dataSeriesValues.map((value, index) => index < dataSeriesDataFieldNames.length && (
                <label key={`year-${index}`} className="flex align-items-center">
                  <p className="padding-left-100 padding-right-100 margin-0 margin-right-25" style={{ width: "auto" }}>{dataSeriesDataFieldNames[index].replace("val", "")}</p>
                  <input
                    type="number"
                    id={dataSeriesDataFieldNames[index]}
                    name={`${inputName}Input`}
                    value={value}
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
          {/* Only show the control buttons at the bottom if the list of years is long enough */}
          {tableIsVisible && dataSeriesValues.length > 10 && (
            <ControlButtons className="padding-top-25" />
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