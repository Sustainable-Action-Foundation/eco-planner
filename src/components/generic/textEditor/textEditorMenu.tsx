'use client'

import { IconArrowBackUp, IconArrowForwardUp, IconTextColor, IconItalic, IconBold, IconStrikethrough, IconUnderline, IconSuperscript, IconSubscript, IconHighlight, IconLink, IconList, IconListNumbers, IconSelect } from "@tabler/icons-react"
import { Editor } from "@tiptap/core"

export default function TextEditorMenu({
  editor
}: {
  editor: Editor
}) {
  return (
    <div className="control-group">
      <div className="button-group flex align-items-center" style={{ backgroundColor: 'var(--gray-95)', padding: '3px', borderRadius: '.25rem .25rem 0 0', borderBottom: '1px solid var(--gray)' }}>
        <div className='inline-flex align-items-center gap-25 padding-right-50 margin-right-50' style={{ borderRight: '1px solid var(--gray-80)' }}>
          <button className='padding-25 transparent' onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} aria-label='Undo'>
            <IconArrowBackUp color="black" className="grid" width={16} height={16} aria-hidden="true" />
          </button>
          <button className='padding-25 transparent' onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} aria-label='Redo'>
            <IconArrowForwardUp color="black" className="grid" width={16} height={16} aria-hidden="true" />
          </button>
        </div>
        <div className='inline-flex align-items-center gap-25 padding-right-50 margin-right-50' style={{ borderRight: '1px solid var(--gray-80)' }}>
          <select defaultValue="default" className='transparent' style={{ fontSize: '12px', border: '0', outline: '0', '--icon-size': '16px', '--padding': '.25rem' } as React.CSSProperties}>
            <option value="smaller">Liten text</option>
            <option value="default">Normal text</option>
            <option value="larger">Rubrik</option>
          </select>
        </div>
        <div className='inline-flex align-items-center gap-25 padding-right-50 margin-right-50' style={{ borderRight: '1px solid var(--gray-80)' }}>
          <button
            onClick={() => editor.chain().focus().setColor('black').run()}
            data-testid="setBlack"
            className='padding-25 transparent'
            aria-label=''
          >
            <IconTextColor color="black" className="grid" width={16} height={16} aria-hidden="true" />
          </button>
          <button
            onClick={() => editor.chain().focus().setColor('gray').run()}
            data-testid="setGray"
            className='padding-25 transparent'
          >
            <IconTextColor color="gray" className="grid" width={16} height={16} aria-hidden="true" />
          </button>
        </div>
        <div className='inline-flex align-items-center gap-25 padding-right-50 margin-right-50' style={{ borderRight: '1px solid var(--gray-80)' }}>
          <button className={`padding-25 transparent ${editor.getAttributes('textStyle').fontStyle === 'italic' ? 'is-active' : ''}`} onClick={() => editor.chain().focus().toggleItalic().run()} aria-label="toggle italic">
            <IconItalic className="grid" width={16} height={16} aria-hidden="true" />
          </button>
          <button className={`padding-25 transparent ${editor.getAttributes('textStyle').fontWeight === 'bold' ? 'is-active' : ''}`} onClick={() => editor.chain().focus().toggleBold().run()} aria-label="toggle bold" >
            <IconBold className="grid" width={16} height={16} aria-hidden="true" />
          </button>
          <button className={`padding-25 transparent ${editor.getAttributes('textStyle').textDecoration === 'line-through' ? 'is-active' : ''}`} onClick={() => editor.chain().focus().toggleLineThrough().run()} aria-label="toggle strike-trough">
            <IconStrikethrough className="grid" width={16} height={16} aria-hidden="true" />
          </button>
          <button className={`padding-25 transparent ${editor.getAttributes('textStyle').textDecoration === 'underline' ? 'is-active' : ''}`} onClick={() => editor.chain().focus().toggleUnderline().run()} aria-label="toggle underline">
            <IconUnderline className="grid" width={16} height={16} aria-hidden="true" />
          </button>
          <button className={`padding-25 transparent ${editor.isActive('superscript') ? 'is-active' : ''}`} onClick={() => editor.chain().focus().toggleSuperscript().run()} aria-label="toggle superscript">
            <IconSuperscript className="grid" width={16} height={16} aria-hidden="true" />
          </button>
          <button className={`padding-25 transparent ${editor.isActive('subscript') ? 'is-active' : ''}`} onClick={() => editor.chain().focus().toggleSubscript().run()} aria-label="toggle subscript">
            <IconSubscript className="grid" width={16} height={16} aria-hidden="true" />
          </button>
          <button className={`padding-25 transparent ${editor.isActive('highlight') ? 'is-active' : ''}`} onClick={() => editor.chain().focus().toggleHighlight().run()} aria-label="toggle highlight">
            <IconHighlight className="grid" width={16} height={16} aria-hidden="true" />
          </button>
        </div>
        {/*
          <div className='inline-flex align-items-center gap-25 padding-right-50 margin-right-50' style={{ borderRight: '1px solid var(--gray-80)' }}>
            <button className={`padding-25 transparent ${editor.isActive('link') ? 'is-active' : ''}`} onClick={setLink} aria-label="set link">
              <IconLink className="grid" width={16} height={16} aria-hidden="true" />
            </button>
          </div>
        */}
        <div className='inline-flex align-items-center gap-25 padding-right-50 margin-right-50'>
          <button className={`padding-25 transparent ${editor.isActive('bulletList') ? 'is-active' : ''}`} onClick={() => editor.chain().focus().toggleBulletList().run()} aria-label="toggle bulleted list">
            <IconList width={16} height={16} className="grid" />
          </button>
          <button className={`padding-25 transparent ${editor.isActive('orderedList') ? 'is-active' : ''}`} onClick={() => editor.chain().focus().toggleOrderedList().run()} aria-label="toggle numbered list">
            <IconListNumbers width={16} height={16} className="grid" />
          </button>
          <button className="padding-25 transparent" onClick={() => editor.chain().focus().setDetails().run()} disabled={!editor.can().setDetails()} aria-label="add details">
            <IconSelect width={16} height={16} className="grid" />
          </button>
        </div>
      </div>
    </div>
  )
}