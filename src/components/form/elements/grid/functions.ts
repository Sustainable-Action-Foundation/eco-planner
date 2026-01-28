import React from "react"
import { GridCoordinates } from "@/components/types"

export function handleKeyDownGrid({
  e,
  columns,
  children,
  coordinates,
  setCoordinates
}: {
  e: React.KeyboardEvent<HTMLDivElement>,
  columns: Array<string>,
  children: React.ReactNode,
  coordinates: GridCoordinates,
  setCoordinates: React.Dispatch<React.SetStateAction<{ row: number, column: number }>>,
}) { /* TODO: We can probably create an "edit" mode weere just disable theese so the user isnt thrown out of the input when trying to type (if we are not in edit mode we overwrite existing data when typing maybe? see google docs...) */
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