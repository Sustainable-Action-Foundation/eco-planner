"use client";

import { dataSeriesDataFieldNames } from "@/types";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
// import { dataSeriesPattern } from "../goalForm/goalForm"; // TODO - fix this
import styles from "./dataSeriesInput.module.css";
import { dataSeriesPattern, isValidPastedInput, isValidSingleInputForGrid, isValidSingleInputForTextField } from "./utils";

export default function BaselineDataSeriesInput({
  baselineDataSeriesString,
}: {
  baselineDataSeriesString?: string;
}) {
  const { t } = useTranslation();
  const [baselineDataSeriesValues, setBaselineDataSeriesValues] = useState<string[]>(
    baselineDataSeriesString && baselineDataSeriesString.length > 0 ? baselineDataSeriesString.split(/[\t;]/) : Array.from({ length: dataSeriesDataFieldNames.length }, () => ""),
  );
  const isPasting = useRef(false);

  useEffect(() => {
    if (baselineDataSeriesString) {
      setBaselineDataSeriesValues(baselineDataSeriesString.split(/[\t;]/).slice(0, dataSeriesDataFieldNames.length));
    }
  }, [baselineDataSeriesString]);

  function handleValueChange(e: React.ChangeEvent<HTMLInputElement>, index: number) {
    if (isPasting.current) return;

    const newValues = [...baselineDataSeriesValues];
    newValues[index] = e.target.value;
    setBaselineDataSeriesValues(newValues);
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>, startIndex: number) {
    isPasting.current = true;
    const clipboardText = e.clipboardData.getData("text");
    const pastedValues = clipboardText.split(/[\t;]/);

    const newValues = [...baselineDataSeriesValues];

    for (let i = 0; i < pastedValues.length && i + startIndex < dataSeriesDataFieldNames.length; i++) {
      const targetIndex = startIndex + i;
      if (targetIndex < newValues.length) {
        newValues[targetIndex] = pastedValues[i].trim();
      } else {
        newValues.push(pastedValues[i].trim());
      }
    }

    setBaselineDataSeriesValues(newValues);

    setTimeout(() => {
      isPasting.current = false;
    }, 0);
  }

  function addColumn() {
    setBaselineDataSeriesValues((prevValues) => {
      if (prevValues.length >= dataSeriesDataFieldNames.length) {
        return prevValues; // Prevent adding more columns than the maximum allowed
      }

      const newValues = [...prevValues, ""];
      return newValues;
    });
  }

  function removeColumn() {
    setBaselineDataSeriesValues((prevValues) => {
      if (prevValues.length <= 1) {
        return prevValues; // Prevent removing the last column
      }

      const newValues = prevValues.slice(0, -1);
      return newValues;
    });
  }

  return (
    <>
      <label className="block margin-block-75">
        {t("forms:data_series_input.custom_baseline_label")}
        {/* TODO: Make this allow .csv files and possibly excel files */}
        <div className="padding-25 smooth flex" style={{ border: "1px solid var(--gray-90)", maxWidth: "48.5rem" }}>
          <div id="baselineInputGrid" className={`${styles.sideScroll} smooth grid gap-0`} style={{ gridTemplateColumns: `repeat(${baselineDataSeriesValues.length}, 1fr)`, gridTemplateRows: "auto" }}>
            {baselineDataSeriesValues.map((value, index) => index < dataSeriesDataFieldNames.length && (
              <div key={`column-${index}`}>
                <label htmlFor={dataSeriesDataFieldNames[index]} className="padding-25">{dataSeriesDataFieldNames[index].replace("val", "")}</label>
                <input
                  type="number"
                  id={dataSeriesDataFieldNames[index]}
                  name="baselineDataSeriesInput"
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
                      handlePaste(e, index); // TODO - pass text instead of event
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
              title={t("forms:data_series_input.add_column")}
              onClick={addColumn}
            >
              <Image src="/icons/circlePlus.svg" alt={t("forms:data_series_input.add_column_to_custom_baseline")} width={24} height={24} />
            </button>
            <button
              type="button"
              className={`${styles.columnControlsButton}`}
              title={t("forms:data_series_input.remove_column")}
              onClick={removeColumn}
            >
              <Image src="/icons/circleMinus.svg" alt={t("forms:data_series_input.remove_column_from_custom_baseline")} width={24} height={24} />
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
            i18nKey={"forms:data_series_input.custom_baseline_info"}
            components={{ strong: <strong />, br: <br /> }}
          />
        </p>
        <label className="block margin-block-75">
          {t("forms:data_series_input.custom_baseline_label")}
          <input type="text" name="baselineDataSeries" required id="baselineDataSeries"
            pattern={dataSeriesPattern}
            title={t("forms:data_series_input.custom_baseline_title")}
            value={baselineDataSeriesValues.join(";")}
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
              setBaselineDataSeriesValues(values);
            }}
          />
        </label>
      </details>
    </>
  )
}