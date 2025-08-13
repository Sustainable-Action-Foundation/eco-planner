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

  const list =[
    <li role='presentation' key="undo">
      <Undo editor={editor} t={t} />
    </li>,
    <li role='presentation' className={`margin-right-25 padding-right-25 ${styles['divider']}`} key="redo">
      <Redo editor={editor} t={t} />
    </li>,
    <li role='presentation' className={`margin-right-25 padding-right-25 position-relative ${styles['divider']}`} key="font-size">
      <FontSize editor={editor} t={t} editorId={editorId} setFocusedMenubarItem={setFocusedMenubarItem} /> {/* TODO: This is bugged now */}
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
    <li role='presentation' className={`margin-right-25 padding-right-25 ${styles['divider']}`} key="highlight">
      <Highlight editor={editor} t={t} />
    </li>,
    <li role='presentation' className={`margin-right-25 padding-right-25 ${styles['divider']}`} key="link">
      <Link editor={editor} t={t} />
    </li>,
    <li role='presentation' key="bulletlist">
      <BulletList editor={editor} t={t} />
    </li>,
    <li role='presentation' key="numberedlist">
      <NumberedList editor={editor} t={t} />
    </li>
  ]  

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

 
      </ul>
    </div>
  )
}