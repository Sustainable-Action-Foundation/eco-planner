'use client';

// TODO: i18n 

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { IconArrowBackUp, IconArrowForwardUp, IconItalic, IconBold, IconStrikethrough, IconUnderline, IconSuperscript, IconSubscript, IconHighlight, IconLink, IconList, IconListNumbers, IconChevronDown } from "@tabler/icons-react";
import { Editor } from "@tiptap/core";
import { allowedProtocols } from './textEditor';
import styles from './textEditor.module.css' with { type: "css" }

export default function TextEditorMenu({
  editor
}: {
  editor: Editor
}) {

  const [focusedMenubarItem, setFocusedMenubarItem] = useState<number | null>(null);
  const [fontSizeMenuOpen, setFontSizeMenuOpen] = useState<boolean>(false);
  const [focusedFontSizeMenuItem, setFocusedFontSizeMenuItem] = useState<number | null>(null);

  const menubarRef = useRef<HTMLUListElement | null>(null);
  const menuItemsRef = useRef<NodeListOf<HTMLElement> | null>(null);

  const fontSizeMenuButtonRef = useRef<HTMLSpanElement>(null);
  const fontSizeMenuRef = useRef<HTMLUListElement | null>(null);
  const fontSizeMenuItemsRef = useRef<NodeListOf<HTMLElement> | null>(null);

  const setLink = useCallback(() => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL', previousUrl);

    // cancelled
    if (url === null) {
      return;
    }

    // empty
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink()
        .run();

      return;
    }

    // update link
    let parsedUrl: URL | null = URL.parse(url);
    // If parsing fails, try to prepend the default protocol
    if (!parsedUrl) {
      parsedUrl = URL.parse(`https://${url}`);
    }
    // If parsing still fails, return
    if (!parsedUrl) {
      // TODO: i18n
      alert('Failed to parse URL.');
      return;
    }

    if (!allowedProtocols.includes(parsedUrl.protocol.replace(':', ''))) {
      // TODO: i18n
      alert(`Protocol "${parsedUrl.protocol.replace(':', '')}" is not allowed. Allowed protocols are: ${allowedProtocols.join(', ')}`);
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: parsedUrl.href })
      .run();
  }, [editor])

  useEffect(() => {
    if (menubarRef.current) {
      menuItemsRef.current = menubarRef.current.querySelectorAll(
        "[role='menubar'] > li > [role='menuitem'], [role='menubar'] > li > [role='menuitemcheckbox'], [role='menubar'] > li > [role='menuitemradio']"
      ) as NodeListOf<HTMLElement>;
    }

    if (fontSizeMenuRef.current) {
      fontSizeMenuItemsRef.current = fontSizeMenuRef.current.querySelectorAll(
        "li > [role='menuitem'], li > [role='menuitemcheckbox'], li > [role='menuitemradio']"
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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        !(event.target instanceof Node) || 
        (fontSizeMenuRef.current && !fontSizeMenuRef.current.contains(event.target)) &&
        (fontSizeMenuButtonRef.current && !fontSizeMenuButtonRef.current.contains(event.target))
      ) {
        setFontSizeMenuOpen(false);
        editor.commands.focus() // TODO: Shold this be editor.chain().focus()?
      }
    };

    if (fontSizeMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [fontSizeMenuOpen, editor]);

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
      setFontSizeMenuOpen(false);
      setFocusedFontSizeMenuItem(null);
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
    if (!fontSizeMenuItemsRef.current) return;

    if (focusedFontSizeMenuItem !== null) {
      const target = fontSizeMenuItemsRef.current[focusedFontSizeMenuItem] as HTMLElement | undefined;

      if (target) {
        target.focus();
      }
    }
  }, [focusedFontSizeMenuItem]);

  const handleKeyDownFontSizeMenu = (e: React.KeyboardEvent<HTMLSpanElement>) => {
    if (!fontSizeMenuItemsRef.current) return;

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!fontSizeMenuOpen) {
        setFontSizeMenuOpen(true);
        setFocusedFontSizeMenuItem(0);
      } else {
        setFontSizeMenuOpen(false);
        setFocusedFontSizeMenuItem(null);
      }
    }

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()

      if (!fontSizeMenuOpen) {
        setFontSizeMenuOpen(true)
      }

      setFocusedFontSizeMenuItem(0)
    }

    if (e.key == 'Escape') {
      e.preventDefault()

      if (fontSizeMenuOpen) {
        e.stopPropagation();
        fontSizeMenuButtonRef.current?.focus();
        setFontSizeMenuOpen(false)
        setFocusedFontSizeMenuItem(null)
      }
    }

    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      setFontSizeMenuOpen(false)
      setFocusedFontSizeMenuItem(null)
    }
  }

  const handleKeyDownFontSizeMenuItem = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!fontSizeMenuItemsRef.current) return;

    if (e.key === 'ArrowDown') {
      if (fontSizeMenuOpen && focusedFontSizeMenuItem != null) {
        e.preventDefault()

        if (focusedFontSizeMenuItem != fontSizeMenuItemsRef.current.length - 1) {
          setFocusedFontSizeMenuItem(focusedFontSizeMenuItem + 1)
        } else {
          setFocusedFontSizeMenuItem(0)
        }
      }
    }

    if (e.key === 'ArrowUp') {
      if (fontSizeMenuOpen && focusedFontSizeMenuItem != null) {
        e.preventDefault()

        if (focusedFontSizeMenuItem != 0) {
          setFocusedFontSizeMenuItem(focusedFontSizeMenuItem - 1)
        } else {
          setFocusedFontSizeMenuItem(fontSizeMenuItemsRef.current.length - 1)
        }
      }
    }

    if (e.key == 'Escape') { 
      e.preventDefault()
      console.log(fontSizeMenuRef.current)
      if (fontSizeMenuOpen) {
        e.stopPropagation();
        fontSizeMenuButtonRef.current?.focus();
        setFontSizeMenuOpen(false)
        setFocusedFontSizeMenuItem(null)
      }
    }

    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'Tab' || e.key === 'End' || e.key === 'Home') {
      setFontSizeMenuOpen(false)
      setFocusedFontSizeMenuItem(null)
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (focusedFontSizeMenuItem != null) {
        const itemEl = fontSizeMenuItemsRef.current[focusedFontSizeMenuItem];
        const selectedSize = itemEl?.getAttribute('data-size');
        if (selectedSize === 'unset') {
          editor.chain().focus().unsetFontSize().run();
        } else if (selectedSize) {
          editor.chain().focus().setFontSize(selectedSize).run();
        }
        setFontSizeMenuOpen(false);
        setFocusedFontSizeMenuItem(null);
        setFocusedMenubarItem(null);
      }
    }

    if (e.key === ' ') {
      e.preventDefault();
      if (focusedFontSizeMenuItem != null) {
        const itemEl = fontSizeMenuItemsRef.current[focusedFontSizeMenuItem];
        const selectedSize = itemEl?.getAttribute('data-size');
        if (selectedSize === 'unset') {
          editor.chain().unsetFontSize().run();
        } else if (selectedSize) {
          editor.chain().setFontSize(selectedSize).run();
        }
      }
    }
  }

  if (!editor) {
    return null
  }

  return (
    <div className={`${styles["text-editor-menu"]} button-group margin-0`}style={{ backgroundColor: 'var(--gray-95)', padding: '2px', borderRadius: '.25rem .25rem 0 0', borderBottom: '1px solid var(--gray)' }}>
      <ul
        onKeyDown={handleKeyDownMenuBar}
        ref={menubarRef}
        role='menubar'
        className='margin-0 padding-0'
        style={{ lineHeight: '1' }}
      >
        <li role='presentation'>
          <span
            onClick={() => editor.chain().focus().undo().run()}
            onKeyDown={(e: React.KeyboardEvent<HTMLSpanElement>) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                editor.chain().undo().run();
              }
            }}
            tabIndex={0}
            aria-label='ångra'
            aria-keyshortcuts='control+z'
            role='menuitem'
            aria-disabled={!editor.can().undo()}
          >
            <IconArrowBackUp
              color={`${editor.can().undo() ? 'black' : 'gray'}`}
              className="grid"
              width={16}
              height={16}
              aria-hidden="true"
            />
          </span>
        </li>
        <li role='presentation' className='margin-right-25 padding-right-25' style={{ borderRight: '1px solid var(--gray-80)' }}>
          <span
            onClick={() => editor.chain().focus().redo().run()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                editor.chain().redo().run();
              }
            }}
            tabIndex={-1}
            aria-label='gör om'
            aria-keyshortcuts='control+shift+z'
            role='menuitem'
            aria-disabled={!editor.can().redo()}
          >
            <IconArrowForwardUp
              color={`${editor.can().redo() ? 'black' : 'gray'}`}
              className="grid"
              width={16}
              height={16}
              aria-hidden="true"
            />
          </span>
        </li>
        <li role='presentation' className='margin-right-25 padding-right-25' style={{ borderRight: '1px solid var(--gray-80)', position: 'relative', userSelect: 'none' }}>
          <span
            onClick={() => setFontSizeMenuOpen(!fontSizeMenuOpen)}
            onKeyDown={handleKeyDownFontSizeMenu}
            ref={fontSizeMenuButtonRef}
            tabIndex={-1}
            role='menuitem'
            aria-haspopup='menu'
            aria-expanded={fontSizeMenuOpen}
            aria-label='Textstorlek'
            style={{ width: '100px', display: 'flex' }}
            className='align-items-center justify-content-space-between'
          >
            {!editor.getAttributes('textStyle').fontSize ?
              'Normal text'
              : editor.getAttributes('textStyle').fontSize == '1.25rem' ?
                'Stor text'
                : editor.getAttributes('textStyle').fontSize == '0.75rem' ?
                  'Liten text'
                  : ''
            }
            <IconChevronDown width={16} height={16} aria-hidden="true" />
          </span>
          <ul
            // TODO: See if we need to set aria-owns here somewhere
            ref={fontSizeMenuRef}
            aria-label='Font size'
            role='menu'
            className={`
              ${styles["animated-menu"]} 
              ${fontSizeMenuOpen ? styles['visible'] : ''} 
              margin-0 padding-0 gray-95 smooth`
            }
          >
            <li role='presentation' style={{ borderBottom: '1px solid var(--gray)', paddingBottom: '2px' }}>
              <div
                onClick={() => { editor.chain().focus().setFontSize('1.25rem').run(), setFontSizeMenuOpen(false) }}
                onKeyDown={handleKeyDownFontSizeMenuItem}
                data-size="1.25rem"
                className='smooth padding-50 font-size-smaller'
                style={{ whiteSpace: 'nowrap' }}
                role='menuitemradio'
                aria-checked={editor.getAttributes('textStyle').fontSize === '1.25rem'}
                tabIndex={-1}>
                Stor text
              </div>
            </li>
            <li role='presentation' style={{ borderBottom: '1px solid var(--gray)', paddingBlock: '2px' }}>
              <div
                onClick={() => { editor.chain().focus().unsetFontSize().run(), setFontSizeMenuOpen(false) }}
                onKeyDown={handleKeyDownFontSizeMenuItem}
                data-size="unset"
                className='smooth padding-50 font-size-smaller'
                style={{ whiteSpace: 'nowrap' }}
                role='menuitemradio'
                aria-checked={!editor.getAttributes('textStyle').fontSize}
                tabIndex={-1}
              >
                Normal text
              </div>
            </li>
            <li role='presentation' style={{ paddingTop: '2px' }}>
              <div
                onClick={() => { editor.chain().focus().setFontSize('0.75rem').run(), setFontSizeMenuOpen(false) }}
                onKeyDown={handleKeyDownFontSizeMenuItem}
                data-size="0.75rem"
                className='smooth padding-50 font-size-smaller'
                style={{ whiteSpace: 'nowrap' }}
                role='menuitemradio'
                aria-checked={editor.getAttributes('textStyle').fontSize === '0.75rem'}
                tabIndex={-1}
              >
                Liten text
              </div>
            </li>
          </ul>
        </li>
        <li role='presentation'>
          <span
            onClick={() => editor.chain().focus().toggleGreyText().run()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                editor.chain().toggleGreyText().run();
              }
            }}
            tabIndex={-1}
            aria-label='Grå text'
            role='menuitemcheckbox'
            aria-checked={editor.getAttributes('textStyle').color === 'grey'}
          >
            <svg className='grid' aria-hidden='true' xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path stroke="none" d="M0 0h24v24H0z" fill="none" />
              <path d="M9 15v-7a3 3 0 0 1 6 0v7" />
              <path d="M9 11h6" />
              <path d="M5 21h14" color='darkgrey' strokeWidth={3} />
            </svg>
          </span>
        </li>
        <li role='presentation'>
          <span
            onClick={() => editor.chain().focus().toggleItalic().run()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                editor.chain().toggleItalic().run();
              }
            }}
            tabIndex={-1}
            role='menuitemcheckbox'
            aria-label="kursiv"
            aria-keyshortcuts='control+i'
            aria-checked={editor.getAttributes('textStyle').fontStyle === 'italic'}
          >
            <IconItalic className="grid" width={16} height={16} aria-hidden="true" />
          </span>
        </li>
        <li role='presentation'>
          <span
            onClick={() => editor.chain().focus().toggleBold().run()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                editor.chain().toggleBold().run();
              }
            }}
            tabIndex={-1}
            role='menuitemcheckbox'
            aria-label="fetstil"
            aria-keyshortcuts='control+b'
            aria-checked={editor.getAttributes('textStyle').fontWeight === 'bold'}
          >
            <IconBold className="grid" width={16} height={16} aria-hidden="true" />
          </span>
        </li>
        <li role='presentation'>
          <span
            onClick={() => editor.chain().focus().toggleLineThrough().run()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                editor.chain().toggleLineThrough().run();
              }
            }}
            tabIndex={-1}
            role='menuitemcheckbox'
            aria-keyshortcuts='control+shift+s'
            aria-label="genomstryk"
            aria-checked={editor.getAttributes('textStyle').textDecoration === 'line-through'}
          >
            <IconStrikethrough className="grid" width={16} height={16} aria-hidden="true" />
          </span>
        </li>
        <li role='presentation'>
          <span
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                editor.chain().toggleUnderline().run();
              }
            }}
            tabIndex={-1}
            role='menuitemcheckbox'
            aria-keyshortcuts='control+u'
            aria-label="understryk"
            aria-checked={editor.getAttributes('textStyle').textDecoration === 'underline'}
          >
            <IconUnderline className="grid" width={16} height={16} aria-hidden="true" />
          </span>
        </li>
        <li role='presentation'>
          <span
            onClick={() => editor.chain().focus().toggleSuperscript().run()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                editor.chain().toggleSuperscript().run();
              }
            }}
            tabIndex={-1}
            role='menuitemcheckbox'
            aria-keyshortcuts='control+.'
            aria-label="upphöj"
            aria-checked={editor.isActive('superscript')}
          >
            <IconSuperscript className="grid" width={16} height={16} aria-hidden="true" />
          </span>
        </li>
        <li role='presentation'>
          <span
            onClick={() => editor.chain().focus().toggleSubscript().run()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                editor.chain().toggleSubscript().run();
              }
            }}
            tabIndex={-1}
            role='menuitemcheckbox'
            aria-label="nedsänk"
            aria-keyshortcuts='control+,'
            aria-checked={editor.isActive('subscript')}
          >
            <IconSubscript className="grid" width={16} height={16} aria-hidden="true" />
          </span>
        </li>
        <li role='presentation' className='margin-right-25 padding-right-25' style={{ borderRight: '1px solid var(--gray-80)' }}>
          <span
            onClick={() => editor.chain().focus().toggleHighlight().run()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                editor.chain().toggleHighlight().run();
              }
            }}
            tabIndex={-1}
            role='menuitemcheckbox'
            aria-label="markera"
            aria-keyshortcuts='control+shift+h'
            aria-checked={editor.isActive('highlight')}
          >
            <IconHighlight className="grid" width={16} height={16} aria-hidden="true" />
          </span>
        </li>
        <li role='presentation' className='margin-right-25 padding-right-25' style={{ borderRight: '1px solid var(--gray-80)' }}>
          <span
            onClick={setLink}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setLink();
              }
            }}
            tabIndex={-1}
            role='menuitemcheckbox'
            aria-label="infoga länk"
            aria-checked={editor.isActive('link')}
          >
            <IconLink className="grid" width={16} height={16} aria-hidden="true" />
          </span>
        </li>
        <li role='presentation'>
          <span
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                editor.chain().toggleBulletList().run();
              }
            }}
            tabIndex={-1}
            role='menuitemcheckbox'
            aria-label="punktlista"
            aria-keyshortcuts='control+shift+8'
            aria-checked={editor.isActive('bulletList')}
          >
            <IconList width={16} height={16} className="grid" aria-hidden='true' />
          </span>
        </li>
        <li role='presentation'>
          <span
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                editor.chain().toggleOrderedList().run();
              }
            }}
            tabIndex={-1}
            role='menuitemcheckbox'
            aria-label="numrerad lista"
            aria-keyshortcuts='control+shift+7'
            aria-checked={editor.isActive('orderedList')}
          >
            <IconListNumbers width={16} height={16} className="grid" aria-hidden='true' />
          </span>
        </li>
      </ul>
    </div>
  )
}