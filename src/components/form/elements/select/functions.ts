// All of theese discounting 'Enter' Should be the same for a listbox-combobox combo
// TODO: JSDOC comments
// TODO: Check that all handles an undefined listboxdisplayed value
// TODO: Replace focusedListboxItem with focusedListboxOption
const handleKeyDownEditableCombobox = (
  e: React.KeyboardEvent<HTMLInputElement>,
  comboboxElement: HTMLInputElement,
  listboxToggleElement: HTMLInputElement | HTMLButtonElement, // The element which sets the listBoxDisplayed value, always an input or button element as those can contain the combobox role 
  listBoxOptions: Array<any>, // TODO: Check wether i should give type Array<{name: string, value: string}>
  listboxDisplayed: boolean | undefined, // Wether or not the listbox is displayed/not displayed, or if it is uncontrolled (always open or always closed)  
  setlistboxDisplayed: React.Dispatch<React.SetStateAction<boolean>> | undefined, 
  focusedListBoxItem: number | null,
  setFocusedListBoxItem: React.Dispatch<React.SetStateAction<number | null>>,
) => {
  // 1. Stops focusing any listbox item
  // 2. Closes listbox if it can be, and is, expanded
  // 3. Focuses the element which made the listbox visible
  if (e.key === "Escape") {
    setFocusedListBoxItem(null);
    if (listboxDisplayed && setlistboxDisplayed) {
      setlistboxDisplayed(false);
      listboxToggleElement.focus()
    }
  }

  if (e.key === 'Home') {
    e.preventDefault()
    if (listboxDisplayed) {
      setFocusedListBoxItem(0)
    }
  }
 
  if (e.key === 'End') {
    e.preventDefault()
    if (listboxDisplayed) {
      setFocusedListBoxItem(listBoxOptions.length - 1)
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

    if (listboxDisplayed && setlistboxDisplayed) { 
      setlistboxDisplayed(true)
      setFocusedListBoxItem(0)
    }

    if (focusedListBoxItem != null) {  
      if (focusedListBoxItem != listBoxOptions.length - 1) {
        setFocusedListBoxItem(focusedListBoxItem + 1)
      } else {
        setFocusedListBoxItem(0)
      }
    } else {
      setFocusedListBoxItem(0)
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

    if (listboxDisplayed && setlistboxDisplayed) { 
      setlistboxDisplayed(true)
      setFocusedListBoxItem(0)
    }

    if (focusedListBoxItem != null) {  
      if (focusedListBoxItem != 0) {
        setFocusedListBoxItem(focusedListBoxItem - 1)
      } else {
        setFocusedListBoxItem(listBoxOptions.length - 1)
      }
    } else {
      setFocusedListBoxItem(0)
    }
  }

  /* Above code based on how it is defined within selectMultipleSearch (as of 2025-08-19) */
};