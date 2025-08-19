// TODO: JSDOC comments
// TODO: Check that all handles an undefined listboxdisplayed value
export const handleKeyDownEditableCombobox = (
  e: React.KeyboardEvent<HTMLInputElement>,
  comboboxElement: HTMLInputElement | HTMLButtonElement, // The element which sets the listboxDisplayed value, always an input or button element as those can contain the combobox role 
  listboxDisplayed: boolean | undefined, // Wether or not the listbox is displayed/not displayed, or if it is uncontrolled (always open or always closed)  
  setlistboxDisplayed: React.Dispatch<React.SetStateAction<boolean>> | undefined, 
  listboxOptions: Array<{name: string, value: string}>, 
  focusedListboxOptionIndex: number | null,
  setfocusedListboxOptionIndex: React.Dispatch<React.SetStateAction<number | null>>,
  onEnter: (selectedOption: any | null, index: number | null) => void 
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

    if (listboxDisplayed && setlistboxDisplayed) { 
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

    if (listboxDisplayed && setlistboxDisplayed) { 
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
};

/*
    // Selects option and remove listbox (TODO: Check value aswell/lenght of list or whatever...)
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation(); // Prevent higher-level reopens
      if (menuOpen && focusedListBoxItem != null && results.length > 0) {
        setValue(results[focusedListBoxItem] !== value ? results[focusedListBoxItem] : { name: "", value: "" }),
          setFocusedListBoxItem(null)
        setMenuOpen(false);
        toggleRef.current?.focus()
      }
    }
*/