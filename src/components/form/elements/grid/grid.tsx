import { GenericElement } from "@/components/types"
import React, { useEffect, useState } from "react"

// TODO: Abstract keycontrols
// TODO: Figure out if we beed pageup/pagedown
// TODO: Handle columnheaders the same as gridcells
// TODO: Allow passing props to gridcells (generic html element?)

type coordinates = {
  row: number
  column: number
}

type GridItemProps = {
  position?: coordinates
  children: React.ReactNode
  tabIndex?: 0 | -1
  onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>,
  onClick?: React.MouseEventHandler<HTMLDivElement> 
}

const GridCell = React.forwardRef<HTMLDivElement, GridItemProps>(
  ({ children, position, tabIndex, onKeyDown, onClick }, ref) => (
    <div
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

const RowHeader = React.forwardRef<HTMLDivElement, GridItemProps>(
  ({ children, position, tabIndex, onKeyDown, onClick }, ref) => (
    <div
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

/***
 * A css grid needs to be defined and passed under props for layout
 */
export default function Grid({
  props,
  columns,
  children
}: {
  props: GenericElement
  columns: Array<string>
  children: React.ReactNode
}) {
  // TODO: Add like a check that the amount of children is divisible by the amount of columns or something 
  // to ensure that we have the correct amount of children

  const [coordinates, setCoordinates] = useState<{ row: number, column: number }>({ row: 0, column: 0 }) /* TODO: Switch name to active cell or somn... */

  const cellRefs = React.useRef<Map<string, HTMLDivElement>>(new Map())
  const keyFor = (row: number, column: number) => `${row}-${column}`

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (coordinates.row === (React.Children.count(children) / columns.length) - 1) return // Total amount of rows minus 1 to get index
      setCoordinates({ row: coordinates.row + 1, column: coordinates.column })
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (coordinates.row === 0) return
      setCoordinates({ row: coordinates.row - 1, column: coordinates.column })
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      if (coordinates.column === columns.length - 1) return
      setCoordinates({ row: coordinates.row, column: coordinates.column + 1 })
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      if (coordinates.column === 0) return
      setCoordinates({ row: coordinates.row, column: coordinates.column - 1 })
    }
    if (e.key === 'Home') {
      e.preventDefault()
      setCoordinates({ row: coordinates.row, column: 0 })
    }
    if (e.key === 'End') {
      e.preventDefault()
      setCoordinates({ row: coordinates.row, column: columns.length - 1 })
    }
    if (e.key === 'Home' && e.ctrlKey) {
      e.preventDefault()
      setCoordinates({ row: 0, column: 0 })
    }
    if (e.key === 'End' && e.ctrlKey) {
      e.preventDefault()
      setCoordinates({ row: (React.Children.count(children) / columns.length) - 1, column: columns.length - 1 })
    }
  }

  useEffect(() => {
    const key = keyFor(coordinates.row, coordinates.column)
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
  }, [coordinates])


  return (
    <div
      className={`${props.className ? `${props.className} ` : ''}`}
      style={{ ...props.style }}
      role="grid"
      aria-labelledby="" // Remember to pass this in props
    >
      {columns.map((column: string, index: number) => (
        <div role="columnheader" key={index}>{column}</div>
      ))}
      {React.Children.map(children, (child, index) => {
        if (
          !React.isValidElement(child) ||
          (child.type !== GridCell && child.type !== RowHeader)
        ) {
          return child
        }

        const row = Math.floor(index / columns.length)
        const column = index % columns.length

        let tabIndex: 0 | -1 = -1
        if (coordinates.row === row && coordinates.column === column) { tabIndex = 0 }
        return React.cloneElement(
          child as React.ReactElement<GridItemProps & React.RefAttributes<HTMLDivElement>>,
          {
            position: { row, column },
            tabIndex,
            onKeyDown: handleKeyDown,
            onClick: () => setCoordinates({row: row, column: column}), // Note that this might cause issues if our input inside the div is smaller than the actual div as we don't set focus here 
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

Grid.Cell = GridCell
Grid.RowHeader = RowHeader