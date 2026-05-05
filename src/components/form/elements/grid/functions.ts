import type React from "react"

export function handleKeyDownGrid({
  e,// TODO: rename --> event
  amountColumns,
  amountRows,
  activeCell,
  setActiveCell,
  editMode,
  setEditMode,
  insertRowBottom,
  insertRowAbove,
  deleteCurrentRow,
  deleteCurrentGridCellContents
}: {
  e: React.KeyboardEvent<HTMLTableCellElement>,
  amountColumns: number,
  amountRows: number,
  activeCell: { row: number, column: number } | null, // TODO: RENAME --> FocusedCell
  setActiveCell: React.Dispatch<React.SetStateAction<{ row: number, column: number } | null>>,  // TODO: RENAME --> SetFocusedCell
  editMode: boolean,
  setEditMode: React.Dispatch<React.SetStateAction<boolean>>,
  insertRowBottom: () => void;
  insertRowAbove: () => void;
  deleteCurrentRow: () => void;
  deleteCurrentGridCellContents: (cell: { row: number; column: number }) => void;
}) {
  if (!activeCell) return

  const key = e.key;
  switch (key) {
    case "ArrowDown":
      e.preventDefault();

      if (editMode) return // Up and down arrows in a number input are annoying so we check this after preventing default

      if (activeCell.row === amountRows - 1) return; // Total amount of rows minus 1 to get index
      setActiveCell({ row: activeCell.row + 1, column: activeCell.column });
      break;

    case "ArrowUp":
      e.preventDefault();

      if (editMode) return // Up and down arrows in a number input are annoying so we check this after preventing default

      if (activeCell.row === 0) return; // Cant move past the first row
      setActiveCell({ row: activeCell.row - 1, column: activeCell.column });
      break;

    case "ArrowRight":
      if (editMode) return

      e.preventDefault();
      if (activeCell.column === amountColumns - 1) return;
      setActiveCell({ row: activeCell.row, column: activeCell.column + 1 });
      break;

    case "ArrowLeft":
      if (editMode) return

      e.preventDefault();
      if (activeCell.column === 1) return; // Our headers count as a column but we don't want to tab into those
      setActiveCell({ row: activeCell.row, column: activeCell.column - 1 });
      break;

    case "PageUp":
      if (editMode) setEditMode(false)
      e.preventDefault();
      // Note: the behavior for page up/down is correct for a fully visible grid (which we assume it is for now). 
      // If the grid is scrollable other behaviour applies, see mdn. 
      setActiveCell({ row: 0, column: activeCell.column }); // TODO: We likely want to start rows at 0 in the future. We set it to 1 for now as the headers make up the first row
      break;

    case "PageDown":
      if (editMode) setEditMode(false)
      e.preventDefault();
      setActiveCell({ row: amountRows - 1, column: activeCell.column });
      break;

    case "Home":
      if (editMode) setEditMode(false)
      e.preventDefault();
      if (e.ctrlKey) {
        setActiveCell({ row: 0, column: 1 });
      } else {
        setActiveCell({ row: activeCell.row, column: 1 });
      }
      break;

    case "End":
      if (editMode) setEditMode(false)
      e.preventDefault();
      if (e.ctrlKey) {
        setActiveCell({ row: amountRows - 1, column: amountColumns - 1 });
      } else {
        setActiveCell({ row: activeCell.row, column: amountColumns - 1 });
      }
      break;

    case "?": {
      if (editMode) setEditMode(false)
      e.preventDefault();
      if (e.ctrlKey && e.shiftKey) {
        insertRowBottom();
        setActiveCell({ row: amountRows, column: 1 });
      }
      break;
    }

    case "Insert": {
      if (editMode) setEditMode(false)
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
      if (editMode) setEditMode(false)
      e.preventDefault();
      if (e.ctrlKey) {
        insertRowAbove(); // Retaining our active cell places us on the new cell automatically
      }
      break;
    }

    case "-": { 
      if (e.ctrlKey) {
        e.preventDefault();
        if (editMode) setEditMode(false)
        const nextRow =
          amountRows <= 1
            ? 0
            : Math.min(activeCell.row, amountRows - 2);

        deleteCurrentRow();
        setActiveCell({ row: nextRow, column: activeCell.column });
      } else (
        setEditMode(true) // a minus sign makes for a valid number
      )
      break;
    }

    // Enter edit mode if we aren't already in it
    // If we are in edit mode, we want to move down to the next row when pressing enter
    // If we are on the last row when moving down to the next row, we create a new row
    case "Enter": {
      e.preventDefault();

      if (editMode === false) {
        setEditMode(true)
      } else if (editMode === true && activeCell.row === amountRows - 1) {
        setEditMode(false)
        insertRowBottom();
        setActiveCell({ row: amountRows, column: 1 });
      } else {
        setEditMode(false)
        setActiveCell({ row: activeCell.row + 1, column: activeCell.column });
      }

      break;
    }

    case "Escape": {
      e.preventDefault();

      if (editMode === false) return

      setEditMode(false)
      break;
    }

    case "Delete": {

      if (editMode) return

      e.preventDefault();
      if (e.ctrlKey) {
        const nextRow =
          amountRows <= 1
            ? 0
            : Math.min(activeCell.row, amountRows - 2);

        deleteCurrentRow();
        setActiveCell({ row: nextRow, column: activeCell.column });
      } else {
        deleteCurrentGridCellContents({ row: activeCell.row, column: activeCell.column }) // TODO: Unsure if this function should run here or if it should be inside a useEffect to sync state
      }

      break;
    }

    case "Tab": {
      if (!editMode) return // Default tab behavior if not editing

      e.preventDefault()
      setEditMode(false)

      if (e.shiftKey) {

        if (activeCell.row === 0 && activeCell.column === 1) return // Do nothing on first cell

        // If on first column, move up a row. Otherwise move to previous column. 
        if (activeCell.column === 1) { 
          setActiveCell({ row: activeCell.row - 1, column: amountColumns - 1 });
        } else { 
          setActiveCell({ row: activeCell.row, column: activeCell.column - 1 });
        }
      } else {

        if (activeCell.row === amountRows - 1 && activeCell.column === amountColumns - 1) return // Do nothing on last cell
        
        // If on last column, go down a row. Otherwise move to next column. 
        if (activeCell.column === amountColumns - 1) { 
          setActiveCell({ row: activeCell.row + 1, column: 1 });
        } else { 
          setActiveCell({ row: activeCell.row, column: activeCell.column + 1 });
        }
      }

    }

    // If we match what is expected from a number  input, and we arent in editmode, we may type it
    // TODO: Should also probably override existing input if we start writing stuff here
    default:
      if ((!Number.isNaN(Number(key))) && !editMode) {
        setEditMode(true);
      }
      break;
  }
}