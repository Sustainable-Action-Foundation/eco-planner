"use client";

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import styles from "./dataSeriesInput.module.css";
import { isValidPastedInput } from "./utils";
import Grid from "../grid/grid";
import type { DateValuesWithUnit } from "@/types";
import { IconArrowsMaximize, IconArrowsMinimize, IconPlus, IconRowInsertTop, IconTrashXFilled } from "@tabler/icons-react";

export default function DataSeriesInputManual({
  initialDateValues = { unit: undefined, dateValues: {} },
  outputFormElement,
  label,
  id,
}: {
  initialDateValues?: DateValuesWithUnit | undefined;
  outputFormElement?: React.ReactElement<HTMLInputElement> | undefined;
  label: string;
  id: string;
}) {

  const { t } = useTranslation("forms");
  const [value, setValue] = useState<Array<{ id: string; year: string; data: string }>>(() => {
    if (Object.keys(initialDateValues.dateValues).length === 0) {
      return [{ id: window.crypto.randomUUID(), year: "", data: "" }];
    }

    return Object.entries(initialDateValues.dateValues).map(([date, value]) => ({
      id: window.crypto.randomUUID(),
      year: String(new Date(date).getFullYear()),
      data: value === null || value === undefined ? "" : String(value),
    }));
  });

  const [focusedCell, setFocusedCell] = useState<{ row: number, column: number } | null>(null);
  const [gridExpanded, setGridExpanded] = useState<boolean>(true);

  const handleYearChange = (index: number, newValue: string) => {
    setValue(prev =>
      prev.map((item, i) =>
        i === index ? { ...item, year: newValue } : item,
      ),
    );
  };

  const handleDataChange = (index: number, newValue: string) => {
    setValue(prev =>
      prev.map((item, i) =>
        i === index ? { ...item, data: newValue } : item,
      ),
    );
  };

  function parsePastedText(text: string) {
    return text
      .trim()
      .split(/\r?\n/)
      .map(row => row.split(/\t|;/)); 
  }

  // TODO: Ensure normal ctrl+z behavior
  // TODO: We can currently paste as long as we hold ctrl+v, might want to prevent so people dont accidently click another field while pasting (see previous implementation of "isPasting")
  // TODO: escape should remove any newly written contents?

  function handlePaste(
    e: React.ClipboardEvent<HTMLInputElement>,
    startIndex: number,
    targetColumn: string,
  ) {
    e.preventDefault();

    const pastedText = e.clipboardData.getData("text");
    const rows = parsePastedText(pastedText);

    setValue(prev => {
      const next = [...prev];

      rows.forEach((cols, rowOffset) => {
        const rowIndex = startIndex + rowOffset;

        if (!next[rowIndex]) {
          next[rowIndex] = { id: window.crypto.randomUUID(), year: "", data: "" };
        }

        // If we paste into data, we do not want any new data in the previous column (i.e years)
        // If we paste into year, we expect both the year and data column to be filled out data exists
        if (targetColumn === 'data') {
          next[rowIndex] = {
            id: next[rowIndex].id,
            year: next[rowIndex].year,
            data: cols[0] ? cols[0] : "",
          };
        } else {
          next[rowIndex] = {
            id: next[rowIndex].id,
            year: cols[0] ? cols[0] : "",
            data: cols[1] ? cols[1] : "",
          };
        }

      });

      return next;
    });
  }

  function insertRowBottom() {
    setValue((prev) => [
      ...prev,
      {
        id: window.crypto.randomUUID(),
        year: "",
        data: "",
      },
    ]);
  }

  function insertRowAbove() {
    if (!focusedCell) return;

    setValue(prev => [
      ...prev.slice(0, focusedCell.row),
      { id: window.crypto.randomUUID(), year: "", data: "" },
      ...prev.slice(focusedCell.row),
    ]);
  }

  function deleteCurrentRow() {
    if (!focusedCell) return;

    setValue(prev => {
      if (prev.length === 0) return prev;

      const next = prev.filter((_, i) => i !== focusedCell.row);

      // Ensure at least one row exists
      if (next.length === 0) {
        return [{ id: window.crypto.randomUUID(), year: "", data: "" }];
      }

      /* When deleting an item, if we are on the last row, move up. Otherwise stay on the same row. */
      if (focusedCell.row !== value.length - 1) {
        setFocusedCell({row: focusedCell.row, column: focusedCell.column});
      } else {
        setFocusedCell({row: focusedCell.row - 1, column: focusedCell.column});
      }

      return next;
    });
  }

  function deleteCurrentGridCellContents() {
    if (!focusedCell) return;

    setValue(prev =>
      prev.map((item, index) => {
        if (index !== focusedCell.row) return item;

        if (focusedCell.column === 1) { // Delete the year
          return { ...item, year: "" };
        }

        if (focusedCell.column === 2) { // Delete the data
          return { ...item, data: "" };
        }

        return item;
      }),
    );
  }

  // TODO: Cleanup code by checking semantics, css and js for this component and for the grid component
  // TODO: Remove old component

  return (
    <>
      <div className="margin-bottom-25" id={`table-${label.toLowerCase().replace(' ', '-')}`}>{label}</div>
      {/* TODO: Might make sense to make an actual, keyboard navigable menu component */}
      <menu
        className={`flex gap-25 margin-0 gray-95 align-items-center justify-content-space-between ${styles['grid-menu']}`}
        style={{ borderRadius: '.25rem .25rem 0 0', padding: '2px', borderTop: '1px solid var(--gray-80)', borderInline: '1px solid var(--gray-80)' }}
      >
        <div className="flex gap-25 align-items-center">
          <button
            style={{ transform: 'scale(1)' }}
            className="flex gap-50 padding-25 transparent  align-items-center font-size-75"
            type="button"
            onClick={insertRowBottom}
            aria-keyshortcuts="control+insert control+shift+plus"
            data-tooltip="control+insert, control+shift+plus"
            data-testid="add-row-button">
            {t("forms:data_series_input.insert_row_bottom")}
            <IconPlus width={18} height={18} style={{ minWidth: '18px' }} aria-hidden="true" />
          </button>
          <button
            style={{ transform: 'scale(1)' }}
            className="flex gap-50 padding-25 transparent  align-items-center font-size-75"
            type="button"
            onClick={insertRowAbove}
            aria-keyshortcuts="insert control+plus"
            data-tooltip="insert, control+plus"
            data-testid="add-row-above-button">
            {t("forms:data_series_input.insert_row_above")}
            <IconRowInsertTop width={18} height={18} style={{ minWidth: '18px' }} aria-hidden="true" />
          </button>
        </div>
        <div className="flex align-items-center">
          <div className="padding-right-25 margin-right-25" style={{ borderRight: '1px solid var(--gray-80)' }}>
            <button
              style={{ transform: 'scale(1)' }}
              className="flex gap-50 padding-25 padding-inline-50 transparent  align-items-center font-size-75"
              type="button"
              onClick={deleteCurrentRow}
              aria-keyshortcuts="control+- control+delete"
              data-tooltip="control+-, control+delete"
              data-testid="delete-row-button">
              {t("forms:data_series_input.delete_selected_row")}
              <IconTrashXFilled width={18} height={18} fill="#CB3C3C" style={{ minWidth: '18px' }} aria-hidden="true" />
            </button>
          </div>
          <button
            style={{ transform: 'scale(1)' }}
            className=" padding-25 transparent grid"
            type="button"
            onClick={() => setGridExpanded(!gridExpanded)}
            data-testid="expand-grid-button">
            {gridExpanded ?
              <IconArrowsMinimize width={20} height={20} style={{ minWidth: '20px' }} aria-label={t("forms:data_series_input.hide_table")} />
              :
              <IconArrowsMaximize width={20} height={20} style={{ minWidth: '20px' }} aria-label={t("forms:data_series_input.show_table")} />
            }
          </button>
        </div>
      </menu>

      {outputFormElement ? React.cloneElement(outputFormElement, {
        value: JSON.stringify({
          dateValues: value.every(({ year, data }) => !year && !data)
            ? {}
            : Object.fromEntries(
                value.map(({ year, data }) => [
                  `${year}-01-01T00:00:00.000Z`,
                  data === "" ? null : Number(data),
                ]),
              ),
        }),
        type: "hidden",
        hidden: true,
        readOnly: true,
      }) : null}

      <Grid
        ariaLabelledBy={`table-${label.toLowerCase().replace(' ', '-')}`}
        focusedCell={focusedCell}
        setFocusedCell={setFocusedCell}
        insertRowBottom={insertRowBottom}
        insertRowAbove={insertRowAbove}
        deleteCurrentRow={deleteCurrentRow}
        deleteCurrentGridCellContents={deleteCurrentGridCellContents}
        props={{
          id: id,
          className: `grid width-100 align-items-center ${styles['grid']}`,
          style: { gridTemplateColumns: 'auto auto 1fr', height: gridExpanded ? 'auto' : '0', borderBottom: gridExpanded ? '1px solid var(--gray-80)' : '0' },
        }}
      >
        <Grid.ColumnHeader className="text-align-left">#</Grid.ColumnHeader>
        <Grid.ColumnHeader className={`text-align-left overflow-hidden ${focusedCell?.column === 1 ? styles['active-header'] : ''} `} style={{ resize: 'horizontal', minWidth: 'fit-content', width: '100px' }}>{t("forms:data_series_input.year")}</Grid.ColumnHeader>
        <Grid.ColumnHeader className={`text-align-left ${focusedCell?.column === 2 ? styles['active-header'] : ''} `}>{t("forms:data_series_input.value")}</Grid.ColumnHeader>
        {value.flatMap((item, index) => {
          return [
            <Grid.Row key={item.id}>
              <Grid.RowHeader
                className={`grid place-items-center ${focusedCell?.row === index ? styles['active-header'] : ''} `}
              >
                {index}
              </Grid.RowHeader>
              <Grid.Cell
                style={{ minWidth: '100%', width: '0' }}
              >
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  required={true}
                  tabIndex={-1}
                  value={item.year === null ? '' : String(item.year)}
                  onChange={(e) => handleYearChange(index, e.target.value)}
                  onPaste={(e) => {
                    // Make sure the pasted input is valid before handling paste
                    const pasted = e.clipboardData.getData("text");
                    if (!isValidPastedInput(pasted)) {
                      e.preventDefault();
                    } else {
                      handlePaste(e, index, 'year');
                    }
                  }}
                />
              </Grid.Cell>
              <Grid.Cell>
                <input
                  type="text"
                  inputMode="decimal"
                  pattern="/[-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?/" // TODO: Figure this pattern out... (This seemingly works but stackoverflow calls it questionable?) (replace \. with [.,] to allow commas)
                  tabIndex={-1}
                  value={item.data === null ? '' : String(item.data)}
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
            </Grid.Row>,
          ];
        })}
      </Grid>
    </>
  );
}