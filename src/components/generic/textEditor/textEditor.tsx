'use client'

import BulletList from '@tiptap/extension-bullet-list'
import Document from '@tiptap/extension-document'
import ListItem from '@tiptap/extension-list-item'
import OrderedList from '@tiptap/extension-ordered-list'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import Highlight from '@tiptap/extension-highlight'
import { EditorContent, useEditor } from '@tiptap/react'
import Superscript from '@tiptap/extension-superscript'
import Subscript from '@tiptap/extension-subscript'
import Details from '@tiptap/extension-details'
import DetailsContent from '@tiptap/extension-details-content'
import DetailsSummary from '@tiptap/extension-details-summary'
import { Underline, LineThrough, Bold, Italic } from './underlineSpan'
import TextStyle from '@tiptap/extension-text-style'
import { IconBold, IconHighlight, IconItalic, IconList, IconListNumbers, IconSelect, IconStrikethrough, IconSubmarine, IconSubscript, IconSuperscript, IconUnderline } from '@tabler/icons-react'

const TextEditor = () => {
  const editor = useEditor({
    immediatelyRender: true,  
    extensions: [
      Document, // Required
      Text, // Required
      Paragraph, 
      TextStyle.configure({ mergeNestedSpanStyles: true }),
      Highlight,
      Subscript,
      Superscript,
      BulletList, 
      OrderedList, 
      ListItem,
      Underline,
      LineThrough,
      Bold,
      Italic,
      Details.configure({
        HTMLAttributes: {
          class: 'details',
        },
      }),
      DetailsSummary,
      DetailsContent
    ],
  })

  if (!editor) {
    return null
  }

  return (
    <>
      <div className="control-group">
        <div className="button-group margin-block-25">
          <div className='inline-flex align-items-center gap-25 padding-right-50 margin-right-50' style={{borderRight: '1px solid var(--gray-80)'}}>
            <button className='padding-25 transparent' onClick={() => editor.chain().focus().toggleItalic().run()} aria-label="toggle italic">
              <IconItalic className="grid" width={16} height={16} aria-hidden="true" />
            </button> 
            <button className='padding-25 transparent' onClick={() => editor.chain().focus().toggleBold().run()} aria-label="toggle bold" >
              <IconBold className="grid" width={16} height={16} aria-hidden="true" />
            </button> 
            <button className='padding-25 transparent' onClick={() => editor.chain().focus().toggleLineThrough().run()} aria-label="toggle strike-trough">
              <IconStrikethrough className="grid" width={16} height={16} aria-hidden="true" />
            </button> 
            <button className='padding-25 transparent' onClick={() => editor.chain().focus().toggleUnderline().run()} aria-label="toggle underline">
              <IconUnderline className="grid" width={16} height={16} aria-hidden="true" />
            </button>
            <button className='padding-25 transparent' onClick={() => editor.chain().focus().toggleSuperscript().run()} aria-label="toggle superscript">
              <IconSuperscript className="grid" width={16} height={16} aria-hidden="true" />
            </button>
            <button className='padding-25 transparent' onClick={() => editor.chain().focus().toggleSubscript().run()} aria-label="toggle subscript">
              <IconSubscript className="grid" width={16} height={16} aria-hidden="true" />
            </button>
            <button className='padding-25 transparent' onClick={() => editor.chain().focus().toggleHighlight().run()} aria-label="toggle highlight">
              <IconHighlight className="grid" width={16} height={16} aria-hidden="true" />
            </button>
          </div>
          <div className='inline-flex align-items-center gap-25 padding-right-50 margin-right-50' style={{borderRight: '1px solid var(--gray-80)'}}>
            <button className="padding-25 transparent" onClick={() => editor.chain().focus().toggleBulletList().run()} aria-label="toggle highlight">
              <IconList width={16} height={16} className="grid" /> 
            </button>
            <button className="padding-25 transparent" onClick={() => editor.chain().focus().toggleOrderedList().run()} aria-label="toggle highlight">
              <IconListNumbers width={16} height={16} className="grid" /> 
            </button>        
            <button className="padding-25 transparent" onClick={() => editor.chain().focus().setDetails().run()} disabled={!editor.can().setDetails()} aria-label="add details">
              <IconSelect width={16} height={16} className="grid" />
            </button>
            <button className="padding-25 transparent" onClick={() => editor.chain().focus().unsetDetails().run()} disabled={!editor.can().unsetDetails()} aria-label="remove details">
              <IconSelect width={16} height={16} className="grid" />
            </button>  
          </div>
        </div>
      </div>
      <EditorContent className='margin-bottom-300' editor={editor} />
    </>
  )
}

export default TextEditor
