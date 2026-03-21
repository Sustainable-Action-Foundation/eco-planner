import React from "react"
import type { Position } from "@/components/types"

export function handleKeyDownGrid({
  e,
  amountColumns,
  children,
  activeCell,
  setActivecell
}: {
  e: React.KeyboardEvent<HTMLDivElement>,
  amountColumns: number,
  children: React.ReactNode,
  activeCell: Position,
  setActivecell: React.Dispatch<React.SetStateAction<Position>>,
}) { /* TODO: We can probably create an "edit" mode weere just disable theese so the user isnt thrown out of the input when trying to type (if we are not in edit mode we overwrite existing data when typing maybe? see google docs...) */
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (activeCell.row === (React.Children.count(children) / amountColumns) - 1) return // Total amount of rows minus 1 to get index
    setActivecell({ row: activeCell.row + 1, column: activeCell.column })
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (activeCell.row === 1) return // TODO: We likely want to start rows at 0 in the future. We set it to 1 for now as the headers make up the first row
    setActivecell({ row: activeCell.row - 1, column: activeCell.column })
  }
  if (e.key === 'ArrowRight') {
    e.preventDefault()
    if (activeCell.column === amountColumns - 1) return
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
    setActivecell({ row: activeCell.row, column: amountColumns - 1 })
  }
  // Note: this behavior for page up/down is correct for a fully visible grid (which we assume it is for now). 
  // If the grid is scrollable other behaviour applies, see mdn. 
  if (e.key === 'PageUp') { 
    e.preventDefault()
    setActivecell({ row: 1, column: activeCell.column }) // TODO: We likely want to start rows at 0 in the future. We set it to 1 for now as the headers make up the first row
  }
  if (e.key === 'PageDown') {
    e.preventDefault()
    setActivecell({ row: (React.Children.count(children) / amountColumns) - 1, column: activeCell.column })
  }
  if (e.key === 'Home' && e.ctrlKey) {
    e.preventDefault()
    setActivecell({ row: 0, column: 0 })
  }
  if (e.key === 'End' && e.ctrlKey) {
    e.preventDefault()
    setActivecell({ row: (React.Children.count(children) / amountColumns) - 1, column: amountColumns - 1 })
  }
}