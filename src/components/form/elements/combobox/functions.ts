import { treeItem } from "@/components/types";

export const handleKeyDownTreeCombobox = (
  e: React.KeyboardEvent<HTMLInputElement>,
  comboboxElement: HTMLInputElement | HTMLButtonElement, // The element which sets the listboxDisplayed value, always an input or button element as those can contain the combobox role 
  treeDisplayed: boolean | undefined, // Wether or not the listbox is displayed/not displayed, or if it is uncontrolled (always open or always closed)  
  setTreeDisplayed: React.Dispatch<React.SetStateAction<boolean>> | undefined,
  treeOptions: Array<treeItem>,
  focusedTreeOptionIndex: number | null,
  setfocusedTreeOptionIndex: React.Dispatch<React.SetStateAction<number | null>>,
  setExpanded: React.Dispatch<React.SetStateAction<Set<string>>>,
  onEnter: (selectedTreeItem: treeItem | null, index: number | null) => void
) => {

  if (e.key == "Enter") {
    if (focusedTreeOptionIndex === null) return

    const focusedItem = treeOptions[focusedTreeOptionIndex]

    if (focusedItem.childNodes.length > 0) {
      // Toggle expand/collapse
      setExpanded(prev => {
        const next = new Set(prev)
        next.has(focusedItem.value)
          ? next.delete(focusedItem.value)
          : next.add(focusedItem.value)
        return next
      })
    }
  }

  // 1. Stops focusing any listbox item
  // 2. Closes listbox if it can be, and is, expanded
  // 3. Focuses the element which made the listbox visible
  if (e.key === "Escape") {
    setfocusedTreeOptionIndex(null);
    if (treeDisplayed && setTreeDisplayed) {
      setTreeDisplayed(false);
      comboboxElement.focus()
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

    if (!treeDisplayed && setTreeDisplayed) {
      setTreeDisplayed(true)
      setfocusedTreeOptionIndex(0)
    }

    if (focusedTreeOptionIndex != null) {
      if (focusedTreeOptionIndex != treeOptions.length - 1) {
        setfocusedTreeOptionIndex(focusedTreeOptionIndex + 1)
      } else {
        setfocusedTreeOptionIndex(0)
      }
    } else {
      setfocusedTreeOptionIndex(0)
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

    if (!treeDisplayed && setTreeDisplayed) {
      setTreeDisplayed(true)
      setfocusedTreeOptionIndex(0)
    }

    if (focusedTreeOptionIndex != null) {
      if (focusedTreeOptionIndex != 0) {
        setfocusedTreeOptionIndex(focusedTreeOptionIndex - 1)
      } else {
        setfocusedTreeOptionIndex(treeOptions.length - 1)
      }
    } else {
      setfocusedTreeOptionIndex(0)
    }
  }

}

// TODO: Replace {name: string, value: string} with option type
export const handleKeyDownEditableCombobox = (
  e: React.KeyboardEvent<HTMLInputElement>,
  comboboxElement: HTMLInputElement | HTMLButtonElement, // The element which sets the listboxDisplayed value, always an input or button element as those can contain the combobox role 
  listboxDisplayed: boolean | undefined, // Wether or not the listbox is displayed/not displayed, or if it is uncontrolled (always open or always closed)  
  setlistboxDisplayed: React.Dispatch<React.SetStateAction<boolean>> | undefined,
  listboxOptions: Array<{ name: string, value: string }>,
  focusedListboxOptionIndex: number | null,
  setfocusedListboxOptionIndex: React.Dispatch<React.SetStateAction<number | null>>,
  onEnter: (selectedOption: { name: string, value: string } | null, index: number | null) => void
) => {

  // 1. Stops focusing any listbox item
  // 2. Closes listbox if it can be, and is, expanded
  // 3. Focuses the element which made the listbox visible
  if (e.key === "Escape") {
    setfocusedListboxOptionIndex(null);
    if (listboxDisplayed && setlistboxDisplayed) {
      setlistboxDisplayed(false);
      comboboxElement.focus()
    }
  }

  if (e.key === 'Home') {
    e.preventDefault()
    if (listboxDisplayed) {
      setfocusedListboxOptionIndex(0)
    }
  }

  if (e.key === 'End') {
    e.preventDefault()
    if (listboxDisplayed) {
      setfocusedListboxOptionIndex(listboxOptions.length - 1)
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

    if (!listboxDisplayed && setlistboxDisplayed) {
      setlistboxDisplayed(true)
      setfocusedListboxOptionIndex(0)
    }

    if (focusedListboxOptionIndex != null) {
      if (focusedListboxOptionIndex != listboxOptions.length - 1) {
        setfocusedListboxOptionIndex(focusedListboxOptionIndex + 1)
      } else {
        setfocusedListboxOptionIndex(0)
      }
    } else {
      setfocusedListboxOptionIndex(0)
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

    if (!listboxDisplayed && setlistboxDisplayed) {
      setlistboxDisplayed(true)
      setfocusedListboxOptionIndex(0)
    }

    if (focusedListboxOptionIndex != null) {
      if (focusedListboxOptionIndex != 0) {
        setfocusedListboxOptionIndex(focusedListboxOptionIndex - 1)
      } else {
        setfocusedListboxOptionIndex(listboxOptions.length - 1)
      }
    } else {
      setfocusedListboxOptionIndex(0)
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
  if (e.key === 'Tab' && e.shiftKey && listboxDisplayed && setlistboxDisplayed) {
    e.preventDefault()
    setlistboxDisplayed(false)
    setfocusedListboxOptionIndex(null)
    comboboxElement.focus()
  }
};

// Clears any value and set focus to combobox
export function clearEditableCombobox(
  comboboxElement: HTMLInputElement, //  Only input or button elements may containt the combobox role and only input can be editable 
  setComboboxValue: React.Dispatch<React.SetStateAction<string>>,
  listboxDisplayed: boolean | undefined, // Wether or not the listbox is displayed/not displayed, or if it is uncontrolled (always open or always closed)  
  setfocusedListboxOptionIndex: React.Dispatch<React.SetStateAction<number | null>>,
) {
  comboboxElement.value = ''
  setComboboxValue('')
  if (listboxDisplayed) {
    comboboxElement.focus();
  }
  setfocusedListboxOptionIndex(null)
}

export function scrollOptionIntoView(
  listboxOptionElements: Array<HTMLLIElement | null>,
  focusedListboxOptionIndex: number | null
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