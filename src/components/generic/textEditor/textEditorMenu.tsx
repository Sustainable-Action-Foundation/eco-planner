'use client';

import { useTranslation } from "react-i18next";
import React, { useEffect, useRef, useState } from 'react';
import { useThrottledCallback } from 'use-debounce';
import { IconDotsVertical } from "@tabler/icons-react";
import { Editor } from "@tiptap/core";
import styles from './textEditor.module.css' with { type: "css" }
import { BulletList, Link, NumberedList, Highlight, Subscript, Superscript, Underline, StrikeThrough, Bold, Italic, GreyText, FontSize, Redo, Undo } from "./menuButtons";

export default function TextEditorMenu({
  editor,
  editorId
}: {
  editor: Editor,
  editorId: string
}) {

  const { t } = useTranslation("components");

  const [focusedMenubarItem, setFocusedMenubarItem] = useState<number | null>(null);

  const menubarRef = useRef<HTMLUListElement | null>(null);
  const menuItemsRef = useRef<NodeListOf<HTMLElement> | null>(null);

  useEffect(() => {
    if (menubarRef.current) {
      menuItemsRef.current = menubarRef.current.querySelectorAll(
        "[role='menubar'] > li > [role='menuitem'], [role='menubar'] > li > [role='menuitemcheckbox'], [role='menubar'] > li > [role='menuitemradio']"
      ) as NodeListOf<HTMLElement>;
    }

  }, []);

  useEffect(() => {
    if (!menuItemsRef.current) return;

    if (focusedMenubarItem !== null) {
      const target = menuItemsRef.current[focusedMenubarItem] as HTMLElement | undefined;

      if (target) {
        target.focus();
      }
    }
  }, [focusedMenubarItem]);

  const handleKeyDownMenuBar = (e: React.KeyboardEvent<HTMLUListElement>) => {
    if (!menuItemsRef.current) return;

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
      editor.commands.focus()
    }
  }

  const [list, setList] = useState([
    <li role='presentation' key="undo">
      <Undo editor={editor} t={t} />
    </li>,
    <li role='presentation' className='margin-right-25 padding-right-25' style={{ borderRight: '1px solid var(--gray-80)' }} key="redo">
      <Redo editor={editor} t={t} />
    </li>,
    <li role='presentation' className='margin-right-25 padding-right-25 position-relative' style={{ borderRight: '1px solid var(--gray-80)' }} key="font-size">
      <FontSize editor={editor} t={t} editorId={editorId} setFocusedMenubarItem={setFocusedMenubarItem} />
    </li>,
    <li role='presentation' key="grey-text">
      <GreyText editor={editor} t={t} />
    </li>,
    <li role='presentation' key="italic">
      <Italic editor={editor} t={t} />
    </li>,
    <li role='presentation' key="bold">
      <Bold editor={editor} t={t} />
    </li>,
    <li role='presentation' key="strike-through">
      <StrikeThrough editor={editor} t={t} />
    </li>,
    <li role='presentation' key="underline">
      <Underline editor={editor} t={t} />
    </li>,
    <li role='presentation' key="superscript">
      <Superscript editor={editor} t={t} />
    </li>,
    <li role='presentation' key="subscript">
      <Subscript editor={editor} t={t} />
    </li>,
    <li role='presentation' className='margin-right-25 padding-right-25' style={{ borderRight: '1px solid var(--gray-80)' }} key="highlight">
      <Highlight editor={editor} t={t} />
    </li>,
    <li role='presentation' className='margin-right-25 padding-right-25' style={{ borderRight: '1px solid var(--gray-80)' }} key="link">
      <Link editor={editor} t={t} />
    </li>,
    <li role='presentation' key="bulletlist">
      <BulletList editor={editor} t={t} />
    </li>,
    <li role='presentation' key="numberedlist">
      <NumberedList editor={editor} t={t} />
    </li>
  ])

  const [overFlowList, setOverFlowList] = useState<React.JSX.Element[]>([]);

  // parent.scrollWidth - 4 == width without padding
  // list.length === 2 ? 114 : 38 is: 
  // element width (24px/100px) + list item padding (4px) + list item margin (4px) + list item border (1px) + parent padding (4px) + 1
  const checkOverflowAgainstParent = () => {
    const ul = menubarRef.current;
    const parent = ul?.parentElement;

    if (ul && parent && menuItemsRef.current) {

      if (ul.scrollWidth == (parent.scrollWidth - 4) && list.length > 0) {

        const newList = [...list]; // clone the array
        const movingItem = newList.pop(); // mutate the clone
        setList(newList);

        if (movingItem === undefined) {
          throw new Error();
        }

        let newOverFlowList = overFlowList;
        newOverFlowList.unshift(movingItem);
        newOverFlowList = newOverFlowList.filter((item, i, ownArray) => {
          return ownArray.findIndex(thing => thing.key === item.key) === i;
        });
        setOverFlowList(newOverFlowList)
      } else if (ul.scrollWidth <= (parent.scrollWidth - (list.length === 2 ? 114 : 38)) && overFlowList.length > 0) { 
        const newOverflow = [...overFlowList];
        const restoringItem = newOverflow.shift(); // get first item

        if (restoringItem === undefined) {
          throw new Error();
        }

        setList(prevList => [...prevList, restoringItem]); // add to end of list
        setOverFlowList(newOverflow);
      }
    }
  };

  const scrollHandler = useThrottledCallback(checkOverflowAgainstParent, 300);

  useEffect(() => {
    checkOverflowAgainstParent(); // Initial check

    window.addEventListener("resize", scrollHandler);
    return () => window.removeEventListener("resize", scrollHandler);
  }, [list, overFlowList]);

  if (!editor) {
    return null
  }

  return (
    <div className={`${styles["text-editor-menu"]} button-group margin-0`}>
      <ul
        onKeyDown={handleKeyDownMenuBar}
        ref={menubarRef}
        role='menubar'
        className='margin-0 padding-0'
      >
        {list.map((listItem) => {
          return listItem
        })}
        {/* {false &&
          (overFlowList.map((listItem) => {
            return listItem
          }))
        } */}
        {/*
        <li role='presentation' className="margin-left-25 padding-left-25" style={{borderLeft: '1px solid var(--gray)'}}>
          <span
            tabIndex={-1}
            role='menuitem'
            aria-label={t("forms:text_editor_menu.more")}
            data-tooltip={t("forms:text_editor_menu.more")}
            aria-checked="false"
            className={`${styles['menu-more']}`}
          >
            <IconDotsVertical width={16} height={16} className="grid" aria-hidden='true' />
          </span>
        </li>
         */}
      </ul>
    </div>
  )
}