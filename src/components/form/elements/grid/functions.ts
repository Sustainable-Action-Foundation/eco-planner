import React from "react"

// TODO: We should probably use a switch case here where the default for any undefined keycombos are prompts to enter edit mode.

export function handleKeyDownGrid({
  e,
  amountColumns,
  amountRows,
  children,
  activeCell,
  setActiveCell,
  insertRowBottom,
  insertRowAbove,
  deleteCurrentRow
}: {
  e: React.KeyboardEvent<HTMLTableCellElement>,
  amountColumns: number,
  amountRows: number,
  children: React.ReactNode,
  activeCell: { row: number, column: number },
  setActiveCell: React.Dispatch<React.SetStateAction<{ row: number, column: number }>>,
  insertRowBottom: () => void;
  insertRowAbove: () => void;
  deleteCurrentRow: () => void;
}) { /* TODO: We can probably create an "edit" mode weere just disable theese so the user isnt thrown out of the input when trying to type (if we are not in edit mode we overwrite existing data when typing maybe? see google docs...) */
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (activeCell.row === amountRows - 1) return // Total amount of rows minus 1 to get index
    setActiveCell({ row: activeCell.row + 1, column: activeCell.column })
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (activeCell.row === 0) return // Cant move past the first row
    setActiveCell({ row: activeCell.row - 1, column: activeCell.column })
  }
  if (e.key === 'ArrowRight') {
    e.preventDefault()
    if (activeCell.column === amountColumns - 1) return
    setActiveCell({ row: activeCell.row, column: activeCell.column + 1 })
  }
  if (e.key === 'ArrowLeft') {
    e.preventDefault()
    if (activeCell.column === 1) return // Our headers count as a column but we don't want to tab into those
    setActiveCell({ row: activeCell.row, column: activeCell.column - 1 })
  }
  // Note: this behavior for page up/down is correct for a fully visible grid (which we assume it is for now). 
  // If the grid is scrollable other behaviour applies, see mdn. 
  if (e.key === 'PageUp') {
    e.preventDefault()
    setActiveCell({ row: 1, column: activeCell.column }) // TODO: We likely want to start rows at 0 in the future. We set it to 1 for now as the headers make up the first row
  }
  if (e.key === 'PageDown') {
    e.preventDefault()
    setActiveCell({ row: (React.Children.count(children) / amountColumns) - 1, column: activeCell.column })
  }
  if (e.key === 'Home' && e.ctrlKey) {
    e.preventDefault()
    setActiveCell({ row: 0, column: 0 })
  } else if (e.key === 'Home') {
    e.preventDefault()
    setActiveCell({ row: activeCell.row, column: 0 })
  }
  if (e.key === 'End' && e.ctrlKey) {
    e.preventDefault()
    setActiveCell({ row: (React.Children.count(children) / amountColumns) - 1, column: amountColumns - 1 })
  } else if (e.key === 'End') {
    e.preventDefault()
    setActiveCell({ row: activeCell.row, column: amountColumns - 1 })
  }
  if (e.ctrlKey && e.shiftKey && e.key === '?' || e.ctrlKey && e.key === 'Insert') {
    e.preventDefault();
    insertRowBottom();
    setActiveCell({ row: amountRows, column: 1 });
    return;
  }
  if (e.ctrlKey && e.key === '+' || e.key === 'Insert') {
    e.preventDefault();
    insertRowAbove(); // For reasons unclear to me, we don't set an activecell here
    return;
  }
  if (e.ctrlKey && e.key === '-' || e.ctrlKey && e.key === 'Delete') { // We save e.key === Delete without a modifier for deleting the contents of a cell. Altough this won't be an issue when allowing users to select rows
    e.preventDefault();
    deleteCurrentRow();
    if (activeCell.row === 0) return
    setActiveCell({ row: activeCell.row, column: activeCell.column }); // For reasons unclear to me, we do set an activecell here
    return;
  }
}