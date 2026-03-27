"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import styles from "./dataSeriesInput.module.css";
import { isValidPastedInput } from "./utils";
import { IconPlus, IconTrashXFilled } from "@tabler/icons-react";
import Grid from "../grid/grid";

export default function DataSeriesInputManual() {

  const { t } = useTranslation("forms");
  const [value, setValue] = useState<Array<{ year: number | null, data: number | null }>>([{ year: null, data: null }])


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

  function parsePastedText(text: string) {
    return text
      .trim()
      .split(/\r?\n/) // TODO: Might want some more splitting
      .map(row => row.split("\t")); // TODO: Might want some more splitting
  }

  // TODO: Ensure normal ctrl+z behavior
  // TODO: We can currently paste as long as we hold ctrl+v, might want to prevent so people dont accidently click another field while pasting (see previous implementation of "isPasting")
  // TODO: Previous versions contained some type of validation here, check it out
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

        // If we paste into data, we do not want any new data in the previous column (i.e years)
        // If we paste into year, we expect both the year and data column to be filled out data exists
        if (targetColumn == 'data') {
          next[rowIndex] = {
            year: next[rowIndex].year,
            data: cols[0] ? Number(cols[0]) : null,
          }
        } else {
          next[rowIndex] = {
            year: cols[0] ? Number(cols[0]) : null,
            data: cols[1] ? Number(cols[1]) : null,
          }
        }

      });

      return next;
    });
  }

  return (
    <>
      <Grid // TODO: Add caption  
        props={{
          className: `grid width-100 align-items-center ${styles.grid}`,
          style: { gridTemplateColumns: '100px 1fr auto' }
        }}
      >
        <Grid.ColumnHeader>{t("forms:data_series_input.year")}</Grid.ColumnHeader>
        <Grid.ColumnHeader>{t("forms:data_series_input.value")}</Grid.ColumnHeader>
        <Grid.ColumnHeader>{t("forms:data_series_input.action")}</Grid.ColumnHeader>
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
                value={item.year ?? undefined}
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
                value={item.data ?? undefined}
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
                aria-label={t("forms:data_series_input.delete_row")}
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
        {t("forms:data_series_input.add_new_row")}
      </button>
    </>
  )
}