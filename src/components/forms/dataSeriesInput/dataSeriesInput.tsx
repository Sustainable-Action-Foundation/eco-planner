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
  summaryKey,
}: {
  dataSeriesString?: string
  inputName?: string;
  inputId?: string;
  labelKey?: string;
  summaryKey?: string;
}) {

  const { t } = useTranslation();
  const initialValues = dataSeriesString && dataSeriesString.length > 0
    ? dataSeriesString.split(/[\t;]/).slice(0, dataSeriesDataFieldNames.length)
    : Array.from({ length: dataSeriesDataFieldNames.length }, () => "");
  const [dataSeriesValues, setDataSeriesValues] = useState<string[]>(initialValues);
  const isPasting = useRef(false);
  const [history, setHistory] = useState<string[][]>([initialValues]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const [hasFocus, setHasFocus] = useState(false);

  const addColumnRef = useRef<HTMLButtonElement>(null);
  const removeColumnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (dataSeriesString) {
      pushToHistory(dataSeriesString
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

  const historyRef = useRef(history);
  const historyIndexRef = useRef(historyIndex);

  useEffect(() => {
    historyRef.current = history;
    historyIndexRef.current = historyIndex;
  }, [history, historyIndex]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!hasFocus) return;

      // Undo
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "z") {
        // if (historyIndex <= 0) return;
        console.log(history);
        console.log(historyIndex);
        e.preventDefault();
        const currentIndex = historyIndexRef.current;

        if (currentIndex > 0) {
          const prev = historyRef.current[currentIndex - 1];
          setDataSeriesValues(prev);
          historyIndexRef.current = Math.max(0, currentIndex - 1);
          setHistoryIndex(Math.max(0, currentIndex - 1));
        }
      }

      // Redo
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        console.log(history);
        console.log(historyIndex);
        const currentIndex = historyIndexRef.current;
        const redoTarget = historyRef.current[currentIndex + 1];

        if (redoTarget) {
          setDataSeriesValues(redoTarget);
          historyIndexRef.current = currentIndex + 1;
          // historyIndexRef.current = Math.min(historyRef.current.length - 1, currentIndex + 1);
          setHistoryIndex(currentIndex + 1);
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [hasFocus]);

  function handleValueChange(e: React.ChangeEvent<HTMLInputElement>, index: number) {
    if (isPasting.current) return;

    const newValues = [...dataSeriesValues];
    newValues[index] = e.target.value;
    pushToHistory(newValues);
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

    pushToHistory(newValues);

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

  function addColumn(e: React.MouseEvent<HTMLButtonElement>) {

    if (dataSeriesValues.length >= dataSeriesDataFieldNames.length) return dataSeriesValues; // Prevent adding more columns than the maximum allowed
    pushToHistory([...dataSeriesValues, ""]);
  }

  function removeColumn(e: React.MouseEvent<HTMLButtonElement>) {
    if (dataSeriesValues.length <= 1) return dataSeriesValues; // Prevent removing the last column
    pushToHistory(dataSeriesValues.slice(0, -1));
  }

  function pushToHistory(newValues: string[]) {
    // if (JSON.stringify(newValues) === JSON.stringify(dataSeriesValues)) return; // Prevent pushing the same state to history
    console.log(dataSeriesValues);
    console.log(newValues);
    console.log(history);
    console.log(historyIndex);
    setHistory((prev) => {
      const currentIndex = historyIndexRef.current;
      if (prev[currentIndex] &&
        JSON.stringify(prev[currentIndex]) === JSON.stringify(newValues)) {
        return prev; // Prevent pushing the same state to history
      }

      const truncated = prev.slice(0, currentIndex + 1); // Cut off any "future" redo history
      const updated = [...truncated, newValues];

      historyIndexRef.current = updated.length - 1;
      setHistoryIndex(updated.length - 1);
      return updated;
    });

    setDataSeriesValues(newValues);
  }

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      onFocus={() => setHasFocus(true)}
      onBlur={(e) => {
        if (!containerRef.current?.contains(e.relatedTarget as Node)) {
          setHasFocus(false);
        }
      }}
    >
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
                  value={value.replace(",", ".")}
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
              <Image src="/icons/circlePlus.svg" alt={t("forms:data_series_input.add_year_to_table")} width={24} height={24} />
            </button>
            <button
              type="button"
              className={`${styles.columnControlsButton}`}
              title={t("forms:data_series_input.remove_year")}
              ref={removeColumnRef}
              onLoad={(e) => updateControlsState(null, (e.target as HTMLElement).parentElement, dataSeriesValues)}
              onClick={removeColumn}
            >
              <Image src="/icons/circleMinus.svg" alt={t("forms:data_series_input.remove_year_from_table")} width={24} height={24} />
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
              pushToHistory(values);
            }}
          />
        </label>
      </details>
    </div>
  )
}