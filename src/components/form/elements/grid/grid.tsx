"use client";

import type { GridCell, GridColumnHeader, GridRowHeader, GridRow, GridElement } from "@/components/types";
import React, { useEffect, useState } from "react";
import { handleKeyDownGrid } from "./functions";

/* pointerType of the latest pointerdown in any grid. click events don't carry
 * pointerType, so the cell click handler reads the gesture's pointer type from
 * here. Module scope rather than a ref: only one pointer interaction happens at
 * a time, and eslint's react-hooks/refs can't follow refs through cloneElement props. */
let lastPointerType: string | null = null;

/** Whether the interaction that led to a click came from a coarse pointer (finger/pen).
 * Prefer the per-event pointerType so hybrid devices behave right; fall back to a
 * media query for browsers without pointer events. */
function isCoarsePointer(pointerType: string | null) {
  if (pointerType === "touch" || pointerType === "pen") return true;
  if (pointerType === "mouse") return false;
  return typeof window !== "undefined" && !!window.matchMedia?.("(pointer: coarse)").matches;
}


function setFocusOnGrid(
  id: string,
) {
  const grid = document.getElementById(id);
  if (!grid) return;

  grid.focus();
}

function setFocusOnGridcell(
  id: string,
  focusedCell: { row: number, column: number },
) {
  const grid = document.getElementById(id);
  if (!grid) return;

  const cell = grid.querySelector<HTMLElement>(
    `[data-row="${focusedCell.row}"][data-column="${focusedCell.column}"]`,
  );
  if (!cell) return;
  
  cell.focus();
}

function setFocusInGridcell(
  id: string,
  focusedCell: { row: number; column: number },
) {
  const grid = document.getElementById(id);
  if (!grid) return;

  const cell = grid.querySelector<HTMLElement>(
    `[data-row="${focusedCell.row}"][data-column="${focusedCell.column}"]`,
  );
  if (!cell) return;

  const focusable = cell.querySelector<HTMLElement>(
    'input, textarea, select, button, [tabindex]:not([tabindex="-1"])',
  );
  focusable?.focus();
}

const GridCell = React.forwardRef<HTMLTableCellElement, GridCell>(
  ({ className, style, children, tabIndex, ariaSelected, position, onKeyDown, onClick, onDoubleClick }, ref) => (
    <td
      className={`${className ? `${className} ` : ''}`}
      style={{ ...(style ?? {}) }}
      ref={ref}
      role="gridcell"
      tabIndex={tabIndex}
      aria-selected={ariaSelected}
      data-row={position?.row}
      data-column={position?.column}
      onKeyDown={onKeyDown}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      {children}
    </td>
  ),
);
GridCell.displayName = "GridCell";

const GridRow = React.forwardRef<HTMLTableRowElement, GridRow>(
  ({ className, style, children }, ref) => (
    <tr
      ref={ref}
      className={`${className ? `${className} ` : ''}`}
      style={{ ...(style ?? {}) }}
    >
      {children}
    </tr>
  ),
);
GridRow.displayName = "GridRow";

const RowHeader = React.forwardRef<HTMLTableCellElement, GridRowHeader>(
  ({ className, style, children }, ref) => (
    <th
      ref={ref}
      className={`${className ? `${className} ` : ''}`}
      style={{ ...(style ?? {}) }}
      role="rowheader"
    >
      {children}
    </th>
  ),
);
RowHeader.displayName = "RowHeader";

const ColumnHeader = React.forwardRef<HTMLTableCellElement, GridColumnHeader>(
  ({ className, style, children }, ref) => (
    <th
      ref={ref}
      className={`${className ? `${className} ` : ''}`}
      style={{ ...(style ?? {}) }}
      role="columnheader"
    >
      {children}
    </th>
  ),
);
ColumnHeader.displayName = "ColumnHeader";


function isGridRow(
  child: React.ReactNode,
): child is React.ReactElement<GridRow> {
  return React.isValidElement(child) && child.type === GridRow;
}

function isGridCell(
  child: React.ReactNode,
): child is React.ReactElement<
  React.ComponentProps<typeof GridCell>
> {
  return (
    React.isValidElement(child) &&
    (child.type === GridCell || child.type === RowHeader)
  );
}

/***
 * A css grid needs to be defined and passed under props for layout
 */
export default function Grid({
  ariaLabelledBy,
  props,
  children,
  focusedCell,
  setFocusedCell,
  insertRowBottom,
  insertRowAbove,
  deleteCurrentRow,
  deleteCurrentGridCellContents,
}: {
  ariaLabelledBy: string;
  props: GridElement;
  children: React.ReactNode;
  focusedCell: { row: number; column: number } | null;
  setFocusedCell: React.Dispatch<React.SetStateAction<{ row: number; column: number } | null>>;
  insertRowBottom: () => void;
  insertRowAbove: () => void;
  deleteCurrentRow: () => void;
  deleteCurrentGridCellContents: (cell: { row: number; column: number }) => void;
}) {

  const [editMode, setEditMode] = useState<boolean>(false);

  useEffect(() => {
    if (!focusedCell) {
      setFocusOnGrid(props.id);
      return;
    }

    /* When editing, focus the input directly instead of going via the cell:
     * a blur+refocus here would close an on-screen keyboard already raised by
     * the touch tap handler below. focus() on the already-focused element is a no-op. */
    if (editMode) {
      setFocusInGridcell(props.id, { row: focusedCell.row, column: focusedCell.column });
    } else {
      setFocusOnGridcell(props.id, { row: focusedCell.row, column: focusedCell.column });
    }
  }, [props.id, focusedCell, editMode]);

  /* No double-tap on touch: a tap selects the cell and edits it directly.
   * The input must be focused synchronously in the gesture's call stack
   * (not in the focus effect) or mobile browsers won't raise the soft keyboard. */
  function enterEditOnCell(rowIndex: number, columnIndex: number) {
    setFocusedCell({ row: rowIndex, column: columnIndex });
    setEditMode(true);
    setFocusInGridcell(props.id, { row: rowIndex, column: columnIndex });
  }

  function handleCellClick(rowIndex: number, columnIndex: number) {
    if (!focusedCell) {
      setFocusedCell({ row: 0, column: 1 }); // Column 0 are unfocusable rowheaders
    }

    if (focusedCell && (focusedCell.row !== rowIndex || focusedCell.column !== columnIndex)) {
      setEditMode(false);  // Exit edit mode (only) when pressing another cell
    }

    setFocusedCell({
      row: rowIndex,
      column: columnIndex,
    });

    /* click is the last event of a tap (after the compatibility mousedown has
     * settled native focus), so nothing steals focus from the input afterwards. */
    if (isCoarsePointer(lastPointerType)) {
      enterEditOnCell(rowIndex, columnIndex);
    }
  }

  const childrenArray = React.Children.toArray(children);

  const columnHeaders = childrenArray.filter(
    (child) =>
      React.isValidElement(child) &&
      child.type === Grid.ColumnHeader,
  );

  const bodyRows = childrenArray.filter(isGridRow);
  
  return (
    <table
      id={props.id}
      className={`${props.className ? `${props.className} ` : ''}`}
      style={{ ...props.style }}
      role="grid"
      aria-labelledby={ariaLabelledBy}
      onFocusCapture={() => {
        /* Functional update: a tap's click handler may have already selected a cell
         * in the same event batch (its focus() lands here), and that selection must win. */
        setFocusedCell((previous) => previous ?? { row: 0, column: 1 }); // Column 0 are unfocusable rowheaders
      }}
      onPointerDownCapture={(e) => {
        lastPointerType = e.pointerType || null;
      }}
    >
      <thead className="display-contents">
        <tr className="display-contents">
          {columnHeaders.map((child) =>
            React.isValidElement(child) ? React.cloneElement(child) : child,
          )}
        </tr>
      </thead>

      <tbody className="display-contents">
        {bodyRows.map((rowElement, rowIndex) => {
          const rowChildren = React.Children.toArray(rowElement.props.children);

          return (
            <tr key={rowIndex} className="display-contents">
              {rowChildren.map((child, columnIndex) => {
                if (!isGridCell(child)) return child;
                
                const isFocusable = focusedCell
                  ? focusedCell.row === rowIndex && focusedCell.column === columnIndex
                  : rowIndex === 0 && columnIndex === 1; // Column index 1 as headerrows count as column 0 

                return React.cloneElement(child, {
                  /* Might want to revert to previous way of handling tabindex (set tabindex to 0 for focused cell and then disable tab navigation in grid, 
                  this will retain tabindex when tabbing out and we won't have to deal with resetting it when handling onclick stuff) */
                  tabIndex: isFocusable ? 0 : -1,
                  ariaSelected: (focusedCell?.row === rowIndex && focusedCell.column === columnIndex) ? true : false, 
                  position: { row: rowIndex, column: columnIndex },
                  onKeyDown: (event) =>
                    handleKeyDownGrid({
                      e: event,
                      amountColumns: columnHeaders.length,
                      amountRows: bodyRows.length,
                      focusedCell,
                      setFocusedCell,
                      editMode,
                      setEditMode,
                      insertRowBottom,
                      insertRowAbove,
                      deleteCurrentRow,
                      deleteCurrentGridCellContents,
                    }),
                  onClick: () => handleCellClick(rowIndex, columnIndex),
                  onDoubleClick: () => {
                    setEditMode(true); // Enter edit mode when double clicking a cell
                  },
                });
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/***
*  Remember to set tabindex -1 for children if they are focusable, i.e inputs
*/
Grid.Cell = GridCell;
/***
*  Remember to set tabindex -1 for children if they are focusable, i.e inputs
*/
Grid.RowHeader = RowHeader;
Grid.Row = GridRow;
Grid.ColumnHeader = ColumnHeader;


