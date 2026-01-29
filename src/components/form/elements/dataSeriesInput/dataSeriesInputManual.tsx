"use client";

import { Years } from "@/types";
import { Fragment, useEffect, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import styles from "./dataSeriesInput.module.css";
import { dataSeriesPattern, isValidPastedInput, isValidSingleInputForGrid, isValidSingleInputForTextField } from "./utils";
import { IconAlertTriangle, IconCaretDownFilled, IconCaretUpFilled, IconHelp, IconPlus, IconQuestionMark, IconTrash, IconTrashFilled, IconTrashX, IconTrashXFilled } from "@tabler/icons-react";
import Grid from "../grid/grid";

export default function DataSeriesInputManual({
  dataSeriesString, // TODO - rename "dataSeriesString" to "dataSeriesInput" or "initialValue" (latter suggested by chatgpt)
  inputName = "dataSeries",
  inputId = "dataSeries",
  // TODO: Take in any string and use that as the label instead of a key to alleviate testing
  labelKey = "forms:data_series_input.data_series",
}: {
  dataSeriesString?: string;
  inputName?: string;
  inputId?: string;
  labelKey?: string;
}) {

  const { t } = useTranslation("forms");
  const [value, setValue] = useState<Array<{ year: number | null, data: number | null }>>([{ year: null, data: null }])
  const [dataSeriesValues, setDataSeriesValues] = useState<string[]>(
    dataSeriesString && dataSeriesString.length > 0
      ? dataSeriesString.split(/[\t;]/).slice(0, Years.length)
      : Array.from({ length: Years.length }, () => ""),
  );
  const isPasting = useRef(false);
  const [tableIsVisible, setTableIsVisible] = useState(true);
  useEffect(() => {
    console.log(value)
  }, [value])

  const handleYearChange = (index: number, newValue: string) => {
    setValue(prev =>
      prev.map((item, i) =>
        i === index
          ? { ...item, year: newValue === '' ? null : Number(newValue) }
          : item
      )
    );
  };

  const handleDataChange = (index: number, newValue: string) => {
    setValue(prev =>
      prev.map((item, i) =>
        i === index
          ? { ...item, data: newValue === '' ? null : Number(newValue) }
          : item
      )
    );
  };

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

  function parsePastedText(text: string) {
    return text
      .trim()
      .split(/\r?\n/)
      .map(row => row.split("\t"));
  }

  function handlePaste(
    e: React.ClipboardEvent<HTMLInputElement>,
    startIndex: number,
    targetColumn: string
  ) {
    e.preventDefault();

    const pastedText = e.clipboardData.getData("text");
    const rows = parsePastedText(pastedText);

    setValue(prev => {
      const next = [...prev];

      rows.forEach((cols, rowOffset) => {
        const rowIndex = startIndex + rowOffset;

        if (!next[rowIndex]) {
          next[rowIndex] = { year: null, data: null };
        }

        // If two columns are pasted, fill both year and data
        if (cols.length >= 2) {
          next[rowIndex] = {
            year: cols[0] ? Number(cols[0]) : null,
            data: cols[1] ? Number(cols[1]) : null,
          };
          return;
        }

        // If one columns is pasted, fill only the column which it was pasted to
        const value = cols[0]?.trim()
          ? Number(cols[0])
          : null;

        if (targetColumn === "year") {
          next[rowIndex].year = value;
        } else {
          next[rowIndex].data = value;
        }
      });

      return next;
    });
  }


  /*
  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>, startIndex: number) {
    isPasting.current = true;
    // Splits input at tabs, newlines, carriage returns, vertical tabs, and semicolons (other whitespace is trimmed a few lines below)
    const pastedText = e.clipboardData.getData("text");


    const rows = pastedText
      .trim()
      .split(/\r?\n/); // split into rows (handles Windows & Unix)

    const result = rows.map(row => {
      const [yearRaw, dataRaw] = row.split("\t");
      console.log({
        year: yearRaw?.trim()
          ? Number(yearRaw)
          : null,
        data: dataRaw?.trim()
          ? Number(dataRaw)
          : null,
      })
    });

    const pastedValues = pastedText.includes("\n")
      ? pastedText.split(/[\n\r?]+/)
      : pastedText.split(/[\t\r\v;]/);
    const newValues = [...dataSeriesValues];

    for (let i = 0; i < pastedValues.length && i + startIndex < Years.length; i++) {
      const targetIndex = startIndex + i;
      if (targetIndex < newValues.length) {
        newValues[targetIndex] = pastedValues[i].trim();
      } else {
        newValues.push(pastedValues[i].trim());
      }
    }

    console.log(newValues)
    setDataSeriesValues(newValues);

    setTimeout(() => {
      isPasting.current = false;
    }, 0);
  } */

  return (
    <>
      <Grid // TODO: Add caption  
        props={{
          className: `grid width-100 align-items-center ${styles.grid}`,
          style: { gridTemplateColumns: '100px 1fr auto' }
        }}
      >
        <Grid.ColumnHeader>Year</Grid.ColumnHeader>
        <Grid.ColumnHeader>Value</Grid.ColumnHeader>
        <Grid.ColumnHeader>Action</Grid.ColumnHeader>
        {value.flatMap((item, index) => {
          const isLastRow = index >= value.length - 1;
          return [
            <Grid.Cell
              style={{ borderRight: '1px solid var(--gray-80)' }}
              key={`year-${index}`}
            >
              <input
                type="number"
                tabIndex={-1}
                value={item.year ? item.year : ''}
                onChange={(e) => handleYearChange(index, e.target.value)}
                onPaste={(e) => {
                  // Make sure the pasted input is valid before handling paste
                  const pasted = e.clipboardData.getData("text");
                  if (!isValidPastedInput(pasted)) {
                    e.preventDefault();
                  } else {
                    handlePaste(e, index, 'year')
                  }
                }}
              />
            </Grid.Cell>,
            <Grid.Cell
              style={{ borderRight: '1px solid var(--gray-80)' }}
              key={`data-${index}`}
            >
              <input
                type="number"
                tabIndex={-1}
                value={item.data ? item.data : ''}
                onChange={(e) => handleDataChange(index, e.target.value)}
                onPaste={(e) => {
                  // Make sure the pasted input is valid before handling paste
                  const pasted = e.clipboardData.getData("text");
                  console.log(pasted)
                  if (!isValidPastedInput(pasted)) {
                    e.preventDefault();
                  } else {
                    handlePaste(e, index, "data");
                  }
                }}
              />
            </Grid.Cell>,
            <Grid.Cell
              className='display-flex align-items-center'
              style={{ ...(isLastRow ? {} : { borderBottom: '1px solid var(--gray-80)' }), backgroundColor: 'var(--gray-95)' }}
              key={`test-${index}`} // TODO: Remove test
            >
              <button // TODO: when deleting show popup asking for confirmation
                className="padding-25 grid round transparent margin-inline-auto"
                type="button"
                aria-label="Delete row" /* TODO: i18n */
                tabIndex={-1}
                onClick={() =>
                  setValue(prev => prev.filter((_, i) => i !== index))
                }
              >
                <IconTrashXFilled height={20} width={20} style={{ maxWidth: '20' }} aria-hidden="true" />
              </button>
            </Grid.Cell>
          ]
        })}
      </Grid>
      <button
        className="rounded font-weight-500 flex align-items-center gap-50 padding-50 padding-right-75 margin-top-50" style={{ lineHeight: '1', transform: 'scale(1)' }}
        onClick={() =>
          setValue(prev => [...prev, { year: null, data: null }])
        }
      >
        <IconPlus width={20} height={20} aria-hidden="true" />
        Add new row {/* TODO: I18n */}
      </button>
      {/*
      <fieldset className="block fieldset-unset-pseudo-class">
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
                <IconCaretUpFilled width={20} height={20} style={{ minWidth: '20px' }} aria-hidden="true" />
              </>
            ) : (
              <>
                {t("forms:data_series_input.show_table")}
                <IconCaretDownFilled width={20} height={20} style={{ minWidth: '20px' }} aria-hidden="true" />
              </>
            )}
          </button>
        </legend> */}
      {/* TODO: Make this allow .csv files and possibly excel files */}
      {/*
        <label className={`${styles['spreadsheet-label']} grid padding-left-100 gap-100 gray-90 font-weight-600`}>
          <span className="padding-50 text-align-center">{t("forms:data_series_input.year")}</span>
          <span className="padding-50 padding-left-100" style={{ borderLeft: '1px solid var(--gray)' }}>{t("forms:data_series_input.value")}</span>
        </label>
        {tableIsVisible && (
          <>
            {Years.map((value, index) => (
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
                    const inputEvent = e.nativeEvent;
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
       */}
    </>
  )
}