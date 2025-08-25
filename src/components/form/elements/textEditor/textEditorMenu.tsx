'use client';

import { useTranslation } from "react-i18next";
import React, { useEffect, useRef, useState } from 'react';
import { Editor } from "@tiptap/core";
import styles from './textEditor.module.css' with { type: "css" }
import { BulletList, Link, NumberedList, Highlight, Subscript, Superscript, Underline, StrikeThrough, Bold, Italic, GreyText, FontSize, Redo, Undo } from "./menuButtons";
import { handleKeyDownMenuBar } from "./functions";

export default function TextEditorMenu({
  editor,
  editorId
}: {
  editor: Editor,
  editorId: string
}) {

  const { t } = useTranslation("components");

  const [focusedMenubarItem, setFocusedMenubarItem] = useState<number | null>(null);

  const initialList = [
    <li role='presentation' key="undo">
      <Undo editor={editor} setFocusedMenubarItem={setFocusedMenubarItem} t={t} menuGroup={1} />
    </li>,
    <li role='presentation' className={`margin-right-25 padding-right-25 ${styles['divider']}`} key="redo">
      <Redo editor={editor} setFocusedMenubarItem={setFocusedMenubarItem} t={t} menuGroup={1} />
    </li>,
    <li role='presentation' className={`margin-right-25 padding-right-25 position-relative ${styles['divider']}`} key="font-size">
      <FontSize editor={editor} setFocusedMenubarItem={setFocusedMenubarItem} t={t} editorId={editorId} menuGroup={2} />
    </li>,
    <li role='presentation' key="grey-text">
      <GreyText editor={editor} setFocusedMenubarItem={setFocusedMenubarItem} t={t} menuGroup={3} />
    </li>,
    <li role='presentation' key="italic">
      <Italic editor={editor} setFocusedMenubarItem={setFocusedMenubarItem} t={t} menuGroup={3} />
    </li>,
    <li role='presentation' key="bold">
      <Bold editor={editor} setFocusedMenubarItem={setFocusedMenubarItem} t={t} menuGroup={3} />
    </li>,
    <li role='presentation' key="strike-through">
      <StrikeThrough editor={editor} setFocusedMenubarItem={setFocusedMenubarItem} t={t} menuGroup={3} />
    </li>,
    <li role='presentation' key="underline">
      <Underline editor={editor} setFocusedMenubarItem={setFocusedMenubarItem} t={t} menuGroup={3} />
    </li>,
    <li role='presentation' key="superscript">
      <Superscript editor={editor} setFocusedMenubarItem={setFocusedMenubarItem} t={t} menuGroup={3} />
    </li>,
    <li role='presentation' key="subscript">
      <Subscript editor={editor} setFocusedMenubarItem={setFocusedMenubarItem} t={t} menuGroup={3} />
    </li>,
    <li role='presentation' className={`margin-right-25 padding-right-25 ${styles['divider']}`} key="highlight">
      <Highlight editor={editor} setFocusedMenubarItem={setFocusedMenubarItem} t={t} menuGroup={3} />
    </li>,
    <li role='presentation' className={`margin-right-25 padding-right-25 ${styles['divider']}`} key="link">
      <Link editor={editor} setFocusedMenubarItem={setFocusedMenubarItem} t={t} menuGroup={4} />
    </li>,
    <li role='presentation' key="bulletlist" >
      <BulletList editor={editor} setFocusedMenubarItem={setFocusedMenubarItem} t={t} menuGroup={5} />
    </li>,
    <li role='presentation' key="numberedlist" >
      <NumberedList editor={editor} setFocusedMenubarItem={setFocusedMenubarItem} t={t} menuGroup={5} />
    </li>
  ]

  const menubarRef = useRef<HTMLUListElement | null>(null);
  const menuItemsRef = useRef<NodeListOf<HTMLElement> | null>(null);

  useEffect(() => {
    if (menubarRef.current) {
      menuItemsRef.current = menubarRef.current.querySelectorAll(
        "[role='menubar'] > li > [role='menuitem'], [role='menubar'] > li > [role='menuitemcheckbox'], [role='menubar'] > li > [role='menuitemradio']"
      ) as NodeListOf<HTMLElement>;
    }
  }, [])

  useEffect(() => {
    if (!menuItemsRef.current) return;

    if (focusedMenubarItem !== null) {
      const target = menuItemsRef.current[focusedMenubarItem] as HTMLElement | undefined;

      if (target) {
        target.focus();
      }
    }
  }, [focusedMenubarItem]);

    /*
  const [parentWidth, setParentWidth] = useState(0);
  const [cumulativeWidths, setCumulativeWidths] = useState<any>()
  const [list, setList] = useState(initialList);

  useEffect(() => {
    if (menubarRef.current) {
      menuItemsRef.current = menubarRef.current.querySelectorAll(
        "[role='menubar'] > li > [role='menuitem'], [role='menubar'] > li > [role='menuitemcheckbox'], [role='menubar'] > li > [role='menuitemradio']"
      ) as NodeListOf<HTMLElement>;
    }

    if (menuItemsRef.current) {
      // Step 1: group widths
      const groupWidths: Record<string, number> = {};

      Array.from(menuItemsRef.current).forEach((el) => { // TODO: CHECK ONCE AND COMPARE AGAINST PARENT
        const group = el.dataset.menuGroup ?? "ungrouped";

        const parent = el.parentElement; // get the parent
        if (!parent) return;

        let width = parent.offsetWidth; // use parent width
        const style = getComputedStyle(parent); // get parent styles if needed
        width += parseInt(style.marginRight);

        groupWidths[group] = (groupWidths[group] ?? 0) + width;
      });

      // Step 2: cumulative widths
      const cumulativeWidths: Record<string, number> = {};
      let runningTotal = 0;

      Object.keys(groupWidths)
        .sort((a, b) => Number(a) - Number(b)) // sort groups numerically
        .forEach((group) => {
          runningTotal += groupWidths[group];
          cumulativeWidths[group] = runningTotal;
        });
      setCumulativeWidths(cumulativeWidths)
    }
  }, []);

 */
  
  /*
  useEffect(() => {
    function updateWidth() {
      if (menubarRef.current?.parentElement) { // TODO: WE DO NOT NEED TO SET THIS ON EACH RESIZE
        setParentWidth(menubarRef.current.parentElement.clientWidth - 4); // Parent height minus padding, find better way to do this
      }

    if (cumulativeWidths && parentWidth) {
      if (parentWidth < cumulativeWidths[5] && removedItems.length === 0) {
        // remove items and store them
        setList(prevList => {
          const newList = [...prevList];
          const removed = newList.splice(12, 2); // remove indices 12 & 13
          setRemovedItems(removed);
          return newList;
        });
      } else if (parentWidth >= cumulativeWidths[5] && removedItems.length > 0) {
        // re-add previously removed items
        setList(prevList => {
          const newList = [...prevList];
          newList.splice(12, 0, ...removedItems); // reinsert at index 12
          setRemovedItems([]);
          return newList;
        });
      }
    }

      if (cumulativeWidths && parentWidth && parentWidth < cumulativeWidths[4]) {
        setList(prevList => {
          // make a copy and remove indices 12 and 13
          const newList = [...prevList];
          newList.splice(11, 1);
          return newList;
        });
      }

      if (cumulativeWidths && parentWidth && parentWidth < cumulativeWidths[3]) {
        setList(prevList => {
          // make a copy and remove indices 12 and 13
          const newList = [...prevList];
          newList.splice(3, 8);
          return newList;
        });
      }

      if (cumulativeWidths && parentWidth && parentWidth < cumulativeWidths[2]) {
        setList(prevList => {
          // make a copy and remove indices 12 and 13
          const newList = [...prevList];
          newList.splice(2, 1);
          return newList;
        });
      }

      if (cumulativeWidths && parentWidth && parentWidth < cumulativeWidths[1]) {
        setList(prevList => {
          // make a copy and remove indices 12 and 13
          const newList = [...prevList];
          newList.splice(1, 2);
          return newList;
        });
      }

    }

    // run once on mount
    updateWidth();

    // listen for window resize
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, [cumulativeWidths, parentWidth, removedItems]);
 */

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
        {initialList.map((listItem) => {
          return listItem
        })}
      </ul>
    </div>
  )
}