import type { TreeItem } from "@/components/types";

export const handleKeyDownTreeCombobox = (
  e: React.KeyboardEvent<HTMLInputElement>,
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

  // 1. Stops focusing any listbox item
  // 2. Closes listbox if it can be, and is, expanded
  // 3. Focuses the element which made the listbox visible
  if (e.key === "Escape") {
    if (treeDisplayed) { 
      e.preventDefault()
    }
    setFocusedTreeOptionIndex(null);
    if (treeDisplayed && setTreeDisplayed) {
      setTreeDisplayed(false);
      comboboxElement.focus()
    }
  }
  
  if (e.key === "Enter") {
    e.preventDefault()
    const selectedTreeItem = focusedTreeOptionIndex != null ? treeOptions[focusedTreeOptionIndex] : null;
    if (onEnter) {
      onEnter(selectedTreeItem, focusedTreeOptionIndex)
    }

  }

  if ((e.key === "ArrowRight" || e.key === "ArrowLeft")
    && !e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey) {
    e.preventDefault();

    if (focusedTreeOptionIndex != null) {
      const item = treeOptions[focusedTreeOptionIndex];
      if (onArrowAction) {
        onArrowAction(item, e.key === "ArrowRight" ? "right" : "left");
      }
    }
  }

  if (e.key === "ArrowUp" && !e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey) {
    e.preventDefault()

    if (focusedTreeOptionIndex != null) {
      if (focusedTreeOptionIndex !== 0) {
        setFocusedTreeOptionIndex(focusedTreeOptionIndex - 1)
      } else {
        setFocusedTreeOptionIndex(treeOptions.length - 1)
      }
    } else {
      setFocusedTreeOptionIndex(0);
    }
  }

  if (e.key === "ArrowDown" && !e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey) {
    e.preventDefault()

    if (focusedTreeOptionIndex != null) {
      if (focusedTreeOptionIndex !== treeOptions.length - 1) {
        setFocusedTreeOptionIndex(focusedTreeOptionIndex + 1)
      } else {
        setFocusedTreeOptionIndex(0)
      }
    } else {
      setFocusedTreeOptionIndex(0);
    }
  }

  if (e.key === 'Home') {
    e.preventDefault()
    setFocusedTreeOptionIndex(0)
  }

  if (e.key === 'End') {
    e.preventDefault()
    setFocusedTreeOptionIndex(treeOptions.length - 1)
  }

}

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

  // 1. Stops focusing any listbox item
  // 2. Closes listbox if it can be, and is, expanded
  // 3. Focuses the element which made the listbox visible
  if (e.key === "Escape") {
    if (listboxDisplayed) { 
      e.preventDefault()
    }
    setFocusedListboxOptionIndex(null);
    if (listboxDisplayed && setListboxDisplayed) {
      setListboxDisplayed(false);
      comboboxElement.focus()
    }
  }

  if (e.key === 'Home') {
    e.preventDefault()
    if (listboxDisplayed) {
      setFocusedListboxOptionIndex(0)
    }
  }

  if (e.key === 'End') {
    e.preventDefault()
    if (listboxDisplayed) {
      setFocusedListboxOptionIndex(listboxOptions.length - 1)
    }
  }

  // 1. Opens listbox if it can be, and is, closed
  // 2. Sets Focus to the first option in the listbox 
  //    Spec tells us the focus should be placed on the option which was already focused, if it exists. We ignore this.
  // 2. If the listbox contains a focused option and do one of two things:
  //    2.1. If focus is not on the last option, move focus to the the next option  
  //    2.2. Move focus to the first option  
  // 3. If the menu is open and no option is focused we messed up somewhere, panic ensues and we set focus to the first option
  if (e.key === 'ArrowDown' && !e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey) {
    e.preventDefault()

    if (!listboxDisplayed && setListboxDisplayed) {
      setListboxDisplayed(true)
      setFocusedListboxOptionIndex(0)
    }

    if (focusedListboxOptionIndex != null) {
      if (focusedListboxOptionIndex !== listboxOptions.length - 1) {
        setFocusedListboxOptionIndex(focusedListboxOptionIndex + 1)
      } else {
        setFocusedListboxOptionIndex(0)
      }
    } else {
      setFocusedListboxOptionIndex(0)
    }
  }

  // 1. Opens listbox if it can be, and is, closed
  // 2. Sets Focus to the first option in the listbox (TODO: Spec tells ut should be last?)
  //    Spec tells us the focus should be placed on the option which was already focused, if it exists. We ignore this.
  // 2. If the listbox contains a focused option and do one of two things:
  //    2.1. If focus is not on the first option, move focus to the the previous option  
  //    2.2. Move focus to the last option  
  // 3. If the menu is open and no option is focused we messed up somewhere, panic ensues and we set focus to the first option
  if (e.key === 'ArrowUp' && !e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey) {
    e.preventDefault()

    if (!listboxDisplayed && setListboxDisplayed) {
      setListboxDisplayed(true)
      setFocusedListboxOptionIndex(0)
    }

    if (focusedListboxOptionIndex != null) {
      if (focusedListboxOptionIndex !== 0) {
        setFocusedListboxOptionIndex(focusedListboxOptionIndex - 1)
      } else {
        setFocusedListboxOptionIndex(listboxOptions.length - 1)
      }
    } else {
      setFocusedListboxOptionIndex(0)
    }
  }

  // 1. If a listboxOption is focused, select it. Otherwise, select null. 
  // 2. Pass this value through the `onEnter` callback  
  if (e.key === 'Enter') {
    e.preventDefault();
    const selectedListboxOption = focusedListboxOptionIndex != null ? listboxOptions[focusedListboxOptionIndex] : null;
    onEnter(selectedListboxOption, focusedListboxOptionIndex);
  }

  // Listbox removes itself when blur occurs with the exception of when blur targets its combobox element
  // Therefore we explicitly define backwards tab behavior as prevent a sticky menu 
  // We could also solve this by defining blur on the combobox element itself but this seems like a more elegant solution
  if (e.key === 'Tab' && e.shiftKey && listboxDisplayed && setListboxDisplayed) {
    e.preventDefault()
    setListboxDisplayed(false)
    setFocusedListboxOptionIndex(null)
    comboboxElement.focus()
  }
};

// Clears any value and set focus to combobox
// TODO: Make more generic, functions for treeview also
export function clearEditableCombobox(
  comboboxElement: HTMLInputElement, //  Only input or button elements may contain the combobox role and only input can be editable 
  setComboboxValue: React.Dispatch<React.SetStateAction<string>>,
  popupElementDisplayed: boolean | undefined, // Wether or not the listbox is displayed/not displayed, or if it is uncontrolled (always open or always closed)  
  setFocusedOptionIndex: React.Dispatch<React.SetStateAction<number | null>>,
) {
  comboboxElement.value = ''
  setComboboxValue('')
  if (popupElementDisplayed) {
    comboboxElement.focus();
  }
  setFocusedOptionIndex(null)
}

export function scrollOptionIntoView(
  listboxOptionElements: Array<HTMLLIElement | null>,
  focusedListboxOptionIndex: number | null,
) {
  if (focusedListboxOptionIndex !== null && listboxOptionElements) {
    listboxOptionElements[focusedListboxOptionIndex]?.scrollIntoView({
      block: "nearest",
    });
  }
}

export function preventInvalidFormSubmission(
  formElement: HTMLInputElement | HTMLButtonElement | HTMLTextAreaElement | HTMLSelectElement,
  valid: boolean,
) {
  const form = formElement.closest("form");
  if (!form) return;
  const handleSubmit = (e: Event) => {
    if (!valid) {
      e.preventDefault();
      e.stopPropagation();
      formElement.focus();
    }
  };
  form.addEventListener("submit", handleSubmit);
  return () => form.removeEventListener("submit", handleSubmit);
} 