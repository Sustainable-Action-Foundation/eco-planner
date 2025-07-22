'use client'

// TODO: i18n
// TODO: Tooltip

import { useCallback, useEffect, useRef, useState } from 'react'
import { IconArrowBackUp, IconArrowForwardUp, IconItalic, IconBold, IconStrikethrough, IconUnderline, IconSuperscript, IconSubscript, IconHighlight, IconLink, IconList, IconListNumbers, IconSelect, IconDotsVertical, IconChevronDown } from "@tabler/icons-react"
import { Editor } from "@tiptap/core"

export default function TextEditorMenu({
  editor
}: {
  editor: Editor
}) {

  const [fontSize, setFontSize] = useState<'12px' | '20px' | 'normal'>('normal')

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

  const containerRef = useRef<HTMLUListElement | null>(null);
  const [overflowingChildren, setOverflowingChildren] = useState<Element[]>([]);

  // Function to check which children overflow
  const checkOverflow = () => {
    const container = containerRef.current;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();

    const children = Array.from(container.children);
    const overflowing = children.filter(child => {
      const childRect = child.getBoundingClientRect();
      return childRect.bottom > containerRect.bottom;
    });

    setOverflowingChildren(overflowing);
  };

  useEffect(() => {
    checkOverflow(); // initial check

    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      checkOverflow();
    });

    resizeObserver.observe(containerRef.current);

    // Cleanup on unmount
    return () => resizeObserver.disconnect();
  }, []);

  const [showMenu, setShowMenu] = useState<boolean>(false)

  if (!editor) {
    return null
  }

  return (
    <div className="button-group margin-0" style={{ backgroundColor: 'var(--gray-95)', padding: '3px', borderRadius: '.25rem .25rem 0 0', borderBottom: '1px solid var(--gray)' }}>
      <ul
        role='menubar'
        className='margin-0 padding-0'
        ref={containerRef}
      >
        <li role='presentation'>
          <span
            tabIndex={0}
            role='menuitem'
            onClick={() => editor.chain().focus().undo().run()}
            aria-disabled={!editor.can().undo()} // TODO input_updates: implement actual functionality for this
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
        <li role='presentation' className='margin-right-25 padding-right-25' style={{borderRight: '1px solid var(--gray-80)'}}>
          <span 
            tabIndex={-1} 
            role='menuitem'
            onClick={() => editor.chain().focus().redo().run()}
            aria-disabled={!editor.can().redo()} // TODO input_updates: implement actual functionality for this
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
        <li role='presentation' className='margin-right-25 padding-right-25' style={{borderRight: '1px solid var(--gray-80)'}}>  
          <span // Font size menu (contains a vertical menu)
            tabIndex={-1}
            role='menuitem'>
              Font size
              <IconChevronDown className="inline-grid margin-left-25" width={16} height={16} aria-hidden="true" style={{verticalAlign: 'bottom'}} />
          </span>
        </li>
        <li role='presentation'>
          <span // Grey text
            tabIndex={-1}
            role='menuitem'>
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
            tabIndex={-1}
            role='menuitem'>
             <IconItalic className="grid" width={16} height={16} aria-hidden="true" />
          </span>
        </li>
        <li role='presentation'>
          <span
            tabIndex={-1}
            role='menuitem'>
              <IconBold className="grid" width={16} height={16} aria-hidden="true" />
          </span>
        </li>
        <li role='presentation'>
          <span
            tabIndex={-1}
            role='menuitem'>
              <IconStrikethrough className="grid" width={16} height={16} aria-hidden="true" />
          </span>
        </li>
        <li role='presentation'>
          <span
            tabIndex={-1}
            role='menuitem'>
              <IconUnderline className="grid" width={16} height={16} aria-hidden="true" />
          </span>
        </li>
        <li role='presentation'>
          <span
            tabIndex={-1}
            role='menuitem'>
              <IconSuperscript className="grid" width={16} height={16} aria-hidden="true" />
          </span>
        </li>
        <li role='presentation'>
          <span
            tabIndex={-1}
            role='menuitem'>
             <IconSubscript className="grid" width={16} height={16} aria-hidden="true" />
          </span>
        </li>
        <li role='presentation' className='margin-right-25 padding-right-25' style={{borderRight: '1px solid var(--gray-80)'}}>
          <span
            tabIndex={-1}
            role='menuitem'>
              <IconHighlight className="grid" width={16} height={16} aria-hidden="true" />
          </span>
        </li>
        <li role='presentation' className='margin-right-25 padding-right-25' style={{borderRight: '1px solid var(--gray-80)'}}>
          <span
            tabIndex={-1}
            role='menuitem'>
             <IconLink className="grid" width={16} height={16} aria-hidden="true" />
          </span>
        </li>
        <li role='presentation'>
          <span
            tabIndex={-1}
            role='menuitem'>
              <IconList width={16} height={16} className="grid" aria-hidden='true' />
          </span>
        </li>
        <li role='presentation'>
          <span
            tabIndex={-1}
            role='menuitem'>
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

        <div className='inline-block padding-right-25 margin-right-25' style={{ borderRight: '1px solid var(--gray-80)', marginBlock: '3px' }}>
          <button
            onClick={() => editor.chain().focus().toggleGreyText().run()}
            className={`padding-25 transparent ${editor.getAttributes('textStyle').color === 'grey' ? 'is-active' : ''}`}
            type='button'
            aria-label='grey text'
            aria-pressed={editor.getAttributes('textStyle').color === 'grey'}
          >
            <svg className='grid' aria-hidden='true' xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path stroke="none" d="M0 0h24v24H0z" fill="none" />
              <path d="M9 15v-7a3 3 0 0 1 6 0v7" />
              <path d="M9 11h6" />
              <path d="M5 21h14" color='darkgrey' strokeWidth={3} />
            </svg>
          </button>
        </div>

        <div className='inline-block padding-right-25 margin-right-25' style={{ borderRight: '1px solid var(--gray-80)', marginBlock: '3px' }}>
          <button
            className={`padding-25 transparent ${editor.getAttributes('textStyle').fontStyle === 'italic' ? 'is-active' : ''}`}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            type='button'
            aria-label="italic"
            aria-pressed={editor.getAttributes('fontStyle').fontWeight === 'italic'}
          >
            <IconItalic className="grid" width={16} height={16} aria-hidden="true" />
          </button>
          <button
            className={`padding-25 transparent ${editor.getAttributes('textStyle').fontWeight === 'bold' ? 'is-active' : ''}`}
            onClick={() => editor.chain().focus().toggleBold().run()}
            type='button'
            aria-label="bold"
            aria-pressed={editor.getAttributes('textStyle').fontWeight === 'bold'}
          >
            <IconBold className="grid" width={16} height={16} aria-hidden="true" />
          </button>
          <button
            className={`padding-25 transparent ${editor.getAttributes('textStyle').textDecoration === 'line-through' ? 'is-active' : ''}`}
            onClick={() => editor.chain().focus().toggleLineThrough().run()}
            type='button'
            aria-label="strike-trough"
            aria-pressed={editor.getAttributes('textStyle').textDecoration === 'line-through'}
          >
            <IconStrikethrough className="grid" width={16} height={16} aria-hidden="true" />
          </button>
          <button
            className={`padding-25 transparent ${editor.getAttributes('textStyle').textDecoration === 'underline' ? 'is-active' : ''}`}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            type='button'
            aria-label="underline"
            aria-pressed={editor.getAttributes('textStyle').textDecoration === 'underline'}
          >
            <IconUnderline className="grid" width={16} height={16} aria-hidden="true" />
          </button>
          <button
            className={`padding-25 transparent ${editor.isActive('superscript') ? 'is-active' : ''}`}
            onClick={() => editor.chain().focus().toggleSuperscript().run()}
            type='button'
            aria-label="superscript"
            aria-pressed={editor.isActive('superscript')}
          >
            <IconSuperscript className="grid" width={16} height={16} aria-hidden="true" />
          </button>
          <button
            className={`padding-25 transparent ${editor.isActive('subscript') ? 'is-active' : ''}`}
            onClick={() => editor.chain().focus().toggleSubscript().run()}
            type='button'
            aria-label="subscript"
            aria-pressed={editor.isActive('subscript')}
          >
            <IconSubscript className="grid" width={16} height={16} aria-hidden="true" />
          </button>
          <button
            className={`padding-25 transparent ${editor.isActive('highlight') ? 'is-active' : ''}`}
            onClick={() => editor.chain().focus().toggleHighlight().run()}
            type='button'
            aria-label="highlight"
            aria-pressed={editor.isActive('highlight')}
          >
            <IconHighlight className="grid" width={16} height={16} aria-hidden="true" />
          </button>
        </div>

        <div className='inline-block padding-right-25 margin-right-25' style={{ borderRight: '1px solid var(--gray-80)', marginBlock: '3px' }}>
          <button
            className={`padding-25 transparent ${editor.isActive('link') ? 'is-active' : ''}`}
            onClick={setLink}
            type='button'
            aria-label="link"
            aria-pressed={editor.isActive('link')}
          >
            <IconLink className="grid" width={16} height={16} aria-hidden="true" />
          </button>
        </div>

        <div className='inline-block' style={{ marginBlock: '3px' }}>
          <button
            className={`padding-25 transparent ${editor.isActive('bulletList') ? 'is-active' : ''}`}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            type='button'
            aria-label="Bullet list"
            aria-pressed={editor.isActive('bulletList')}
          >
            <IconList width={16} height={16} className="grid" aria-hidden='true' />
          </button>
          <button
            className={`padding-25 transparent ${editor.isActive('orderedList') ? 'is-active' : ''}`}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            type='button'
            aria-label="Numbered list"
            aria-pressed={editor.isActive('orderedList')}
          >
            <IconListNumbers width={16} height={16} className="grid" aria-hidden='true' />
          </button>
        </div> */}
      </ul>

      {/*
        <div className='position-relative inline-block' style={{ marginBlock: '3px', alignSelf: 'flex-start' }}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            style={{ backgroundColor: `${showMenu ? 'hsl(206, 100%, 80%, .5)' : ''}` }}
            className="padding-25 transparent"
            aria-pressed={showMenu}
            type='button'
            aria-label="Show menu"
            aria-hidden="true"  
            <IconDotsVertical width={16} height={16} className="grid" aria-hidden='true' />
          </button>
          {showMenu ?
            <div className='position-absolute flex gray-95 smooth' style={{ top: 'calc(100% + 4px + 3px)', right: '0', zIndex: '10', padding: '3px' }}>
              {overflowingChildren.map((el, i) => (
                <div
                  className='flex'
                  key={i}
                  dangerouslySetInnerHTML={{ __html: el.innerHTML || 'Unknown content' }}
                ></div>
              ))}
            </div>
            : null}
        </div>
      */}

    </div>
  )
}