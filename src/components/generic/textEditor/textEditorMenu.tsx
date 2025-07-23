'use client'

// TODO: i18n
// TODO: Tooltip

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { IconArrowBackUp, IconArrowForwardUp, IconItalic, IconBold, IconStrikethrough, IconUnderline, IconSuperscript, IconSubscript, IconHighlight, IconLink, IconList, IconListNumbers, IconChevronDown } from "@tabler/icons-react"
import { Editor } from "@tiptap/core"

export default function TextEditorMenu({
  editor
}: {
  editor: Editor
}) {

  const [focusedMenubarItem, setFocusedMenubarItem] = useState<number | null>(null)
  const [fontSizeMenuOpen, setFontSizeMenuOpen] = useState<boolean>(false)

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

  if (!editor) {
    return null
  }

  return (
    <div className="button-group margin-0" style={{ backgroundColor: 'var(--gray-95)', padding: '2px', borderRadius: '.25rem .25rem 0 0', borderBottom: '1px solid var(--gray)' }}>
      <ul
        onKeyDown={handleKeyDown}
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
        <li role='presentation' className='margin-right-25 padding-right-25' style={{ borderRight: '1px solid var(--gray-80)', position: 'relative', userSelect: 'none'}}>
          <span 
            onClick={() => setFontSizeMenuOpen(!fontSizeMenuOpen)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setFontSizeMenuOpen(!fontSizeMenuOpen);
              }
              if (e.key == 'Escape') {
                e.preventDefault()
                if (fontSizeMenuOpen) {
                  setFontSizeMenuOpen(false)
                }
              }
            }}
            tabIndex={-1}
            role='menuitem'
            aria-haspopup='menu'
            aria-expanded={fontSizeMenuOpen}
            aria-label='Textstorlek'
            style={{width: '100px', display: 'flex'}}
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
            /* 
              TODO: Keyboard controls for this menu:
              Enter -> If not checked, checks item and closes menu
              Space -> If not checked, checks item
              Escape -> Closes menu, moves focus to element which controls it
              Left arrow -> Closes menu, moves focus to previous element in menubar
              Right arrow -> Closes menu, moves focus to next element in menubar
              Down arrow -> Open menu and move focus to first element, if menu is open move focus down
              Up arrow -> Open menu and move focus to (last or first?) element, if menu is open move focus down
              Home -> Moves focus to first element
              End -> Moves focus to last element
            */
            aria-label='Font size'
            role='menu' 
            className='margin-0 padding-0 gray-95 smooth' 
            style={{padding: '2px', position: 'absolute', minWidth: '100%', top: 'calc(100% + 5px)', left: '0', zIndex: '1', listStyle: 'none', display: `${fontSizeMenuOpen ? 'block' : 'none'}`}}>
            <li role='presentation' style={{borderBottom: '1px solid var(--gray)', paddingBottom: '2px'}}>
              <div 
              /* 
                TODO: Keyboard controls for theese menuitems:
                Enter -> If not checked, checks item and closes menu
                Space -> If not checked, checks item
                Escape -> Closes menu, moves focus to element which controls it
                Left arrow -> Closes menu, moves focus to previous element in menubar
                Right arrow -> Closes menu, moves focus to next element in menubar
                Home -> Moves focus to first element
                End -> Moves focus to last element
              */
                onClick={() => editor.chain().focus().setFontSize('1.25rem').run()}
                className='smooth padding-50 font-size-smaller' 
                style={{whiteSpace: 'nowrap'}} 
                role='menuitemradio' 
                aria-checked={editor.getAttributes('textStyle').fontSize === '1.25rem'} 
                tabIndex={-1}>
                  Stor text
                </div>              
            </li>
            <li role='presentation' style={{borderBottom: '1px solid var(--gray)', paddingBlock: '2px'}}>
              <div 
                onClick={() => editor.chain().focus().unsetFontSize().run()}
                className='smooth padding-50 font-size-smaller' 
                style={{whiteSpace: 'nowrap'}} 
                role='menuitemradio' 
                aria-checked={!editor.getAttributes('textStyle').fontSize}
                tabIndex={-1}
              >
                  Normal text
              </div>
            </li>
            <li role='presentation' style={{paddingTop: '2px'}}>
              <div 
                onClick={() => editor.chain().focus().setFontSize('0.75rem').run()}
                className='smooth padding-50 font-size-smaller' 
                style={{whiteSpace: 'nowrap'}} 
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
      </ul>
    </div>
  )
}