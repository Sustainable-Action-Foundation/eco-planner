"use client";

import { dataSeriesDataFieldNames } from "@/types";
import { useEffect, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import styles from "../goalForm/goalForm.module.css"; // TODO - make unique style file
import { dataSeriesPattern } from "../goalForm/goalForm"; // TODO - fix this

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
    return /^[0-9.,]+$/.test(char);
  }
  function isValidSingleInputForTextField(char: string): boolean {
    // For onBeforeInput – blocks invalid keystrokes
    return /^[0-9;\t\b.,]$/.test(char);
  }

  function isValidPastedInput(text: string): boolean {
    // For onPaste – allows numbers, semicolons, tabs, whitespace, and newlines
    return /^[0-9;\t\n\r\s.,]+$/.test(text);
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

  return (
    <>
      <details className="margin-block-75">
        <summary>
          {t("forms:goal.extra_info_data_series")}
        </summary>
        <p>
          <Trans
            i18nKey={"forms:goal.data_series_info"}
            components={{ strong: <strong />, br: <br /> }}
          />
          {/* The &quot;Data series&quot; field accepts a series of values separated by semicolons or tabs, which means you can paste a series of values from Excel or similar.<br />
          <strong>NOTE: Values must not be separated by commas (&quot;,&quot;).</strong><br />
          Decimal numbers can use either decimal points or decimal commas.<br />
          The first value represents the year 2020 and the series can continue up to the year 2050 (a total of 31 values).<br />
          If values are missing for a year, you can leave it blank, for example &quot;;1;;;;5&quot; can be used to specify the values 1 and 5 for the years 2021 and 2025. */}
        </p>
      </details>

      <label className="block margin-block-75">
        {t("forms:goal.data_series")}
        {/* TODO: Make this allow .csv files and possibly excel files */}
        <div style={{ border: "1px solid var(--gray-90)", padding: ".25rem", borderRadius: "0.25rem", maxWidth: "48.5rem" }}>
          <div id="inputGrid" className={`${styles.sideScroll}`} style={{ display: "grid", gridTemplateColumns: `repeat(${dataSeriesValues.length}, 1fr)`, gap: "0rem", gridTemplateRows: "auto", borderRadius: "0.25rem" }}>
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
        </div>
      </label>
      <details className="margin-block-75">
        <summary>
          Advanced {/* TODO - translate */}
        </summary>
        <p>
          {/* TODO - translate (data series text field info) */}
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