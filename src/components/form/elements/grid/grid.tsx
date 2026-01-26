import { GenericElement } from "@/components/types"
import React, { useState } from "react"

type coordinates = {
  row: number
  column: number
}

type GridItemProps = {
  position: coordinates
  children: React.ReactNode
}

function GridCell({ children, position }: GridItemProps) {
  return (
    <div
      role="gridcell"
      tabIndex={-1}
      data-row={position.row}
      data-column={position.column}
    >
      {children}
    </div>
  )
}

function RowHeader({ children, position }: GridItemProps) {
  return (
    <div
      role="rowheader"
      tabIndex={-1}
      data-row={position.row}
      data-column={position.column}
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

  const [coordinates, setCoordinates] = useState<{ row: number, column: number }>({ row: 0, column: 0 })

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

        return React.cloneElement(child, {
          position: { row, column }
        })
      })}
    </div>
  )
}

Grid.Cell = GridCell
Grid.RowHeader = RowHeader