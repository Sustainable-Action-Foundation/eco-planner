import type React from "react";

export function handleKeyDownGrid({
  e,
  amountColumns,
  amountRows,
  focusedCell,
  setFocusedCell,
  editMode,
  setEditMode,
  insertRowBottom,
  insertRowAbove,
  deleteCurrentRow,
  deleteCurrentGridCellContents,
}: {
  e: React.KeyboardEvent<HTMLTableCellElement>,
  amountColumns: number,
  amountRows: number,
  focusedCell: { row: number, column: number } | null,
  setFocusedCell: React.Dispatch<React.SetStateAction<{ row: number, column: number } | null>>,
  editMode: boolean,
  setEditMode: React.Dispatch<React.SetStateAction<boolean>>,
  insertRowBottom: () => void;
  insertRowAbove: () => void;
  deleteCurrentRow: () => void;
  deleteCurrentGridCellContents: (cell: { row: number; column: number }) => void;
}) {
  if (!focusedCell) return;

  const key = e.key;
  switch (key) {
    case "ArrowDown":
      e.preventDefault();

      if (editMode) return; // Up and down arrows in a number input are annoying so we check this after preventing default

      if (focusedCell.row === amountRows - 1) return; // Total amount of rows minus 1 to get index
      setFocusedCell({ row: focusedCell.row + 1, column: focusedCell.column });
      break;

    case "ArrowUp":
      e.preventDefault();

      if (editMode) return; // Up and down arrows in a number input are annoying so we check this after preventing default

      if (focusedCell.row === 0) return; // Cant move past the first row
      setFocusedCell({ row: focusedCell.row - 1, column: focusedCell.column });
      break;

    case "ArrowRight":
      if (editMode) return;

      e.preventDefault();
      if (focusedCell.column === amountColumns - 1) return;
      setFocusedCell({ row: focusedCell.row, column: focusedCell.column + 1 });
      break;

    case "ArrowLeft":
      if (editMode) return;

      e.preventDefault();
      if (focusedCell.column === 1) return; // Our headers count as a column but we don't want to tab into those
      setFocusedCell({ row: focusedCell.row, column: focusedCell.column - 1 });
      break;

    case "PageUp":
      if (editMode) setEditMode(false);
      e.preventDefault();
      // Note: the behavior for page up/down is correct for a fully visible grid (which we assume it is for now). 
      // If the grid is scrollable other behaviour applies, see mdn. 
      setFocusedCell({ row: 0, column: focusedCell.column }); // TODO: We likely want to start rows at 0 in the future. We set it to 1 for now as the headers make up the first row
      break;

    case "PageDown":
      if (editMode) setEditMode(false);
      e.preventDefault();
      setFocusedCell({ row: amountRows - 1, column: focusedCell.column });
      break;

    case "Home":
      if (editMode) setEditMode(false);
      e.preventDefault();
      if (e.ctrlKey) {
        setFocusedCell({ row: 0, column: 1 });
      } else {
        setFocusedCell({ row: focusedCell.row, column: 1 });
      }
      break;

    case "End":
      if (editMode) setEditMode(false);
      e.preventDefault();
      if (e.ctrlKey) {
        setFocusedCell({ row: amountRows - 1, column: amountColumns - 1 });
      } else {
        setFocusedCell({ row: focusedCell.row, column: amountColumns - 1 });
      }
      break;

    case "?": {
      if (editMode) setEditMode(false);
      e.preventDefault();
      if (e.ctrlKey && e.shiftKey) {
        insertRowBottom();
        setFocusedCell({ row: amountRows, column: 1 });
      }
      break;
    }

    case "Insert": {
      if (editMode) setEditMode(false);
      e.preventDefault();
      if (e.ctrlKey) {
        insertRowBottom();
        setFocusedCell({ row: amountRows, column: 1 });
      } else {
        insertRowAbove();
      }

      break;
    }

    case "+": {
      if (editMode) setEditMode(false);
      e.preventDefault();
      if (e.ctrlKey) {
        insertRowAbove(); // Retaining our active cell places us on the new cell automatically
      }
      break;
    }

    case "-": {
      if (e.ctrlKey) {
        e.preventDefault();
        if (editMode) setEditMode(false);
        const nextRow =
          amountRows <= 1
            ? 0
            : Math.min(focusedCell.row, amountRows - 2);

        deleteCurrentRow();
        setFocusedCell({ row: nextRow, column: focusedCell.column });
      } else (
        setEditMode(true) // a minus sign makes for a valid number
      );
      break;
    }

    // Enter edit mode if we aren't already in it
    // If we are in edit mode, we want to move down to the next row when pressing enter
    // If we are on the last row when moving down to the next row, we create a new row
    case "Enter": {
      e.preventDefault();

      if (editMode === true) setEditMode(false);
 
      if (e.shiftKey) {
        if (focusedCell.row === 0) return;
        setFocusedCell({ row: focusedCell.row - 1, column: focusedCell.column });
      } else if (focusedCell.row === amountRows - 1) {
        insertRowBottom();
        setFocusedCell({ row: amountRows, column: focusedCell.column });
      } else {
        setFocusedCell({ row: focusedCell.row + 1, column: focusedCell.column });
      }

      break;
    }

    case "F2" : {
      e.preventDefault();
      setEditMode(!editMode);
      break;
    }

    case "Escape": {
      e.preventDefault();

      if (editMode === false) {
        setFocusedCell(null);
        return;
      }

      setEditMode(false);
      break;
    }

    case "Delete": {
      if (editMode) return;

      e.preventDefault();
      if (e.ctrlKey) {
        const nextRow =
          amountRows <= 1
            ? 0
            : Math.min(focusedCell.row, amountRows - 2);

        deleteCurrentRow();
        setFocusedCell({ row: nextRow, column: focusedCell.column });
      } else {
        deleteCurrentGridCellContents({ row: focusedCell.row, column: focusedCell.column }); // TODO: Unsure if this function should run here or if it should be inside a useEffect to sync state
      }

      break;
    }

    case "Tab": {
      e.preventDefault();
      setEditMode(false);

      if (e.shiftKey) {
        if (focusedCell.column === 1) return; // Do nothing on first cell 
        setFocusedCell({ row: focusedCell.row, column: focusedCell.column - 1 });
       } else {
        if (focusedCell.column === amountColumns - 1) return; // Do nothing on last cell
        setFocusedCell({ row: focusedCell.row, column: focusedCell.column + 1 });
       }

    }

    // If we match what is expected from a number input, and we arent in editmode, we may type it
    // IT should be noted that the below is probably not the exact same as what a number input allows
    default:
      if ((!Number.isNaN(Number(key))) && !editMode) {
        deleteCurrentGridCellContents({ row: focusedCell.row, column: focusedCell.column }); // TODO: Unsure if this function should run here or if it should be inside a useEffect to sync state
        setEditMode(true);
      }
      break;
  }
}