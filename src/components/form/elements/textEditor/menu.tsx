'use client';

import { useTranslation } from "react-i18next";
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Editor } from "@tiptap/core";
import styles from './textEditor.module.css' with { type: "css" }
import { BulletList, Link, NumberedList, Highlight, Subscript, Superscript, Underline, StrikeThrough, Bold, Italic, GreyText, FontSize, Redo, Undo } from "./menuItems";
import { handleKeyDownMenuBar } from "./functions";
import { IconDotsVertical } from "@tabler/icons-react";

export default function TextEditorMenu({
  editor,
  editorId
}: {
  editor: Editor,
  editorId: string
}) {
  // TODO: Keyboard controls act strange if i resize.

  const { t } = useTranslation("components");

  const [focusedMenubarItem, setFocusedMenubarItem] = useState<number | null>(null);
  const [menuBarParentWidth, setMenuBarParentWidth] = useState<number | undefined>(undefined); // width of menubar parent, updated on resize
  const [visibleGroups, setVisibleGroups] = useState<number[]>() // Groups which should be shown in the menubar 
  const [hiddenGroups, setHiddenGroups] = useState<number[]>() // Groups which should be shown in an expandable menu

  const menubarRef = useRef<HTMLUListElement | null>(null);
  const menuItemsRef = useRef<NodeListOf<HTMLElement> | null>(null);
  const breakpointsRef = useRef<Record<string, number>>({}); // Breakpoints calculated from width of menu elements, calculated once on render.

  const menuItemsList = [
    <li role='presentation' data-menu-group={1} key="undo">
      <Undo editor={editor} setFocusedMenubarItem={setFocusedMenubarItem} t={t} menuGroup={1} />
    </li>,
    <li role='presentation' data-menu-group={1} className={`margin-right-25 padding-right-25 ${styles['divider']}`} key="redo">
      <Redo editor={editor} setFocusedMenubarItem={setFocusedMenubarItem} t={t} menuGroup={1} />
    </li>,
    <li role='presentation' data-menu-group={2} className={`margin-right-25 padding-right-25 position-relative ${styles['divider']}`} key="font-size">
      <FontSize editor={editor} setFocusedMenubarItem={setFocusedMenubarItem} t={t} editorId={editorId} menuGroup={2} />
    </li>,
    <li role='presentation' data-menu-group={3} key="grey-text">
      <GreyText editor={editor} setFocusedMenubarItem={setFocusedMenubarItem} t={t} menuGroup={3} />
    </li>,
    <li role='presentation' data-menu-group={3} key="italic">
      <Italic editor={editor} setFocusedMenubarItem={setFocusedMenubarItem} t={t} menuGroup={3} />
    </li>,
    <li role='presentation' data-menu-group={3} key="bold">
      <Bold editor={editor} setFocusedMenubarItem={setFocusedMenubarItem} t={t} menuGroup={3} />
    </li>,
    <li role='presentation' data-menu-group={3} key="strike-through">
      <StrikeThrough editor={editor} setFocusedMenubarItem={setFocusedMenubarItem} t={t} menuGroup={3} />
    </li>,
    <li role='presentation' data-menu-group={3} key="underline">
      <Underline editor={editor} setFocusedMenubarItem={setFocusedMenubarItem} t={t} menuGroup={3} />
    </li>,
    <li role='presentation' data-menu-group={3} key="superscript">
      <Superscript editor={editor} setFocusedMenubarItem={setFocusedMenubarItem} t={t} menuGroup={3} />
    </li>,
    <li role='presentation' data-menu-group={3} key="subscript">
      <Subscript editor={editor} setFocusedMenubarItem={setFocusedMenubarItem} t={t} menuGroup={3} />
    </li>,
    <li role='presentation' data-menu-group={3} className={`margin-right-25 padding-right-25 ${styles['divider']}`} key="highlight">
      <Highlight editor={editor} setFocusedMenubarItem={setFocusedMenubarItem} t={t} menuGroup={3} />
    </li>,
    <li role='presentation' data-menu-group={4} className={`margin-right-25 padding-right-25 ${styles['divider']}`} key="link">
      <Link editor={editor} setFocusedMenubarItem={setFocusedMenubarItem} t={t} menuGroup={4} />
    </li>,
    <li role='presentation' data-menu-group={5} key="bulletlist" >
      <BulletList editor={editor} setFocusedMenubarItem={setFocusedMenubarItem} t={t} menuGroup={5} />
    </li>,
    <li role='presentation' data-menu-group={5} key="numberedlist" >
      <NumberedList editor={editor} setFocusedMenubarItem={setFocusedMenubarItem} t={t} menuGroup={5} />
    </li>
  ];

  // Get a ref of all menu items in our menubar
  // TODO: This is a lil hacky
  // TODO: Should this be a ref even? Or state?
  useEffect(() => {
    if (menubarRef.current) {
      menuItemsRef.current = menubarRef.current.querySelectorAll(
        "div > [role='menubar'] > li > [role='menuitem'], div > [role='menubar'] > li > [role='menuitemcheckbox'], div > [role='menubar'] > li > [role='menuitemradio']"
      ) as NodeListOf<HTMLElement>;
    }
  }, [menuBarParentWidth, visibleGroups, hiddenGroups])

  // Calculate breakpoints in our menubar
  useEffect(() => {
    if (!menuItemsRef.current) return;

    const groupWidths: Record<string, number> = {};
    menuItemsRef.current.forEach((menuItem) => {
      const menuItemGroup = menuItem.dataset.menuGroup;
      const menuItemParent = menuItem.parentElement;
      if (!menuItemParent || !menuItemGroup) return;

      const width =
        menuItemParent.offsetWidth +
        parseInt(getComputedStyle(menuItemParent).marginRight);
      groupWidths[menuItemGroup] =
        (groupWidths[menuItemGroup] ?? 0) +
        width;
    })

    const breakpoints: Record<string, number> = {};
    let runningTotal = 0;

    Object.keys(groupWidths)
      .forEach((key) => {
        runningTotal += groupWidths[key];
        breakpoints[key] = runningTotal;
      });

    breakpointsRef.current = breakpoints;
  }, [])

  // Add resize observer to our menubar
  // TODO: Can probably just check against the menubar itself now due to changed styling.
  useEffect(() => {
    function updateWidth() {
      const menuBarParent = menubarRef.current?.parentElement
      if (!menuBarParent) return

      setMenuBarParentWidth(
        menuBarParent.clientWidth -
        parseInt(getComputedStyle(menuBarParent).paddingInline)
      );
    }

    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, [])

  // TODO: Figure that one pixel which causes overflow instead of removing element from list ):
  useEffect(() => {
    if (!menuBarParentWidth) return

    const calculatedVisibleGroups: number[] = [];
    const calculatedHiddenGroups: number[] = [];

    menuItemsList.map((menuItem) => {
      if (menuBarParentWidth < breakpointsRef.current[menuItem.props["data-menu-group"]]) {
        if (!calculatedHiddenGroups.includes(menuItem.props["data-menu-group"])) {
          calculatedHiddenGroups.push(menuItem.props["data-menu-group"])
        }
      } else {
        if (!calculatedVisibleGroups.includes(menuItem.props["data-menu-group"])) {
          calculatedVisibleGroups.push(menuItem.props["data-menu-group"])
        }
      }
    })

    setVisibleGroups(calculatedVisibleGroups)
    setHiddenGroups(calculatedHiddenGroups)

  }, [menuBarParentWidth])

  // Set focus to a menubar item when navigating using keyboard arrows
  useEffect(() => {
    if (!menuItemsRef.current) return;

    if (focusedMenubarItem !== null) {
      const target = menuItemsRef.current[focusedMenubarItem] as HTMLElement | undefined;

      if (target) {
        target.focus();
      }
    }

  }, [focusedMenubarItem]);

  // Submenu config stuff
  const [focusedSubmenuItem, setfocusedSubmenuItem] = useState<number | null>(null);
  const [submenuVisible, setSubmenuVisible] = useState<boolean>()

  const submenuButtonRef = useRef<HTMLSpanElement>(null);
  const submenuRef = useRef<HTMLUListElement | null>(null);
  const submenuItemsRef = useRef<NodeListOf<HTMLElement> | null>(null);

  // Get submenu items
  useEffect(() => {
    if (submenuRef.current) {
      submenuItemsRef.current = submenuRef.current.querySelectorAll(
        "li > [role='menuitem'], li > [role='menuitemcheckbox'], li > [role='menuitemradio']"
      ) as NodeListOf<HTMLElement>;
    }
  }, [submenuVisible])

  // Set focus to a submenubar item when navigating using keyboard arrows
  useEffect(() => {
    if (!submenuItemsRef.current) return;

    if (focusedSubmenuItem !== null) {
      const target = submenuItemsRef.current[focusedSubmenuItem] as HTMLElement | undefined;

      if (target) {
        target.focus();
      }
    }

  }, [focusedSubmenuItem]);

  useEffect(() => {
    console.log(focusedMenubarItem)
  }, [focusedMenubarItem])

  if (!editor) {
    return null
  }

  return (
    <div className={`${styles["text-editor-menu"]} button-group margin-0`}>
      <ul
        onKeyDown={(e: React.KeyboardEvent<HTMLUListElement>) => {
          if (!menuItemsRef.current) return;
          if (e.key === "Escape") {
            editor.commands.focus();
          }
          handleKeyDownMenuBar(
            e,
            menuItemsRef.current,
            focusedMenubarItem,
            setFocusedMenubarItem
          )
        }}
        ref={menubarRef}
        role='menubar'
        className='margin-0 padding-0'
      >
        {menuItemsList
          .filter((menuItem) =>
            !visibleGroups || visibleGroups.includes(Number(menuItem.props["data-menu-group"]))
          )
          .map((menuItem) => menuItem)
        }
        <li 
          role='presentation' 
          style={{ 
            float: 'right', 
            position: 'relative', 
            display: hiddenGroups && hiddenGroups.length > 0 ? 'inline-block' : 'none'
          }}>
          <span
            ref={submenuButtonRef}
            data-tooltip="Meny" // TODO: I18n 
            role='menuitem'
            aria-label="Meny" // TODO: I18n
            aria-haspopup="menu"
            aria-checked={submenuVisible}
            tabIndex={-1}
            onClick={() => setSubmenuVisible(!submenuVisible)}
            onKeyDown={(e: React.KeyboardEvent) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                setSubmenuVisible(!submenuVisible)
                setfocusedSubmenuItem(0)
              }
              if (e.key === ' ') {
                e.preventDefault();
                setSubmenuVisible(!submenuVisible)
              }
              if (e.key === "Escape") {
                e.preventDefault()
                e.stopPropagation()
                submenuButtonRef.current?.focus()
                setfocusedSubmenuItem(null)
                setSubmenuVisible(false)
              }
              if (e.key === 'ArrowDown' || e.key == 'ArrowUp') {
                if (!submenuItemsRef.current) return
                e.preventDefault()
                if (!submenuVisible) { setSubmenuVisible(true) }
                setfocusedSubmenuItem(0)
              }
            }}
          >
            <IconDotsVertical className="grid" height={16} width={16} aria-hidden="true" />
          </span>
          <ul
            onKeyDown={(e: React.KeyboardEvent<HTMLUListElement>) => {
              if (!submenuItemsRef.current) return
              if (e.key === "Escape") {
                e.preventDefault()
                e.stopPropagation()
                submenuButtonRef.current?.focus()
                setfocusedSubmenuItem(null)
                setSubmenuVisible(false)
              }
              if (e.key === "ArrowUp") {
                e.preventDefault()
                e.stopPropagation()
                submenuButtonRef.current?.focus()
                setfocusedSubmenuItem(null)
              }
              handleKeyDownMenuBar(
                e,
                submenuItemsRef.current,
                focusedSubmenuItem,
                setfocusedSubmenuItem
              )
            }}
            ref={submenuRef}
            role="menubar"
            style={{
              padding: '2px',
              width: 'max-content',
              zIndex: '1',
              margin: '0',
              backgroundColor: 'var(--gray-95)',
              borderRadius: '.25rem',
              listStyle: 'none',
              position: 'absolute',
              top: 'calc(100% + 9px)',
              right: '.25rem',
              boxShadow: "rgba(50, 50, 105, 0.15) 0px 2px 5px 0px, rgba(0, 0, 0, 0.05) 0px 1px 1px 0px"
            }}
          >
            {submenuVisible && menuItemsList
              .filter((menuItem) =>
                !hiddenGroups || hiddenGroups.includes(Number(menuItem.props["data-menu-group"]))
              )
              .map((menuItem) => menuItem)
            }
          </ul>
        </li>
      </ul>
    </div>
  )
}