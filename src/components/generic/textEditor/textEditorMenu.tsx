'use client'

// TODO: i18n
// TODO: Tooltip

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { IconArrowBackUp, IconArrowForwardUp, IconItalic, IconBold, IconStrikethrough, IconUnderline, IconSuperscript, IconSubscript, IconHighlight, IconLink, IconList, IconListNumbers, IconSelect, IconDotsVertical, IconChevronDown } from "@tabler/icons-react"
import { Editor } from "@tiptap/core"

export default function TextEditorMenu({
  editor
}: {
  editor: Editor
}) {

  const [fontSize, setFontSize] = useState<'12px' | '20px' | 'normal'>('normal')
  const [focusedMenubarItem, setFocusedMenubarItem] = useState<number | null>(null)

  const menubarRef = useRef<HTMLUListElement | null>(null)
  const menuItemsRef = useRef<NodeListOf<HTMLElement> | null>(null);

  const setLink = useCallback(() => {
    const previousUrl = editor.getAttributes('link').href
    const url = window.prompt('URL', previousUrl)

    // cancelled
    if (url === null) {
      return
    }

    // empty
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink()
        .run()

      return
    }

    // update link
    try {
      let properUrl = url.split(':').pop()
      if (!properUrl?.startsWith('//')) {
        properUrl = '//' + properUrl
      }

      editor.chain().focus().extendMarkRange('link').setLink({ href: properUrl })
        .run()
    } catch (e: any) {
      alert(e.message)
    }
  }, [editor])

  // Updates value of font size select whenever a new area of the editor is selected
  useEffect(() => {
    const updateFontSize = () => {
      const currentFontSize = editor.getAttributes('textStyle').fontSize
      if (currentFontSize === '12px') setFontSize('12px')
      else if (currentFontSize === '20px') setFontSize('20px')
      else setFontSize('normal')
    }

    updateFontSize()

    editor.on('selectionUpdate', updateFontSize)
    editor.on('transaction', updateFontSize)

    return () => {
      editor.off('selectionUpdate', updateFontSize)
      editor.off('transaction', updateFontSize)
    }
  }, [editor])

  // Changes the font size
  const changeFontSize = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value
    if (value === 'normal') {
      editor.chain().focus().unsetFontSize().run()
    } else {
      editor.chain().focus().setFontSize(e.target.value).run()
    }
  }

  useEffect(() => {
    if (menubarRef.current) {
      menuItemsRef.current = menubarRef.current.querySelectorAll(
        "li > [role='menuitem'], li > [role='menuitemcheckbox'], li > [role='menuitemradio']"
      ) as NodeListOf<HTMLElement>;;
    }
  }, []);

  useEffect(() => {
    if (!menuItemsRef.current) return

    if (focusedMenubarItem !== null) {
      const target = menuItemsRef.current[focusedMenubarItem] as HTMLElement | undefined;

      if (target) {
        target.focus();
      }
    }
  }, [focusedMenubarItem]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLUListElement>) => {
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
    
    if (e.key === 'Escape') {
      editor.commands.focus()
    }
  }

  const handleFocus = (e: React.FocusEvent) => {
    // If our menubar does not contain the element which focused moved from:
    // Set focused menubaritem to 0 
    if (!menubarRef.current?.contains(e.relatedTarget as Node)) {
      setFocusedMenubarItem(0);
    }
  };

  const handleBlur = (e: React.FocusEvent) => {
    // If our menubar does not contain the element which focus moves to:
    // Set focused menubaritem to null
    if (menubarRef.current && !menubarRef.current.contains(e.relatedTarget as HTMLElement | null)) {
      setFocusedMenubarItem(null);
    }
  };

  if (!editor) {
    return null
  }

  return (
    <div className="button-group margin-0" style={{ backgroundColor: 'var(--gray-95)', padding: '2px', borderRadius: '.25rem .25rem 0 0', borderBottom: '1px solid var(--gray)' }}>
      <ul
        onKeyDown={handleKeyDown}
        onFocus={handleFocus} // Causes buggy behavior :(
        onBlur={handleBlur}
        ref={menubarRef}
        role='menubar'
        className='margin-0 padding-0'
        style={{ lineHeight: '1' }}
      >
        <li role='presentation'>
          {/* TODO: Check the case for regular menuitems and menuradio item */}
          <span
            onClick={() => editor.chain().focus().undo().run()}
            onKeyDown={(e: React.KeyboardEvent<HTMLSpanElement>) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                editor.chain().undo().run();
              }
            }}
            tabIndex={0}
            aria-label='undo'
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
            aria-label='redo'
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
        {/* TODO: Implement font size selector */}
        <li role='presentation' className='margin-right-25 padding-right-25' style={{ borderRight: '1px solid var(--gray-80)' }}>
          <span // Font size menu (contains a vertical menu)
            tabIndex={-1}
            role='menuitem'
          >
            Font size
            <IconChevronDown className="inline-grid margin-left-25" width={16} height={16} aria-hidden="true" style={{ verticalAlign: 'top' }} />
          </span>
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
            aria-label='grey text'
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
            aria-label="italic"
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
            aria-label="bold"
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
            aria-label="strike-trough"
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
            aria-label="underline"
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
            aria-label="superscript"
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
            aria-label="subscript"
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
            aria-label="highlight"
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
            aria-label="link"
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
            aria-label="Bullet list"
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
            aria-label="Numbered list"
            aria-checked={editor.isActive('orderedList')}
          >
            <IconListNumbers width={16} height={16} className="grid" aria-hidden='true' />
          </span>
        </li>

        {/*
        <div className='inline-block padding-right-25 margin-right-25' style={{ borderRight: '1px solid var(--gray-80)', marginBlock: '3px' }}>
          <button
            className='padding-25 transparent'
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            type='button'
            aria-label='Undo'
          >
            <IconArrowBackUp color={`${editor.can().undo() ? 'black' : 'gray'}`} className="grid" width={16} height={16} aria-hidden="true" />
          </button>
          <button
            className='padding-25 transparent'
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            type='button'
            aria-label='Redo'
          >
            <IconArrowForwardUp color={`${editor.can().redo() ? 'black' : 'gray'}`} className="grid" width={16} height={16} aria-hidden="true" />
          </button>
        </div>

        <div className='inline-block padding-right-25 margin-right-25' style={{ borderRight: '1px solid var(--gray-80)', verticalAlign: 'top', lineHeight: '1', marginBlock: '3px' }}>
          <select aria-label='font size' onChange={changeFontSize} value={fontSize} className='transparent' style={{ fontSize: '12px', border: '0', outline: '0', '--icon-size': '16px', '--padding': '.25rem' } as React.CSSProperties}>
            <option value="20px">Stor text</option>
            <option value="normal">Normal text</option>
            <option value="12px">Liten text</option>
          </select>
        </div>

        */}
      </ul>
    </div>
  )
}