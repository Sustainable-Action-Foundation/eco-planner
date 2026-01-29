import React from "react"
import { Position } from "@/components/types"

export function handleKeyDownGrid({
  e,
  columns,
  children,
  activeCell,
  setActivecell
}: {
  e: React.KeyboardEvent<HTMLDivElement>,
  columns: Array<string>,
  children: React.ReactNode,
  activeCell: Position,
  setActivecell: React.Dispatch<React.SetStateAction<Position>>,
}) { /* TODO: We can probably create an "edit" mode weere just disable theese so the user isnt thrown out of the input when trying to type (if we are not in edit mode we overwrite existing data when typing maybe? see google docs...) */
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (activeCell.row === (React.Children.count(children) / columns.length) - 1) return // Total amount of rows minus 1 to get index
    setActivecell({ row: activeCell.row + 1, column: activeCell.column })
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (activeCell.row === 0) return
    setActivecell({ row: activeCell.row - 1, column: activeCell.column })
  }
  if (e.key === 'ArrowRight') {
    e.preventDefault()
    if (activeCell.column === columns.length - 1) return
    setActivecell({ row: activeCell.row, column: activeCell.column + 1 })
  }
  if (e.key === 'ArrowLeft') {
    e.preventDefault()
    if (activeCell.column === 0) return
    setActivecell({ row: activeCell.row, column: activeCell.column - 1 })
  }
  if (e.key === 'Home') {
    e.preventDefault()
    setActivecell({ row: activeCell.row, column: 0 })
  }
  if (e.key === 'End') {
    e.preventDefault()
    setActivecell({ row: activeCell.row, column: columns.length - 1 })
  }
  if (e.key === 'Home' && e.ctrlKey) {
    e.preventDefault()
    setActivecell({ row: 0, column: 0 })
  }
  if (e.key === 'End' && e.ctrlKey) {
    e.preventDefault()
    setActivecell({ row: (React.Children.count(children) / columns.length) - 1, column: columns.length - 1 })
  }
}