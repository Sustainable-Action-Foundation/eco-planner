"use client"

import type { GridCell, GridColumnHeader, GridRowHeader, GridRow, GridElement } from "@/components/types"
import React, { useEffect, useState } from "react"
import { handleKeyDownGrid } from "./functions"

// TODO: Check that tabindex is properly handled

function setFocusOnGridcell(
  id: string,
  activeCell: { row: number, column: number },
) {
  const grid = document.getElementById(id)
  if (!grid) return

  const cell = grid.querySelector<HTMLElement>(
    `[data-row="${activeCell.row}"][data-column="${activeCell.column}"]`
  )
  if (!cell) return

  cell.focus()
}

function setFocusInGridcell(
  id: string,
  activeCell: { row: number; column: number },
) {
  const grid = document.getElementById(id)
  if (!grid) return

  const cell = grid.querySelector<HTMLElement>(
    `[data-row="${activeCell.row}"][data-column="${activeCell.column}"]`
  )
  if (!cell) return

  const focusable = cell.querySelector<HTMLElement>(
    'input, textarea, select, button, [tabindex]:not([tabindex="-1"])'
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
  )
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
  )
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
  )
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
  )
)
ColumnHeader.displayName = "ColumnHeader"


function isGridRow(
  child: React.ReactNode
): child is React.ReactElement<GridRow> {
  return React.isValidElement(child) && child.type === GridRow
}

function isGridCell(
  child: React.ReactNode
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
  activeCell,
  setActiveCell,
  insertRowBottom,
  insertRowAbove,
  deleteCurrentRow,
  deleteCurrentGridCellContents
}: {
  ariaLabelledBy: string;
  props: GridElement;
  children: React.ReactNode;
  activeCell: { row: number; column: number } | null; // TODO: RENAME --> FocusedCell
  setActiveCell: React.Dispatch<React.SetStateAction<{ row: number; column: number } | null>>; // TODO: RENAME --> SetFocusedCell
  insertRowBottom: () => void;
  insertRowAbove: () => void;
  deleteCurrentRow: () => void;
  deleteCurrentGridCellContents: (cell: { row: number; column: number }) => void;
}) {

  const [editMode, setEditMode] = useState<boolean>(false)

  useEffect(() => { 
    if (!activeCell) return

    setFocusOnGridcell(props.id, { row: activeCell.row, column: activeCell.column })

    if (editMode) {
      setFocusInGridcell(props.id, { row: activeCell.row, column: activeCell.column })
    }
  }, [props.id, activeCell, editMode])

  const childrenArray = React.Children.toArray(children)

  const columnHeaders = childrenArray.filter(
    (child) =>
      React.isValidElement(child) &&
      child.type === Grid.ColumnHeader
  )

  const bodyRows = childrenArray.filter(isGridRow)

  // TODO: Gotta make sure to unset edit mode if we lose focus of the grid!

  return (
    <table
      id={props.id}
      className={`${props.className ? `${props.className} ` : ''}`}
      style={{ ...props.style }}
      role="grid"
      aria-labelledby={ariaLabelledBy}
      onFocusCapture={(e) => {
        const grid = e.currentTarget as HTMLElement
        const target = e.target as HTMLElement
        const previous = e.relatedTarget as HTMLElement | null

        if (previous && grid.contains(previous)) return

        const cell = target.closest<HTMLElement>('[role="gridcell"]')
        if (!cell) return

        const row = Number(cell.dataset.row)
        const column = Number(cell.dataset.column)

        if (!activeCell) {
          setActiveCell({row: 0, column: 1}) // Column 0 are unfocusable rowheaders
        } else if (!Number.isNaN(row) && !Number.isNaN(column) && activeCell) {
          setActiveCell(prev => {
            if (prev?.row === row && prev?.column === column) return prev
            return { row, column }
          })
        }
      }}
    >
      {/* Header */}
      <thead className="display-contents">
        <tr className="display-contents">
          {columnHeaders.map((child) =>
            React.isValidElement(child) ? React.cloneElement(child) : child
          )}
        </tr>
      </thead>

      {/* Body */}
      <tbody className="display-contents">
        {bodyRows.map((rowElement, rowIndex) => {
          const rowChildren = React.Children.toArray(rowElement.props.children)

          return (
            <tr key={rowIndex} className="display-contents">
              {rowChildren.map((child, columnIndex) => {
                if (!isGridCell(child)) return child

                const isActive =
                  activeCell?.row === rowIndex &&
                  activeCell?.column === columnIndex

                return React.cloneElement(child, {
                  position: { row: rowIndex, column: columnIndex },
                  tabIndex: isActive ? 0 : -1,
                  onKeyDown: (event) =>
                    handleKeyDownGrid({
                      e: event,
                      amountColumns: columnHeaders.length,
                      amountRows: bodyRows.length,
                      activeCell,
                      setActiveCell,
                      editMode,
                      setEditMode,
                      insertRowBottom,
                      insertRowAbove,
                      deleteCurrentRow,
                      deleteCurrentGridCellContents
                    }),
                  onClick: () => {
                    if (!activeCell) {
                      setActiveCell({row: 0, column: 1}) // Column 0 are unfocusable rowheaders
                    } 

                    if (activeCell && (activeCell.row !== rowIndex || activeCell.column !== columnIndex)) {
                      setEditMode(false)  // Exit edit mode (only) when pressing another cell
                    }

                    setActiveCell({
                      row: rowIndex,
                      column: columnIndex,
                    })
                  },
                  onDoubleClick: () => {
                    setEditMode(true) // Enter edit mode when double clicking a cell
                  }
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


