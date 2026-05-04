import type React from "react"

export function setFocusWithin(
  activeCell: { row: number, column: number },
) {
  const cell = document.querySelector<HTMLElement>( // TODO: Probably pass like an id so we select the correct grid 
    `[data-row="${activeCell.row}"][data-column="${activeCell.column}"]`
  )
  if (!cell) return

  const focusable = cell.querySelector<HTMLElement>(
    'input, textarea, select, button, [tabindex]:not([tabindex="-1"])'
  )
  if (!focusable) return
  focusable.focus()
}

export function handleKeyDownGrid({
  e,// TODO: rename --> event
  amountColumns,
  amountRows,
  activeCell,
  setActiveCell,
  insertRowBottom,
  insertRowAbove,
  deleteCurrentRow
}: {
  e: React.KeyboardEvent<HTMLTableCellElement>,
  amountColumns: number,
  amountRows: number,
  activeCell: { row: number, column: number },
  setActiveCell: React.Dispatch<React.SetStateAction<{ row: number, column: number }>>,
  insertRowBottom: () => void;
  insertRowAbove: () => void;
  deleteCurrentRow: () => void;
}) { 
  const key = e.key;
  switch (key) { // If we match what is expected from a number input we may type it, otherwise nothing happens (default case)
    case "ArrowDown":
      e.preventDefault();
      if (activeCell.row === amountRows - 1) return; // Total amount of rows minus 1 to get index
      setActiveCell({ row: activeCell.row + 1, column: activeCell.column });
      break;

    case "ArrowUp":
      e.preventDefault();
      if (activeCell.row === 0) return; // Cant move past the first row
      setActiveCell({ row: activeCell.row - 1, column: activeCell.column });
      break;

    case "ArrowRight":
      e.preventDefault();
      if (activeCell.column === amountColumns - 1) return;
      setActiveCell({ row: activeCell.row, column: activeCell.column + 1 });
      break;

    case "ArrowLeft":
      e.preventDefault();
      if (activeCell.column === 1) return; // Our headers count as a column but we don't want to tab into those
      setActiveCell({ row: activeCell.row, column: activeCell.column - 1 });
      break;

    case "PageUp":
      e.preventDefault();
      // Note: the behavior for page up/down is correct for a fully visible grid (which we assume it is for now). 
      // If the grid is scrollable other behaviour applies, see mdn. 
      setActiveCell({ row: 0, column: activeCell.column }); // TODO: We likely want to start rows at 0 in the future. We set it to 1 for now as the headers make up the first row
      break;

    case "PageDown":
      e.preventDefault();
      setActiveCell({ row: amountRows - 1, column: activeCell.column });
      break;

    case "Home":
      e.preventDefault();
      if (e.ctrlKey) {
        setActiveCell({ row: 0, column: 1 });
      } else {
        setActiveCell({ row: activeCell.row, column: 1 });
      }
      break;

    case "End":
      e.preventDefault();
      if (e.ctrlKey) {
        setActiveCell({ row: amountRows - 1, column: amountColumns - 1 });
      } else {
        setActiveCell({ row: activeCell.row, column: amountColumns - 1 });
      }
      break;

    case "?": {
      e.preventDefault();
      if (e.ctrlKey && e.shiftKey) {
        insertRowBottom();
        setActiveCell({ row: amountRows, column: 1 });
      }
      break;
    }

    case "Insert": {
      e.preventDefault();
      if (e.ctrlKey) {
        insertRowBottom();
        setActiveCell({ row: amountRows, column: 1 });
      } else {
        insertRowAbove();
      }

      break;
    }

    case "+": {
      e.preventDefault();
      if (e.ctrlKey) {
        insertRowAbove(); // Retaining our active cell places us on the new cell automatically
      }
      break;
    }

    case "-":
    case "Delete": { // We save e.key === Delete without a modifier for deleting the contents of a cell. Altough this won't be an issue when allowing users to select rows
      e.preventDefault();
      if (e.ctrlKey) {

        const nextRow =
          amountRows <= 1
            ? 0
            : Math.min(activeCell.row, amountRows - 2);


        deleteCurrentRow();

        setActiveCell({ row: nextRow, column: activeCell.column });
      }
      break;
    }

    // If we already focus an input we want this to move down to next row
    case "Enter": { // Need escape to unfocus element 
      e.preventDefault();
      setFocusWithin(activeCell)
      break;
    }


    default:
      console.log("a"); // TODO: We should enter edit mode here!
  }
}