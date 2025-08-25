export const handleKeyDownMenuBar = (
  e: React.KeyboardEvent<HTMLUListElement>,
  menuBarItems: NodeListOf<HTMLLIElement> | null, 
  focusedMenuBarItemIndex: number | null,
  setfocusedMenuBarItemIndex: React.Dispatch<React.SetStateAction<number | null>>,
) => {
  if (!menuBarItems) return;

  /*
  if (e.key === 'ArrowRight') {
    if (focusedMenubarItem != menuItemsRef.current.length - 1) {
      setFocusedMenubarItem(focusedMenubarItem === null ? 1 : focusedMenubarItem + 1);
    } else {
      setFocusedMenubarItem(0)
    }
  }

  if (e.key === 'ArrowLeft') {
    if (focusedMenubarItem != 0) {
      setFocusedMenubarItem(focusedMenubarItem === null ? menuItemsRef.current.length - 1 : focusedMenubarItem - 1);
    } else {
      setFocusedMenubarItem(menuItemsRef.current.length - 1)
    }
  }

  if (e.key === 'Home') {
    e.preventDefault();
    setFocusedMenubarItem(0);
  }

  if (e.key === 'End') {
    e.preventDefault();
    setFocusedMenubarItem(menuItemsRef.current.length - 1);
  }

  if (e.key == 'Tab') {
    setFocusedMenubarItem(null);
  }

  if (e.key === 'Escape') {
    setFocusedMenubarItem(null);
    // editor.commands.focus()
  } */
}