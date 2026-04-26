"use client"

import type { GenericElement, GridCell, GridColumnHeader, GridRowHeader } from "@/components/types"
import React, { useEffect, useState } from "react"
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

const RowHeader = React.forwardRef<HTMLTableCellElement, GridRowHeader>(
  ({ className, style, children}, ref) => (
    <th
      className={`${className ? `${className} ` : ''}`}
      style={{ ...(style ?? {}) }}
      ref={ref}
      role="rowheader"
    >
      {children}
    </th>
  )
)
RowHeader.displayName = "RowHeader"

const ColumnHeader = React.forwardRef<HTMLTableCellElement, GridColumnHeader>(
  ({ className, style, children}, ref) => (
    <th
      className={`${className ? `${className} ` : ''}`}
      style={{ ...(style ?? {}) }}
      ref={ref}
      role="columnheader"
     >
      {children}
    </th>
  )
)
ColumnHeader.displayName = "ColumnHeader"

/***
 * A css grid needs to be defined and passed under props for layout
 */
export default function Grid({
  props,
  children
}: {
  props: GenericElement
  children: React.ReactNode
}) {
  // TODO: Add like a check that the amount of children is divisible by the amount of columns or something 
  // to ensure that we have the correct amount of children

  const [activeCell, setActivecell] = useState<{row: number, column: number}>({ row: 0, column: 0 })

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

    if (focusable) {
      focusable.focus()
    } else {
      cell.focus()
    }
  }, [activeCell])

  const childrenArray = React.Children.toArray(children)

  // Split elements
  const columnHeaders = childrenArray.filter(
    (child) =>
      React.isValidElement(child) &&
      child.type === Grid.ColumnHeader
  )

  const bodyCells = childrenArray.filter(
    (child) =>
      React.isValidElement(child) &&
      (child.type === GridCell || child.type === RowHeader)
  )

  const amountColumns = columnHeaders.length

  // Chunk into rows
  const rows = bodyCells.reduce<React.ReactNode[][]>(
    (rowsCollection, currentChild, currentIndex) => {
      const computedRowIndex = Math.floor(currentIndex / amountColumns)

      if (!rowsCollection[computedRowIndex]) {
        rowsCollection[computedRowIndex] = []
      }

      rowsCollection[computedRowIndex].push(currentChild)

      return rowsCollection
    },
    []
  )

  
  return (
    <table
      ref={gridRef}
      className={`${props.className ? `${props.className} ` : ''}`}
      style={{ ...props.style }}
      role="grid"
      aria-labelledby="" // Todo: Remember to pass this in props
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
          setActivecell({ row, column })
        }
      }}
    >
      {/* Header */}
      <thead className="display-contents">
        <tr className="display-contents">
          {columnHeaders.map((child) => {
            if (!React.isValidElement(child)) return child

            return React.cloneElement(child)
          })}
        </tr>
      </thead>

      {/* Body */}
      <tbody className="display-contents">
        {rows.map((rowChildren, row) => (
          <tr key={row} className="display-contents">
            {rowChildren.map((child, column) => {
              if (
                !React.isValidElement(child) ||
                (child.type !== GridCell && child.type !== RowHeader)
              ) {
                return child
              }

              const isActive =
                activeCell.row === row && activeCell.column === column

              return React.cloneElement(
                child as React.ReactElement<
                  GridCell & React.RefAttributes<HTMLTableCellElement>
                >,
                {
                  position: { row, column },
                  tabIndex: isActive ? 0 : -1,
                  onKeyDown: (e) =>
                    handleKeyDownGrid({
                      e,
                      amountColumns,
                      children,
                      activeCell,
                      setActivecell,
                    }),
                  onClick: () => setActivecell({ row, column }),
                }
              )
            })}
          </tr>
        ))}
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
Grid.ColumnHeader = ColumnHeader

