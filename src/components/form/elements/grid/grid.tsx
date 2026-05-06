"use client"

import type { GridCell, GridColumnHeader, GridRowHeader, GridRow, GridElement } from "@/components/types"
import React, { useEffect, useState } from "react"
import { handleKeyDownGrid } from "./functions"

function setFocusOnGridcell(
  id: string,
  focusedCell: { row: number, column: number },
) {
  const grid = document.getElementById(id)
  if (!grid) return

  const cell = grid.querySelector<HTMLElement>(
    `[data-row="${focusedCell.row}"][data-column="${focusedCell.column}"]`,
  )
  if (!cell) return

  cell.focus()
}

function setFocusInGridcell(
  id: string,
  focusedCell: { row: number; column: number },
) {
  const grid = document.getElementById(id)
  if (!grid) return

  const cell = grid.querySelector<HTMLElement>(
    `[data-row="${focusedCell.row}"][data-column="${focusedCell.column}"]`,
  )
  if (!cell) return

  const focusable = cell.querySelector<HTMLElement>(
    'input, textarea, select, button, [tabindex]:not([tabindex="-1"])',
  )
  focusable?.focus()
}

const GridCell = React.forwardRef<HTMLTableCellElement, GridCell>(
  ({ className, style, children, position, tabIndex, onKeyDown, onClick, onDoubleClick }, ref) => (
    <td
      className={`${className ? `${className} ` : ''}`}
      style={{ ...(style ?? {}) }}
      ref={ref}
      role="gridcell"
      tabIndex={tabIndex}
      data-row={position?.row}
      data-column={position?.column}
      onKeyDown={onKeyDown}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      {children}
    </td>
  ),
)
GridCell.displayName = "GridCell"

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
)
GridRow.displayName = "GridRow"

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
)
RowHeader.displayName = "RowHeader"

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
)
ColumnHeader.displayName = "ColumnHeader"


function isGridRow(
  child: React.ReactNode,
): child is React.ReactElement<GridRow> {
  return React.isValidElement(child) && child.type === GridRow
}

function isGridCell(
  child: React.ReactNode,
): child is React.ReactElement<
  React.ComponentProps<typeof GridCell>
> {
  return (
    React.isValidElement(child) &&
    (child.type === GridCell || child.type === RowHeader)
  )
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

  const [editMode, setEditMode] = useState<boolean>(false)

  useEffect(() => {
    if (!focusedCell) return

    setFocusOnGridcell(props.id, { row: focusedCell.row, column: focusedCell.column })

    if (editMode) {
      setFocusInGridcell(props.id, { row: focusedCell.row, column: focusedCell.column })
    }
  }, [props.id, focusedCell, editMode])

  const childrenArray = React.Children.toArray(children)

  const columnHeaders = childrenArray.filter(
    (child) =>
      React.isValidElement(child) &&
      child.type === Grid.ColumnHeader,
  )

  const bodyRows = childrenArray.filter(isGridRow)

  return (
    <table
      id={props.id}
      className={`${props.className ? `${props.className} ` : ''}`}
      style={{ ...props.style }}
      role="grid"
      aria-labelledby={ariaLabelledBy}
      onFocusCapture={() => {
        if (!focusedCell) {
          setFocusedCell({row: 0, column: 1}) // Column 0 are unfocusable rowheaders
        }  
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
          const rowChildren = React.Children.toArray(rowElement.props.children)

          return (
            <tr key={rowIndex} className="display-contents">
              {rowChildren.map((child, columnIndex) => {
                if (!isGridCell(child)) return child

                const isFocusable = focusedCell
                  ? focusedCell.row === rowIndex && focusedCell.column === columnIndex
                  : rowIndex === 0 && columnIndex === 1; // Column index 1 as headerrows count as column 0 

                return React.cloneElement(child, {
                  position: { row: rowIndex, column: columnIndex },
                  tabIndex: isFocusable ? 0 : -1,
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
                  onClick: () => {
                    if (!focusedCell) {
                      setFocusedCell({ row: 0, column: 1 }) // Column 0 are unfocusable rowheaders
                    }

                    if (focusedCell && (focusedCell.row !== rowIndex || focusedCell.column !== columnIndex)) {
                      setEditMode(false)  // Exit edit mode (only) when pressing another cell
                    }

                    setFocusedCell({
                      row: rowIndex,
                      column: columnIndex,
                    })
                  },
                  onDoubleClick: () => {
                    setEditMode(true) // Enter edit mode when double clicking a cell
                  },
                })
              })}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

/***
*  Remember to set tabindex -1 for children if they are focusable, i.e inputs
*/
Grid.Cell = GridCell
/***
*  Remember to set tabindex -1 for children if they are focusable, i.e inputs
*/
Grid.RowHeader = RowHeader
Grid.Row = GridRow
Grid.ColumnHeader = ColumnHeader


