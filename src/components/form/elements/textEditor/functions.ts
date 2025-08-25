export const handleKeyDownMenuBar = (
  e: React.KeyboardEvent<HTMLUListElement>,
  menuBarItems: NodeListOf<HTMLElement>, // TODO: Make htmlli element??
  focusedMenuBarItemIndex: number | null,
  setfocusedMenuBarItemIndex: React.Dispatch<React.SetStateAction<number | null>>,
) => { 
  if (e.key === 'ArrowRight') {
    if (focusedMenuBarItemIndex != menuBarItems.length - 1) {
      setfocusedMenuBarItemIndex(focusedMenuBarItemIndex === null ? 1 : focusedMenuBarItemIndex + 1);
    } else {
      setfocusedMenuBarItemIndex(0)
    }
  }
  
  if (e.key === 'ArrowLeft') {
    if (focusedMenuBarItemIndex != 0) {
      setfocusedMenuBarItemIndex(focusedMenuBarItemIndex === null ? menuBarItems.length - 1 : focusedMenuBarItemIndex - 1);
    } else {
      setfocusedMenuBarItemIndex(menuBarItems.length - 1)
    }
  }

  if (e.key === 'Home') {
    e.preventDefault();
    setfocusedMenuBarItemIndex(0);
  }

  if (e.key === 'End') {
    e.preventDefault();
    setfocusedMenuBarItemIndex(menuBarItems.length - 1);
  }
  
  if (e.key == 'Tab') {
    setfocusedMenuBarItemIndex(null);
  }

  if (e.key === 'Escape') {
    setfocusedMenuBarItemIndex(null);
  } 
}