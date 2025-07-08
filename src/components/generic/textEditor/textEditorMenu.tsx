'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { IconArrowBackUp, IconArrowForwardUp, IconItalic, IconBold, IconStrikethrough, IconUnderline, IconSuperscript, IconSubscript, IconHighlight, IconLink, IconList, IconListNumbers, IconSelect, IconDotsVertical } from "@tabler/icons-react"
import { Editor } from "@tiptap/core"

export default function TextEditorMenu({
  editor
}: {
  editor: Editor
}) {

  if (!editor) {
    return null
  }

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

  const containerRef = useRef<HTMLDivElement | null>(null);
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


  console.log(overflowingChildren)

  return (
    <div className="button-group margin-0 flex" style={{ backgroundColor: 'var(--gray-95)', paddingInline: '3px', borderRadius: '.25rem .25rem 0 0', borderBottom: '1px solid var(--gray)' }}>
      <div ref={containerRef} style={{ overflow: 'hidden', height: '30px' }}>
        <div className='inline-block padding-right-25 margin-right-25' style={{ borderRight: '1px solid var(--gray-80)', marginBlock: '3px' }}>
          <button className='padding-25 transparent' onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} aria-label='Undo'>
            <IconArrowBackUp color="black" className="grid" width={16} height={16} aria-hidden="true" />
          </button>
          <button className='padding-25 transparent' onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} aria-label='Redo'>
            <IconArrowForwardUp color="black" className="grid" width={16} height={16} aria-hidden="true" />
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
            aria-label="italic"
            aria-pressed={editor.getAttributes('fontStyle').fontWeight === 'italic'}
          >
            <IconItalic className="grid" width={16} height={16} aria-hidden="true" />
          </button>
          <button
            className={`padding-25 transparent ${editor.getAttributes('textStyle').fontWeight === 'bold' ? 'is-active' : ''}`}
            onClick={() => editor.chain().focus().toggleBold().run()}
            aria-label="bold"
            aria-pressed={editor.getAttributes('textStyle').fontWeight === 'bold'}
          >
            <IconBold className="grid" width={16} height={16} aria-hidden="true" />
          </button>
          <button
            className={`padding-25 transparent ${editor.getAttributes('textStyle').textDecoration === 'line-through' ? 'is-active' : ''}`}
            onClick={() => editor.chain().focus().toggleLineThrough().run()}
            aria-label="strike-trough"
            aria-pressed={editor.getAttributes('textStyle').textDecoration === 'line-through'}
          >
            <IconStrikethrough className="grid" width={16} height={16} aria-hidden="true" />
          </button>
          <button
            className={`padding-25 transparent ${editor.getAttributes('textStyle').textDecoration === 'underline' ? 'is-active' : ''}`}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            aria-label="underline"
            aria-pressed={editor.getAttributes('textStyle').textDecoration === 'underline'}
          >
            <IconUnderline className="grid" width={16} height={16} aria-hidden="true" />
          </button>
          <button
            className={`padding-25 transparent ${editor.isActive('superscript') ? 'is-active' : ''}`}
            onClick={() => editor.chain().focus().toggleSuperscript().run()}
            aria-label="superscript"
            aria-pressed={editor.isActive('superscript')}
          >
            <IconSuperscript className="grid" width={16} height={16} aria-hidden="true" />
          </button>
          <button
            className={`padding-25 transparent ${editor.isActive('subscript') ? 'is-active' : ''}`}
            onClick={() => editor.chain().focus().toggleSubscript().run()}
            aria-label="subscript"
            aria-pressed={editor.isActive('subscript')}
          >
            <IconSubscript className="grid" width={16} height={16} aria-hidden="true" />
          </button>
          <button
            className={`padding-25 transparent ${editor.isActive('highlight') ? 'is-active' : ''}`}
            onClick={() => editor.chain().focus().toggleHighlight().run()}
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
            aria-label="Bullet list"
            aria-pressed={editor.isActive('bulletList')}
          >
            <IconList width={16} height={16} className="grid" aria-hidden='true' />
          </button>
          <button
            className={`padding-25 transparent ${editor.isActive('orderedList') ? 'is-active' : ''}`}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            aria-label="Numbered list"
            aria-pressed={editor.isActive('orderedList')}
          >
            <IconListNumbers width={16} height={16} className="grid" aria-hidden='true' />
          </button>
          <button
            className="padding-25 transparent"
            onClick={() => editor.chain().focus().setDetails().run()}
            disabled={!editor.can().setDetails()}
            aria-label="add details"
          >
            <IconSelect width={16} height={16} className="grid" aria-hidden='true' />
          </button>
        </div>
      </div>

      {overflowingChildren.length > 0 && (
        <button
          style={{ marginBlock: '3px', alignSelf: 'flex-start' }}
          className="padding-25 transparent position-relative inline-block"
          aria-label="open menu"
          aria-hidden="true"
        >
          <IconDotsVertical width={16} height={16} className="grid" aria-hidden='true' />
          <div className='position-absolute flex' style={{ right: '0', top: 'calc(100% + 4px)', zIndex: '10' }}>
            {overflowingChildren.map((el, i) => (
              <div
                key={i}
                // Render actual HTML inside the li
                dangerouslySetInnerHTML={{ __html: el.innerHTML || 'Unknown content' }}
              ></div>
            ))}
          </div>
        </button>
      )}

    </div>
  )
}