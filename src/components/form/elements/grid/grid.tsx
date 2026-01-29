"use client"

import { GenericElement, Position, GridElement } from "@/components/types"
import React, { useEffect, useState } from "react"
import { handleKeyDownGrid } from "./functions"

const GridCell = React.forwardRef<HTMLDivElement, GridElement>(
  ({ className, style, children, position, tabIndex, onKeyDown, onClick }, ref) => (
    <div
      className={`${className ? `${className} ` : ''}`}
      style={{ ...(style || {}) }}
      ref={ref}
      role="gridcell"
      tabIndex={tabIndex}
      data-row={position?.row}
      data-column={position?.column}
      onKeyDown={onKeyDown}
      onClick={onClick}
    >
      {children}
    </div>
  )
)
GridCell.displayName = "GridCell"

const RowHeader = React.forwardRef<HTMLDivElement, GridElement>(
  ({ className, style, children, position, tabIndex, onKeyDown, onClick }, ref) => (
    <div
      className={`${className ? `${className} ` : ''}`}
      style={{ ...(style || {}) }}
      ref={ref}
      role="rowheader"
      tabIndex={tabIndex}
      data-row={position?.row}
      data-column={position?.column}
      onKeyDown={onKeyDown}
      onClick={onClick}
    >
      {children}
    </div>
  )
)
RowHeader.displayName = "RowHeader"

const ColumnHeader = React.forwardRef<HTMLDivElement, GridElement>(
  ({ className, style, children, position, onKeyDown, onClick }, ref) => (
    <div
      className={`${className ? `${className} ` : ''}`}
      style={{ ...(style || {}) }}
      ref={ref}
      role="columnheader"
      tabIndex={-1}
      data-row={position?.row}
      data-column={position?.column}
      onKeyDown={onKeyDown}
      onClick={onClick}
    >
      {children}
    </div>
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

  const [activeCell, setActivecell] = useState<Position>({ row: 0, column: 0 })

  const cellRefs = React.useRef<Map<string, HTMLDivElement>>(new Map())
  const keyFor = (row: number, column: number) => `${row}-${column}`

  useEffect(() => {
    const key = keyFor(activeCell.row, activeCell.column)
    const cell = cellRefs.current.get(key)
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

  const amountColumns = childrenArray.filter(
    (child) =>
      React.isValidElement(child) &&
      child.type === Grid.ColumnHeader
  ).length

  return (
    <div
      className={`${props.className ? `${props.className} ` : ''}`}
      style={{ ...props.style }}
      role="grid"
      aria-labelledby="" // Remember to pass this in props
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
      {React.Children.map(children, (child, index) => {
        if (
          !React.isValidElement(child) ||
          (child.type !== GridCell && child.type !== RowHeader)
        ) {
          return child
        }

        const row = Math.floor(index / amountColumns)
        const column = index % amountColumns

        let tabIndex: 0 | -1 = -1
        if (activeCell.row === row && activeCell.column === column) { tabIndex = 0 }
        return React.cloneElement(
          child as React.ReactElement<GridElement & React.RefAttributes<HTMLDivElement>>,
          {
            position: { row, column },
            tabIndex,
            onKeyDown: (e) =>
              handleKeyDownGrid({
                e,
                amountColumns,
                children,
                activeCell,
                setActivecell,
              }),
            onClick: () => setActivecell({ row: row, column: column }), // Note that this might cause issues if our input inside the div is smaller than the actual div as we don't set focus here 
            ref: (el: HTMLDivElement | null) => {
              if (!el) return
              cellRefs.current.set(keyFor(row, column), el)
            }
          }
        )
      })}
    </div>
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

