import type { Option, TreeItem } from "@/components/types";
// TODO: Blurring should select focused element?
// TODO: For whatever reason you cannot refresh the page when focusing the comboboxes (except for the editable one)? 
/**
See for implementation details:
- https://www.w3.org/WAI/ARIA/apg/patterns/combobox/,
- https://www.w3.org/WAI/ARIA/apg/patterns/combobox/examples/combobox-select-only/.
**/

/* TODO: we can probably check if the popupelement is displayed and not run this function in that case? */
export const handleKeyDownCombobox = (
  event: React.KeyboardEvent<HTMLInputElement>,
  options: Array<Option | TreeItem>,
  setPopupElementDisplayed: React.Dispatch<React.SetStateAction<boolean>>,
  focusedIndex: number | null,
  setFocusedIndex: React.Dispatch<React.SetStateAction<number | null>>,
) => {
  if (event.ctrlKey || event.shiftKey || event.metaKey || event.key === "Tab") return;
  event.preventDefault();

  const key = event.key;
  if (["ArrowDown", "ArrowUp", "Enter", " ", "Home", "End"].includes(key)) {
    setPopupElementDisplayed(true);
  }

  switch (key) {
    case "ArrowDown": {
      if (focusedIndex === null || event.altKey) return;
      setFocusedIndex(
        focusedIndex === options.length - 1
          ? 0
          : focusedIndex + 1,
      );
      break;
    }

    case "ArrowUp": {
      if (focusedIndex === null) return;
      setFocusedIndex(focusedIndex === 0
        ? options.length - 1
        : focusedIndex - 1,
      );
      break;
    }

    case "Home": {
      setFocusedIndex(0);
      break;
    }

    case "End": {
      setFocusedIndex(options.length - 1);
      break;
    }

    // If the combobox is not editable, optionally moves focus to a value that starts with the typed characters.    
    // Prevent typing in the field
    default: {
      break;
    }
  }
};


/*
When a multi-select listbox receives focus:
    If none of the options are selected before the listbox receives focus, focus is set on the first option and there is no automatic change in the selection state.
    If one or more options are selected before the listbox receives focus, focus is set on the first option in the list that is selected.

    Recommended selection model -- holding modifier keys is not necessary:
    TODO: Shift + Space (Optional): Selects contiguous items from the most recently selected item to the focused item.
*/

// TODO: Maybe pass an object for the multiple selection key stuff so we can see if we want the controls at all.
export const navigateListbox = (
  combobox: HTMLInputElement,
  event: React.KeyboardEvent<HTMLInputElement>,
  options: Array<Option | TreeItem>,
  focusedIndex: number | null,
  setFocusedIndex: React.Dispatch<React.SetStateAction<number | null>>,
  popupElementDisplayed: boolean,
  setPopupElementDisplayed: React.Dispatch<React.SetStateAction<boolean>>,
  onSelect: (selectedOption: { name: string, value: string } | null, index: number | null) => void,
  multipleSelectionAllowed?: boolean,
  onSelectAll?: () => void,
  onSelectRange?: (from: number, to: number) => void,
) => {
  // For now we assume all listboxes are in popups triggered by the previous `handleKeyDownCombobox` function 
  if (!popupElementDisplayed || focusedIndex === null || !setPopupElementDisplayed) return; // TODO: console.error?

  const key = event.key;

  switch (key) {

    case "Enter": {
      event.preventDefault();
      onSelect(options[focusedIndex], focusedIndex);
      break;
    }

    case "Escape": {
      event.preventDefault();
      combobox.focus();
      setPopupElementDisplayed(false);
      break;
    }

    case "ArrowDown": {
      event.preventDefault();
      if (focusedIndex === options.length - 1) break;
      setFocusedIndex(focusedIndex + 1);
      if (event.shiftKey && multipleSelectionAllowed) {
        onSelect(options[focusedIndex + 1], focusedIndex);
      }
      break;
    }

    case "ArrowUp": {
      event.preventDefault();
      if (focusedIndex === 0) break;
      setFocusedIndex(focusedIndex - 1);
      if (event.shiftKey && multipleSelectionAllowed) {
        onSelect(options[focusedIndex - 1], focusedIndex);
      }
      break;
    }

    case " ": {
      if (event.ctrlKey) {
        onSelect(options[focusedIndex], focusedIndex);
      }
      break;
    }
    case "Home": {
      event.preventDefault();
      if (event.ctrlKey && event.shiftKey && multipleSelectionAllowed) {
        onSelectRange?.(focusedIndex, 0);
        setFocusedIndex(0);
      } else {
        setFocusedIndex(0);
      }
      break;
    }
    case "End": {
      event.preventDefault();
      if (event.ctrlKey && event.shiftKey && multipleSelectionAllowed) {
        onSelectRange?.(focusedIndex, options.length - 1);
        setFocusedIndex(options.length - 1);
      } else {
        setFocusedIndex(options.length - 1);
      }
      break;
    }

    case "Tab": {
      if (event.shiftKey) {
        event.preventDefault();
        setPopupElementDisplayed(false);
        combobox.focus();
      }
      break;
    }

    default: {
      if (event.ctrlKey && event.key === 'a' && multipleSelectionAllowed) { // TODO: This can probably be a case instead of an if - statement 
        if (!onSelectAll) return;
        event.preventDefault();
        onSelectAll();
      }

      break;
    }
  }
};





export const handleKeyDownTreeCombobox = (
  e: React.KeyboardEvent<HTMLInputElement | HTMLButtonElement>,
  focusedTreeOptionIndex: number | null,
  setFocusedTreeOptionIndex: React.Dispatch<React.SetStateAction<number | null>>,
  treeOptions: Array<TreeItem>, // TODO: rename
  comboboxElement: HTMLInputElement | HTMLButtonElement, // The element which sets the listboxDisplayed value, always an input or button element as those can contain the combobox role 
  onArrowAction?: (item: TreeItem, direction: "left" | "right") => void,
  onEnter?: (selectedTreeItem: TreeItem | null, index: number | null) => void, // TODO: Do we even need index?
  treeDisplayed?: boolean, // Wether or not the listbox is displayed/not displayed, or if it is uncontrolled (always open or always closed)  
  setTreeDisplayed?: React.Dispatch<React.SetStateAction<boolean>>,
  // setExpanded?: React.Dispatch<React.SetStateAction<Set<string>>>, 
) => {

  const key = e.key;

  // 1. Stops focusing any listbox item
  // 2. Closes listbox if it can be, and is, expanded
  // 3. Focuses the element which made the listbox visible

  /* TODO: Some further aria integrations are needed in regards to keyboard controls, see :
    https://www.w3.org/WAI/ARIA/apg/patterns/combobox/examples/combobox-select-only/
  */
  switch (key) {
    case "Escape": {
      e.preventDefault();
      setFocusedTreeOptionIndex(null);
      if (treeDisplayed && setTreeDisplayed) {
        setTreeDisplayed(false);
        comboboxElement.focus();
      }
      break;
    }

    case "Enter": { /* TODO: Enter should probably open this aswell as the search comboboxes! */
      e.preventDefault();
      if (!treeDisplayed) return;

      const selectedTreeItem = focusedTreeOptionIndex != null ? treeOptions[focusedTreeOptionIndex] : null;
      if (onEnter) {
        onEnter(selectedTreeItem, focusedTreeOptionIndex);
      }
      break;
    }

    case "ArrowLeft":
    case "ArrowRight": {
      e.preventDefault();

      if (focusedTreeOptionIndex != null) {
        const item = treeOptions[focusedTreeOptionIndex];
        if (onArrowAction) {
          onArrowAction(item, e.key === "ArrowRight" ? "right" : "left");
        }
      }
      break;
    }

    case "ArrowUp": {
      e.preventDefault();
      if (!treeDisplayed && setTreeDisplayed) setTreeDisplayed(true);

      if (focusedTreeOptionIndex != null) {
        if (focusedTreeOptionIndex !== 0) {
          setFocusedTreeOptionIndex(focusedTreeOptionIndex - 1);
        } else {
          setFocusedTreeOptionIndex(treeOptions.length - 1);
        }
      } else {
        setFocusedTreeOptionIndex(0);
      }
      break;
    }

    case "ArrowDown": {
      e.preventDefault();
      if (!treeDisplayed && setTreeDisplayed) setTreeDisplayed(true);

      if (focusedTreeOptionIndex != null) {
        if (focusedTreeOptionIndex !== treeOptions.length - 1) {
          setFocusedTreeOptionIndex(focusedTreeOptionIndex + 1);
        } else {
          setFocusedTreeOptionIndex(0);
        }
      } else {
        setFocusedTreeOptionIndex(0);
      }
      break;
    }

    case "Home": {
      e.preventDefault();
      setFocusedTreeOptionIndex(0);
      break;
    }

    case "End": {
      e.preventDefault();
      setFocusedTreeOptionIndex(treeOptions.length - 1);
      break;
    }

    default: {
      if (e.key !== 'Tab') e.preventDefault();
      break;
    }
  }
};

// TODO: Replace {name: string, value: string} with option type
export const handleKeyDownEditableCombobox = (
  e: React.KeyboardEvent<HTMLInputElement>,
  comboboxElement: HTMLInputElement | HTMLButtonElement, // The element which sets the listboxDisplayed value, always an input or button element as those can contain the combobox role 
  listboxDisplayed: boolean | undefined, // Wether or not the listbox is displayed/not displayed, or if it is uncontrolled (always open or always closed)  
  setListboxDisplayed: React.Dispatch<React.SetStateAction<boolean>> | undefined,
  listboxOptions: Array<{ name: string, value: string }>,
  focusedListboxOptionIndex: number | null,
  setFocusedListboxOptionIndex: React.Dispatch<React.SetStateAction<number | null>>,
  onEnter: (selectedOption: { name: string, value: string } | null, index: number | null) => void, // TODO: Do we even need index?
) => {

  const key = e.key;

  switch (key) {
    // 1. Stops focusing any listbox item
    // 2. Closes listbox if it can be, and is, expanded
    // 3. Focuses the element which made the listbox visible
    case "Escape": {
      if (listboxDisplayed) {
        e.preventDefault();
      }
      if (listboxDisplayed && setListboxDisplayed) {
        setListboxDisplayed(false);
        comboboxElement.focus();
      }

      break;
    }

    case "Home": {
      e.preventDefault();
      if (listboxDisplayed) {
        setFocusedListboxOptionIndex(0);
      }

      break;
    }

    case "End": {
      e.preventDefault();
      if (listboxDisplayed) {
        setFocusedListboxOptionIndex(listboxOptions.length - 1);
      }

      break;
    }


    // 1. Opens listbox if it can be, and is, closed
    // 2. Sets Focus to the first option in the listbox 
    //    Spec tells us the focus should be placed on the option which was already focused, if it exists. We ignore this.
    // 2. If the listbox contains a focused option and do one of two things:
    //    2.1. If focus is not on the last option, move focus to the the next option  
    //    2.2. Move focus to the first option  
    // 3. If the menu is open and no option is focused we messed up somewhere, panic ensues and we set focus to the first option
    case "ArrowDown": {
      if (e.ctrlKey && e.shiftKey && e.altKey && e.metaKey) return;
      e.preventDefault();

      if (!listboxDisplayed && setListboxDisplayed) {
        setListboxDisplayed(true);
        setFocusedListboxOptionIndex(0);
      }

      if (focusedListboxOptionIndex != null) {
        if (focusedListboxOptionIndex !== listboxOptions.length - 1) {
          setFocusedListboxOptionIndex(focusedListboxOptionIndex + 1);
        } else {
          setFocusedListboxOptionIndex(0);
        }
      } else {
        setFocusedListboxOptionIndex(0);
      }

      break;
    }

    // 1. Opens listbox if it can be, and is, closed
    // 2. Sets Focus to the first option in the listbox (TODO: Spec tells ut should be last?)
    //    Spec tells us the focus should be placed on the option which was already focused, if it exists. We ignore this.
    // 2. If the listbox contains a focused option and do one of two things:
    //    2.1. If focus is not on the first option, move focus to the the previous option  
    //    2.2. Move focus to the last option  
    // 3. If the menu is open and no option is focused we messed up somewhere, panic ensues and we set focus to the first option
    case "ArrowUp": {
      if (e.ctrlKey && e.shiftKey && e.altKey && e.metaKey) return;

      e.preventDefault();

      if (!listboxDisplayed && setListboxDisplayed) {
        setListboxDisplayed(true);
        setFocusedListboxOptionIndex(0);
      }

      if (focusedListboxOptionIndex != null) {
        if (focusedListboxOptionIndex !== 0) {
          setFocusedListboxOptionIndex(focusedListboxOptionIndex - 1);
        } else {
          setFocusedListboxOptionIndex(listboxOptions.length - 1);
        }
      } else {
        setFocusedListboxOptionIndex(0);
      }

      break;
    }

    // 1. If a listboxOption is focused, select it. Otherwise, select null. 
    // 2. Pass this value through the `onEnter` callback  
    case "Enter": {
      e.preventDefault();
      const selectedListboxOption = focusedListboxOptionIndex != null ? listboxOptions[focusedListboxOptionIndex] : null;
      onEnter(selectedListboxOption, focusedListboxOptionIndex);
      break;
    }

    case "Tab": {
      if (e.shiftKey && listboxDisplayed && setListboxDisplayed) {
        e.preventDefault();
        setListboxDisplayed(false);
        comboboxElement.focus();
      };
      break;
    }

    default: {
      break;
    }
  }
};

// TODO: Replace {name: string, value: string} with option type
export const handleKeyDownTextAutocomplete = (
  e: React.KeyboardEvent<HTMLInputElement>,
  comboboxElement: HTMLInputElement | HTMLButtonElement, // The element which sets the listboxDisplayed value, always an input or button element as those can contain the combobox role 
  listboxDisplayed: boolean | undefined, // Wether or not the listbox is displayed/not displayed, or if it is uncontrolled (always open or always closed)  
  setListboxDisplayed: React.Dispatch<React.SetStateAction<boolean>> | undefined,
  listboxOptions: Array<{ name: string, value: string }>,
  focusedListboxOptionIndex: number | null,
  setFocusedListboxOptionIndex: React.Dispatch<React.SetStateAction<number | null>>,
  onEnter: (selectedOption: { name: string, value: string } | null, index: number | null) => void, // TODO: Do we even need index?
) => {

  const key = e.key;
  switch (key) {

    // 1. Focuses the element which made the listbox visible
    // 2. Closes listbox if it can be, and is, expanded
    case "Escape": {
      if (listboxDisplayed && setListboxDisplayed) {
        e.preventDefault();
        comboboxElement.focus();
        setListboxDisplayed(false);
      }
      break;
    }

    case "Home": {
      e.preventDefault();
      if (listboxDisplayed) {
        setFocusedListboxOptionIndex(0);
      }
      break;
    }

    case "End": {
      e.preventDefault();
      if (listboxDisplayed) {
        setFocusedListboxOptionIndex(listboxOptions.length - 1);
      }
      break;
    }
    // TODO: ARROW DOWN AND UP SHOULD NOT MOVE FOCUS IF LISTBOX IS CLOSED! 
    // 1. Opens listbox if it can be, and is, closed
    // 2. Sets Focus to the first option in the listbox 
    //    Spec tells us the focus should be placed on the option which was already focused, if it exists. We ignore this.
    // 2. If the listbox contains a focused option and do one of two things:
    //    2.1. If focus is not on the last option, move focus to the the next option  
    //    2.2. Move focus to the first option  
    // 3. If the menu is open and no option is focused we messed up somewhere, panic ensues and we set focus to the first option
    case "ArrowDown": {
      if (e.ctrlKey || e.shiftKey || e.altKey || e.metaKey) return;

      e.preventDefault();

      if (!listboxDisplayed && setListboxDisplayed) {
        setListboxDisplayed(true);
        setFocusedListboxOptionIndex(0);
      }

      if (focusedListboxOptionIndex != null) {
        if (focusedListboxOptionIndex !== listboxOptions.length - 1) {
          setFocusedListboxOptionIndex(focusedListboxOptionIndex + 1);
        } else {
          setFocusedListboxOptionIndex(0);
        }
      } else {
        setFocusedListboxOptionIndex(0);
      }
      break;
    }

    // 1. Opens listbox if it can be, and is, closed
    // 2. Sets Focus to the first option in the listbox (TODO: Spec tells ut should be last?)
    //    Spec tells us the focus should be placed on the option which was already focused, if it exists. We ignore this.
    // 2. If the listbox contains a focused option and do one of two things:
    //    2.1. If focus is not on the first option, move focus to the the previous option  
    //    2.2. Move focus to the last option  
    // 3. If the menu is open and no option is focused we messed up somewhere, panic ensues and we set focus to the first option
    case "ArrowUp": {
      if (e.ctrlKey || e.shiftKey || e.altKey || e.metaKey) return;

      e.preventDefault();

      if (!listboxDisplayed && setListboxDisplayed) {
        setListboxDisplayed(true);
        setFocusedListboxOptionIndex(0);
      }

      if (focusedListboxOptionIndex != null) {
        if (focusedListboxOptionIndex !== 0) {
          setFocusedListboxOptionIndex(focusedListboxOptionIndex - 1);
        } else {
          setFocusedListboxOptionIndex(listboxOptions.length - 1);
        }
      } else {
        setFocusedListboxOptionIndex(0);
      }
      break;
    }

    // 1. If a listboxOption is focused, select it. Otherwise, select null. 
    // 2. Pass this value through the `onEnter` callback  
    case "Enter": {
      e.preventDefault();
      if (focusedListboxOptionIndex === null) return;
      const selectedListboxOption = listboxOptions[focusedListboxOptionIndex];
      onEnter(selectedListboxOption, focusedListboxOptionIndex);
      break;
    }

    default: {
      if (e.key.length > 1) break; // TODO: (hacky?) fix to prevent special keys (ex. shift, ctrl, f4 etc...) from doing things here. Might not function on certain asian keyboards.
      if (!setListboxDisplayed) return;
      if (!listboxDisplayed) setListboxDisplayed(true);
      break;
    }
  }
};

// Clears any value and set focus to combobox
// TODO: Make more generic, functions for treeview also
export function clearEditableCombobox(
  comboboxElement: HTMLInputElement, //  Only input or button elements may contain the combobox role and only input can be editable 
  setComboboxValue: React.Dispatch<React.SetStateAction<string>>,
  popupElementDisplayed: boolean | undefined, // Wether or not the listbox is displayed/not displayed, or if it is uncontrolled (always open or always closed)  
) {
  comboboxElement.value = '';
  setComboboxValue('');
  if (popupElementDisplayed) {
    comboboxElement.focus();
  }
}

export function scrollOptionIntoView(
  listboxOptionElements: Array<HTMLLIElement | null>,
  focusedListboxOptionIndex: number | null,
  scrollOptions?: "start" | "center" | "end" | "nearest",
) {
  if (focusedListboxOptionIndex !== null && listboxOptionElements) {
    listboxOptionElements[focusedListboxOptionIndex]?.scrollIntoView({
      block: scrollOptions ? scrollOptions : "nearest",
    });
  }
}

export const selectRange = (
  options: Array<Option | TreeItem>,
  value: Array<Option | TreeItem>,
  fromIndex: number,
  toIndex: number,
): Array<Option | TreeItem> => {
  const start = Math.min(fromIndex, toIndex);
  const end = Math.max(fromIndex, toIndex);
  const rangeOptions = options.slice(start, end + 1);

  const allRangeSelected = rangeOptions.every(option =>
    value.some(v => v.value === option.value),
  );

  if (allRangeSelected) {
    return value.filter(v => !rangeOptions.some(o => o.value === v.value));
  } else {
    const newSelections = rangeOptions.filter(
      option => !value.some(v => v.value === option.value),
    );
    return [...value, ...newSelections];
  }
};