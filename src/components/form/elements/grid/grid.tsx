"use client"

import type { GenericElement, GridCell, GridColumnHeader, GridRowHeader, GridRow } from "@/components/types"
import React, { useEffect } from "react"
import { handleKeyDownGrid } from "./functions"

const GridCell = React.forwardRef<HTMLTableCellElement, GridCell>(
  ({ className, style, children, position, tabIndex, onKeyDown, onClick }, ref) => (
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
  activeCell: { row: number; column: number };
  setActiveCell: React.Dispatch<React.SetStateAction<{ row: number; column: number }>>;
  insertRowBottom: () => void;
  insertRowAbove: () => void;
  deleteCurrentRow: () => void;
}) {
  const gridRef = React.useRef<HTMLTableElement | null>(null)

  useEffect(() => {
    const grid = gridRef.current
    if (!grid) return

    const cell = grid.querySelector<HTMLElement>(
      `[data-row="${activeCell.row}"][data-column="${activeCell.column}"][role="gridcell"], [data-row="${activeCell.row}"][data-column="${activeCell.column}"][role="rowheader"]`
    )
    if (!cell) return
 
    const focusable = cell.querySelector<HTMLElement>(
      'input, textarea, select, button, [tabindex]:not([tabindex="-1"])'
    )


    if (focusable && document.activeElement !== focusable) { // TODO: This doesnt work when pressing using a mouse as we already focus the activeelement... (when we include an edit move we can simply just keep cell.focus here)
      focusable.focus()
    } else {
      cell.focus()
    }
  }, [activeCell])

  const childrenArray = React.Children.toArray(children)

  const columnHeaders = childrenArray.filter(
    (child) =>
      React.isValidElement(child) &&
      child.type === Grid.ColumnHeader
  )

  const bodyRows = childrenArray.filter(isGridRow)

  return (
    <table
      ref={gridRef}
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
                      children,
                      activeCell,
                      setActiveCell,
                      insertRowBottom,
                      insertRowAbove,
                      deleteCurrentRow
                    }),
                  onClick: () => 
                    setActiveCell({
                      row: rowIndex,
                      column: columnIndex,
                    }),
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


