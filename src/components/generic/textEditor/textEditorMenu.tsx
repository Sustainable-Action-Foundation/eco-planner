'use client';

import { useTranslation } from "react-i18next";
import React, { useEffect, useRef, useState } from 'react';
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

  useEffect(() => {
    const checkOverflowAgainstParent = () => {
      const ul = menubarRef.current;
      const parent = ul?.parentElement;

      if (ul && parent && menuItemsRef.current) {
        const items = Array.from(menuItemsRef.current); // Convert NodeList to array
        const parentWidth = parent.getBoundingClientRect().width - 4; // No clue why i need - 4 lowkey

        // Step 1: Reset all items (in case we’re resizing wider)
        items.forEach((item) => {
          item.style.display = "";
        });

        // Step 2: Check for overflow and hide items from the end
        while (ul.scrollWidth >= parentWidth - 1 && items.length > 1) {
          const visibleItems = items.filter((item) => item.style.display !== "none");
          if (visibleItems.length > 1) {
            const secondLastVisible = visibleItems[visibleItems.length - 2];
            secondLastVisible.style.display = "none";
          } else {
            break; // all are hidden
          }
        }
      }
    };

    checkOverflowAgainstParent(); // Initial check

    window.addEventListener("resize", checkOverflowAgainstParent);
    return () => window.removeEventListener("resize", checkOverflowAgainstParent);
  }, []);


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
        <li role='presentation'>
          <Undo editor={editor} t={t} />
        </li>
        <li role='presentation' className='margin-right-25 padding-right-25' style={{ borderRight: '1px solid var(--gray-80)' }}>
          <Redo editor={editor} t={t} />
        </li>
        <li role='presentation' className='margin-right-25 padding-right-25 position-relative' style={{ borderRight: '1px solid var(--gray-80)'}}>
          <FontSize editor={editor} t={t} editorId={editorId} setFocusedMenubarItem={setFocusedMenubarItem} />
        </li>
        <li role='presentation'>
          <GreyText editor={editor} t={t} />
        </li>
        <li role='presentation'>
          <Italic editor={editor} t={t} />
        </li>
        <li role='presentation'>
          <Bold editor={editor} t={t} />
        </li>
        <li role='presentation'>
          <StrikeThrough editor={editor} t={t} />
        </li>
        <li role='presentation'>
          <Underline editor={editor} t={t} />
        </li>
        <li role='presentation'>
          <Superscript editor={editor} t={t} />
        </li>
        <li role='presentation'>
          <Subscript editor={editor} t={t} />
        </li>
        <li role='presentation' className='margin-right-25 padding-right-25' style={{ borderRight: '1px solid var(--gray-80)' }}>
          <Highlight editor={editor} t={t} />
        </li>
        <li role='presentation' className='margin-right-25 padding-right-25' style={{ borderRight: '1px solid var(--gray-80)' }}>
          <Link editor={editor} t={t} />
        </li>
        <li role='presentation'>
          <BulletList editor={editor} t={t} />
        </li>
        <li role='presentation'>
          <NumberedList editor={editor} t={t} />
        </li>
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