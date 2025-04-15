"use client";

import { dataSeriesDataFieldNames } from "@/types";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { dataSeriesPattern } from "../goalForm/goalForm"; // TODO - fix this
import styles from "./dataSeriesInput.module.css";

export default function DataSeriesInput({
  dataSeriesString
}: {
  dataSeriesString?: string
}) {

  const { t } = useTranslation();
  const [dataSeriesValues, setDataSeriesValues] = useState<string[]>(
    dataSeriesString?.split(/[\t;]/) ?? new Array(dataSeriesDataFieldNames.length).fill(""),
  );
  const isPasting = useRef(false);

  useEffect(() => {
    if (dataSeriesString) {
      console.log(dataSeriesString);
      setDataSeriesValues(dataSeriesString.split(/[\t;]/).slice(0, dataSeriesDataFieldNames.length));
    }
  }, [dataSeriesString]);

  // TODO - dont allow negative values?
  function isValidSingleInputForGrid(char: string): boolean {
    // For onBeforeInput – blocks invalid keystrokes
    return /^[0-9.,-]+$/.test(char);
  }
  function isValidSingleInputForTextField(char: string): boolean {
    // For onBeforeInput – blocks invalid keystrokes
    return /^[0-9;\t\b.,-]$/.test(char);
  }

  function isValidPastedInput(text: string): boolean {
    // For onPaste – allows numbers, semicolons, tabs, whitespace, and newlines
    return /^[0-9;\t\n\r\s.,-]+$/.test(text);
  }

  function handleValueChange(e: React.ChangeEvent<HTMLInputElement>, index: number) {
    if (isPasting.current) return;

    const newValues = [...dataSeriesValues];
    newValues[index] = e.target.value;
    setDataSeriesValues(newValues);
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>, startIndex: number) {
    isPasting.current = true;
    const clipboardText = e.clipboardData.getData("text");
    const pastedValues = clipboardText.split(/[\t;]/);

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

  function addColumn() {
    setDataSeriesValues((prevValues) => {
      if (prevValues.length >= dataSeriesDataFieldNames.length) {
        return prevValues; // Prevent adding more columns than the maximum allowed
      }

      const newValues = [...prevValues, ""];
      return newValues;
    })
  }

  function removeColumn() {
    setDataSeriesValues((prevValues) => {
      if (prevValues.length <= 1) {
        return prevValues; // Prevent removing the last column
      }

      const newValues = prevValues.slice(0, -1);
      return newValues;
    })
  }

  return (
    <>
      <details className="margin-block-75">
        <summary>
          {t("forms:goal.extra_info_data_series")}
        </summary>
        <p>
          { // TODO - modify so that this text is not identical to the text in the advanced section
          }
          <Trans
            i18nKey={"forms:goal.data_series_info"}
            components={{ strong: <strong />, br: <br /> }}
          />
        </p>
      </details>

      <label className="block margin-block-75">
        {t("forms:goal.data_series")}
        {/* TODO: Make this allow .csv files and possibly excel files */}
        <div className="padding-25 smooth flex" style={{ border: "1px solid var(--gray-90)", maxWidth: "48.5rem" }}>
          <div id="inputGrid" className={`${styles.sideScroll} smooth grid gap-0`} style={{ gridTemplateColumns: `repeat(${dataSeriesValues.length}, 1fr)`, gridTemplateRows: "auto" }}>
            {dataSeriesValues.map((value, index) => index < dataSeriesDataFieldNames.length && (
              <div key={`column-${index}`}>
                <label htmlFor={dataSeriesDataFieldNames[index]} className="padding-25">{dataSeriesDataFieldNames[index].replace("val", "")}</label>
                <input
                  type="number"
                  id={dataSeriesDataFieldNames[index]}
                  name="dataSeriesInput"
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
              title="Add column" // TODO - translate
              onClick={addColumn}
            >
              <Image src="/icons/circlePlus.svg" alt="Add new data series" width={24} height={24} />
            </button>
            <button
              type="button"
              className={`${styles.columnControlsButton}`}
              title="Remove column" // TODO - translate
              onClick={removeColumn}
            >
              <Image src="/icons/circleMinus.svg" alt="Remove data series" width={24} height={24} />
            </button>
          </div>
        </div>
      </label>
      <details className="margin-block-75">
        <summary>
          Advanced {/* TODO - translate */}
        </summary>
        <p>
          <Trans
            i18nKey={"forms:goal.data_series_info"}
            components={{ strong: <strong />, br: <br /> }}
          />
        </p>
        <label className="block margin-block-75">
          {t("forms:goal.data_series")}
          <input type="text" name="dataSeries" required id="dataSeries"
            pattern={dataSeriesPattern}
            title={t("forms:goal.data_series_title")}
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