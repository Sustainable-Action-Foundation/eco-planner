import { GenericElement } from "@/components/types"
import React, { useEffect, useState } from "react"

type coordinates = {
  row: number
  column: number
}

type GridItemProps = {
  position?: coordinates
  children: React.ReactNode
  tabIndex?: 0 | -1
  onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>
}

function GridCell({ children, position, tabIndex, onKeyDown }: GridItemProps) {
  return (
    <div
      role="gridcell"
      tabIndex={tabIndex}
      data-row={position?.row}
      data-column={position?.column}
      onKeyDown={onKeyDown}
    >
      {children}
    </div>
  )
}

function RowHeader({ children, position, tabIndex, onKeyDown }: GridItemProps) {
  return (
    <div
      role="rowheader"
      tabIndex={tabIndex}
      data-row={position?.row}
      data-column={position?.column}
      onKeyDown={onKeyDown}
    >
      {children}
    </div>
  )
}

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

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'ArrowDown') {
      if (coordinates.row === (React.Children.count(children) / columns.length) - 1 ) return // Total amount of rows minus 1 to get index
      setCoordinates({row: coordinates.row + 1, column: coordinates.column})
    }
    if (e.key === 'ArrowUp') {
      if (coordinates.row === 0) return
      setCoordinates({row: coordinates.row - 1, column: coordinates.column})
    }
    if (e.key === 'ArrowRight') {
      if (coordinates.column === columns.length ) return
      setCoordinates({row: coordinates.row, column: coordinates.column + 1})
    }
    if (e.key === 'ArrowLeft') {
      if (coordinates.column === 0) return
      setCoordinates({row: coordinates.row, column: coordinates.column - 1})
    }
  }

  useEffect(() => {
    console.log(coordinates)
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
          !React.isValidElement<GridItemProps>(child) ||
          (child.type !== GridCell && child.type !== RowHeader)
        ) {
          return child
        }

        const row = Math.floor(index / columns.length) 
        const column = index % columns.length

        let tabIndex: 0 | -1 = -1
        if (coordinates.row === row && coordinates.column === column) { tabIndex = 0 }
         return React.cloneElement(child, {
          position: { row, column },
          tabIndex,
          onKeyDown: handleKeyDown
        })
      })}
    </div>
  )
}

Grid.Cell = GridCell
Grid.RowHeader = RowHeader