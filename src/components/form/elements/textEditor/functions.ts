// TODO: Move all keyhandlers to shared file

import type { Editor } from "@tiptap/core";

export const handleKeyDownMenuBar = (
  e: React.KeyboardEvent<HTMLUListElement>,
  menuBarItems: NodeListOf<HTMLElement> | Array<HTMLElement>,
  focusedMenuBarItemIndex: number | null,
  setfocusedMenuBarItemIndex: React.Dispatch<React.SetStateAction<number | null>>,
) => {
  if (e.key === 'ArrowRight') {
    e.stopPropagation()
    if (focusedMenuBarItemIndex != menuBarItems.length - 1) {
      setfocusedMenuBarItemIndex(focusedMenuBarItemIndex === null ? 1 : focusedMenuBarItemIndex + 1);
    } else {
      setfocusedMenuBarItemIndex(0)
    }
  }

  if (e.key === 'ArrowLeft') {
    e.stopPropagation()
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

/** 
 * A popupmenu is **always** vertical and **must** be located in a parent `menuitem` 
**/
export const handleKeyDownPopUpMenu = (
  e: React.KeyboardEvent<HTMLUListElement>,
  editor: Editor,
  parentMenuItem: HTMLElement,
  menuItems: NodeListOf<HTMLElement> | Array<HTMLElement>,
  focusedMenuItemIndex: number | null,
  setfocusedMenuItemIndex: React.Dispatch<React.SetStateAction<number | null>>,
  setMenuOpen: React.Dispatch<React.SetStateAction<boolean>>,
  setFocusedMenubarItem: React.Dispatch<React.SetStateAction<number | null>>
) => {

  if (e.key === 'ArrowDown') {
    if (focusedMenuItemIndex != null) {
      e.preventDefault()
      e.stopPropagation()

      if (focusedMenuItemIndex != menuItems.length - 1) {
        setfocusedMenuItemIndex(focusedMenuItemIndex + 1)
      } else {
        setfocusedMenuItemIndex(0)
      }
    }
  }

  if (e.key === 'ArrowUp') {
    if (focusedMenuItemIndex != null) {
      e.preventDefault()
      e.stopPropagation()

      if (focusedMenuItemIndex != 0) {
        setfocusedMenuItemIndex(focusedMenuItemIndex - 1)
      } else {
        setfocusedMenuItemIndex(menuItems.length - 1)
      }
    }
  }

  if (e.key == 'Escape') {
    e.preventDefault()   
    e.stopPropagation();
    parentMenuItem.focus();
    setMenuOpen(false)
    setfocusedMenuItemIndex(null)
  }

  /* Theese do not affect our menu, we instead close menu and let parent menu controls kick in. */
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'Tab' || e.key === 'End' || e.key === 'Home') {
    setMenuOpen(false)
    setfocusedMenuItemIndex(null)
  }

  
  if (e.key === 'Enter') {
    e.preventDefault();
    e.stopPropagation()
    if (focusedMenuItemIndex != null) {
      const itemEl = menuItems[focusedMenuItemIndex];
      const selectedSize = itemEl?.getAttribute('data-size');
      if (selectedSize === 'unset') {
        editor.chain().focus().unsetFontSize().run();
      } else if (selectedSize) {
        editor.chain().focus().setFontSize(selectedSize).run();
      }
      setMenuOpen(false);
      setfocusedMenuItemIndex(null);
      setFocusedMenubarItem(null);
    }
  }

  if (e.key === ' ') {
    e.preventDefault();
    e.stopPropagation()
    if (focusedMenuItemIndex != null) {
      const itemEl = menuItems[focusedMenuItemIndex];
      const selectedSize = itemEl?.getAttribute('data-size');
      if (selectedSize === 'unset') {
        editor.chain().unsetFontSize().run();
      } else if (selectedSize) {
        editor.chain().setFontSize(selectedSize).run();
      }
    }
  }
  
}