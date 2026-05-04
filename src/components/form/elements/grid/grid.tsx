"use client"

import type { GenericElement, GridCell, GridColumnHeader, GridRowHeader, GridRow } from "@/components/types"
import React, { useEffect, useState } from "react"
import { handleKeyDownGrid } from "./functions"

function setFocusOnGridcell(
  activeCell: { row: number, column: number },
) {
  const cell = document.querySelector<HTMLElement>( // TODO: Probably pass like an id so we select the correct grid 
    `[data-row="${activeCell.row}"][data-column="${activeCell.column}"]`
  )
  if (!cell) return

  cell.focus()
}

function setFocusInGridcell(
  activeCell: { row: number, column: number },
) {
  const cell = document.querySelector<HTMLElement>( // TODO: Probably pass like an id so we select the correct grid 
    `[data-row="${activeCell.row}"][data-column="${activeCell.column}"]`
  )
  if (!cell) return

  const focusable = cell.querySelector<HTMLElement>(
    'input, textarea, select, button, [tabindex]:not([tabindex="-1"])'
  )
  if (!focusable) return
  focusable.focus()
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
  deleteCurrentRow
}: {
  ariaLabelledBy: string;
  props: GenericElement;
  children: React.ReactNode;
  activeCell: { row: number; column: number }; // TODO: RENAME --> FocusedCell
  setActiveCell: React.Dispatch<React.SetStateAction<{ row: number; column: number }>>; // TODO: RENAME --> SetFocusedCell
  insertRowBottom: () => void;
  insertRowAbove: () => void;
  deleteCurrentRow: () => void;
}) {

  const [editMode, setEditMode] = useState<boolean>(false)

  useEffect(() => { // TODO: Not entirely conviced that i like this...
    setFocusOnGridcell({ row: activeCell.row, column: activeCell.column })

    if (editMode) {
      setFocusInGridcell({ row: activeCell.row, column: activeCell.column })
    }
  }, [activeCell, editMode])

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
      className={`${props.className ? `${props.className} ` : ''}`}
      style={{ ...props.style }}
      role="grid"
      aria-labelledby={ariaLabelledBy}
      onFocusCapture={(e) => { /* Todo: We currently need to shift+tab tab twice to escape the grid. We likely want to set tabindex -1 if there is a focused child.   */
        const grid = e.currentTarget as HTMLElement
        const target = e.target as HTMLElement
        const previous = e.relatedTarget as HTMLElement | null

        if (previous && grid.contains(previous)) return

        const cell = target.closest<HTMLElement>(
          '[role="gridcell"], [role="rowheader"]'
        )

        if (!cell) return

        const row = Number(cell.dataset.row)
        const column = Number(cell.dataset.column)

        if (!Number.isNaN(row) && !Number.isNaN(column)) {
          setActiveCell(prev => {
            if (prev.row === row && prev.column === column) return prev
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
                  activeCell.row === rowIndex &&
                  activeCell.column === columnIndex

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
                    }),
                  onClick: () => {
                    if (activeCell.row !== rowIndex || activeCell.column !== columnIndex) {
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


