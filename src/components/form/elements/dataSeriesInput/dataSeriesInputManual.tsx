"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import styles from "./dataSeriesInput.module.css";
import { isValidPastedInput } from "./utils";
import { IconTrashXFilled } from "@tabler/icons-react";
import Grid from "../grid/grid";
import React from "react";
import type { DateValuesWithUnit } from "@/types";

export default function DataSeriesInputManual({
  initialDateValues = { unit: undefined, dateValues: {} },
  outputFormElement,
}: {
  initialDateValues?: DateValuesWithUnit | undefined;
  outputFormElement?: React.ReactElement<HTMLInputElement> | undefined;
}) {

  const { t } = useTranslation("forms");
  const [value, setValue] = useState<Array<{ year: number | null, data: number | null }>>(() => {
    if (Object.keys(initialDateValues.dateValues).length === 0) {
      return [{ year: null, data: null }];
    }

    return Object.entries(initialDateValues.dateValues).map(([date, value]) => ({
      year: new Date(date).getFullYear(),
      data: value ?? null
    }));
  })
 
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
        if (targetColumn === 'data') {
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

      {outputFormElement && React.cloneElement(outputFormElement, {
        value: JSON.stringify({
          dateValues: value.every(({ year, data }) => !year && !data) // If all values are completely empty, we return an empty object
            ? {}
            : Object.fromEntries(
              value.map(({ year, data }) => [`${year}-01-01T00:00:00.000Z`, data]) // Otherwise we return the year + data (frontend just requires year, backend handles more specific validation)
            )
        }),
        type: "hidden",
        hidden: true,
        readOnly: true,
      })}

      <Grid // TODO: Add caption (html <caption> element), TODO: Might want to define gridrows here rather than in the component?, TODO: the grid rows are currently labeled "ta bort rad", fix this...   
        props={{
          className: `grid width-100 align-items-center ${styles.grid}`,
          style: { gridTemplateColumns: 'auto auto 1fr auto' }
        }}
      > 
        <Grid.ColumnHeader className="text-align-left">#</Grid.ColumnHeader>
        <Grid.ColumnHeader className="text-align-left overflow-hidden" style={{resize: 'horizontal', minWidth: 'fit-content', width: '100px'}}>{t("forms:data_series_input.year")}</Grid.ColumnHeader>
        <Grid.ColumnHeader className="text-align-left">{t("forms:data_series_input.value")}</Grid.ColumnHeader>
        <Grid.ColumnHeader className="text-align-left">{t("forms:data_series_input.action")}</Grid.ColumnHeader>
        {value.flatMap((item, index) => {
          return [
            <Grid.Row key={`row-${index}`}>
              <Grid.RowHeader className="grid place-items-center">
                {index}
              </Grid.RowHeader>
              <Grid.Cell
                style={{ minWidth: '100%', width: '0' }}
              >
                <input
                  type="number"
                  required
                  tabIndex={-1}
                  defaultValue={item.year ?? undefined}
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
              </Grid.Cell>
              <Grid.Cell>
                <input
                  type="number"
                  tabIndex={-1}
                  defaultValue={item.data ?? undefined}
                  onChange={(e) => {
                    handleDataChange(index, e.target.value);
                  }}
                  onPaste={(e) => {
                    // Make sure the pasted input is valid before handling paste
                    const pasted = e.clipboardData.getData("text");
                    if (!isValidPastedInput(pasted)) {
                      e.preventDefault();
                    } else {
                      handlePaste(e, index, "data");
                    }
                  }}
                />
              </Grid.Cell>
              <Grid.Cell
                className='display-flex align-items-center'>
                <button // TODO: when deleting show popup asking for confirmation, TODO: Add row below/above should be things you can do...
                  className="padding-25 grid round transparent margin-inline-auto"
                  type="button"
                  aria-label={t("forms:data_series_input.delete_row")}
                  tabIndex={-1}
                  onClick={() =>
                    setValue(prev => prev.filter((_, i) => i !== index))
                  }
                data-testid='delete-row-button'>
                  <IconTrashXFilled height={20} width={20} style={{ maxWidth: '20' }} aria-hidden="true" />
                </button>
              </Grid.Cell>
            </Grid.Row>
          ]
        })}
      </Grid>
      <button
        type="button"
        className="font-weight-600 text-align-center padding-50 width-100" style={{ lineHeight: '1', transform: 'scale(1)', borderRadius: '0 0 .25rem .25rem', border: '1px solid var(--gray-80)', borderTop: '0', backgroundColor: '#ebf0ff' }}
        onClick={() =>
          setValue(prev => [...prev, { year: null, data: null }])
        }
      data-testid="add-row-button">
        {t("forms:data_series_input.add_new_row")}
      </button>
    </>
  )
}