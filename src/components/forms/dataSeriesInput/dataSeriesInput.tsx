"use client";

import { dataSeriesDataFieldNames } from "@/types";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import styles from "./dataSeriesInput.module.css";
import { dataSeriesPattern, isValidPastedInput, isValidSingleInputForGrid, isValidSingleInputForTextField } from "./utils";

export default function DataSeriesInput({
  dataSeriesString, // TODO - rename "dataSeriesString" to "dataSeriesInput" or "initialValue" (latest suggested by chatgpt)
  inputName = "dataSeries",
  inputId = "dataSeries",
  labelKey = "forms:data_series_input.data_series",
  titleKey = "forms:data_series_input.data_series_title",
  summaryKey,
  summaryInfoKey,
  advancedInfoKey,
  addAltTextKey,
  removeAltTextKey,
}: {
  dataSeriesString?: string
  inputName?: string;
  inputId?: string;
  labelKey?: string;
  titleKey?: string;
  summaryKey?: string;
  summaryInfoKey?: string
  advancedInfoKey: string;
  addAltTextKey: string;
  removeAltTextKey: string;
}) {

  const { t } = useTranslation();
  const [dataSeriesValues, setDataSeriesValues] = useState<string[]>(
    dataSeriesString && dataSeriesString.length > 0
      ? dataSeriesString.split(/[\t;]/).slice(0, dataSeriesDataFieldNames.length)
      : Array.from({ length: dataSeriesDataFieldNames.length }, () => ""),
  );
  const isPasting = useRef(false);

  const addColumnRef = useRef<HTMLButtonElement>(null);
  const removeColumnRef = useRef<HTMLButtonElement>(null);

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
      addColumnRef.current,
      removeColumnRef.current,
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

  function addColumn(e: React.MouseEvent<HTMLButtonElement>) {
    setDataSeriesValues((prevValues) => {
      if (prevValues.length >= dataSeriesDataFieldNames.length) return prevValues; // Prevent adding more columns than the maximum allowed
      return [...prevValues, ""];
    });
  }

  function removeColumn(e: React.MouseEvent<HTMLButtonElement>) {
    setDataSeriesValues((prevValues) => {
      if (prevValues.length <= 1) return prevValues; // Prevent removing the last column
      return prevValues.slice(0, -1);
    });
  }

  return (
    <>
      {summaryKey && summaryInfoKey && (
        <details className="margin-block-75">
          <summary>
            {t(summaryKey)}
          </summary>
          <p>
            { // TODO - modify so that this text is not identical to the text in the advanced section
            }
            <Trans
              i18nKey={summaryInfoKey}
              components={{ strong: <strong />, br: <br /> }}
            />
          </p>
        </details>
      )}

      <label className="block margin-block-75">
        {t(labelKey)}
        {/* TODO: Make this allow .csv files and possibly excel files */}
        <div
          className="padding-25 smooth flex"
          style={{ border: "1px solid var(--gray-90)", maxWidth: "48.5rem" }}
        >
          <div
            className={`${styles.sideScroll} smooth grid gap-0`}
            style={{ gridTemplateColumns: `repeat(${dataSeriesValues.length}, 1fr)`, gridTemplateRows: "auto" }}
          >
            {dataSeriesValues.map((value, index) => index < dataSeriesDataFieldNames.length && (
              <div key={`column-${index}`}>
                <label htmlFor={dataSeriesDataFieldNames[index]} className="padding-25 margin-left-25 margin-right-25">
                  {dataSeriesDataFieldNames[index].replace("val", "")}
                </label>
                <input
                  type="number"
                  id={dataSeriesDataFieldNames[index]}
                  name={`${inputName}Input`}
                  value={value}
                  onChange={(e) => handleValueChange(e, index)}
                  onBeforeInput={(e) => {
                    const inputEvent = e.nativeEvent as InputEvent;
                    if (inputEvent.data && !isValidSingleInputForGrid(inputEvent.data)) {
                      e.preventDefault();
                    }
                  }}
                  onPaste={(e) => {
                    const pasted = e.clipboardData.getData("text");
                    if (!isValidPastedInput(pasted)) {
                      e.preventDefault();
                    } else {
                      handlePaste(e, index);
                    }
                  }}
                />
              </div>
            ))}
          </div>
          <div className="flex flex-direction-column justify-content-center">
            <button
              type="button"
              className={`${styles.columnControlsButton}`}
              title={t("forms:data_series_input.add_year")}
              ref={addColumnRef}
              onLoad={(e) => updateControlsState((e.target as HTMLElement).parentElement, null, dataSeriesValues)}
              onClick={addColumn}
            >
              <Image src="/icons/circlePlus.svg" alt={t(addAltTextKey)} width={24} height={24} />
            </button>
            <button
              type="button"
              className={`${styles.columnControlsButton}`}
              title={t("forms:data_series_input.remove_year")}
              ref={removeColumnRef}
              onLoad={(e) => updateControlsState(null, (e.target as HTMLElement).parentElement, dataSeriesValues)}
              onClick={removeColumn}
            >
              <Image src="/icons/circleMinus.svg" alt={t(removeAltTextKey)} width={24} height={24} />
            </button>
          </div>
        </div>
      </label>

      <details className="margin-block-75">
        <summary>
          {t("forms:data_series_input.advanced")}
        </summary>
        <p>
          <Trans
            i18nKey={advancedInfoKey}
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
            title={t(titleKey)}
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