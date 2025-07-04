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
        <div className="button-group">

          <button onClick={() => editor.chain().focus().toggleItalic().run()}>
            <IconItalic width={16} height={16} />
            Toggle Italic
          </button> 
          <button onClick={() => editor.chain().focus().toggleBold().run()}>
            <IconBold width={16} height={16} />
            Toggle bold
          </button> 
          <button onClick={() => editor.chain().focus().toggleLineThrough().run()}>
            <IconStrikethrough width={16} height={16} />
            Toggle line-through
          </button> 
          <button onClick={() => editor.chain().focus().toggleUnderline().run()}>
            <IconUnderline width={16} height={16} />
            Toggle underline
          </button>
          <button onClick={() => editor.chain().focus().toggleSuperscript().run()}>
            <IconSuperscript width={16} height={16} />
            Toggle superscript
          </button>
          <button onClick={() => editor.chain().focus().toggleSubscript().run()}>
            <IconSubscript width={16} height={16} />
            Toggle subscript
          </button>
          <button onClick={() => editor.chain().focus().toggleHighlight().run()}>
            <IconHighlight width={16} height={16} />
            Toggle highlight
          </button> <br /><br />

          <button onClick={() => editor.chain().focus().toggleBulletList().run()}>
            <IconList width={16} height={16} />
            Toggle bullet list
          </button>
          <button onClick={() => editor.chain().focus().toggleOrderedList().run()}>
            <IconListNumbers width={16} height={16} />
            Toggle ordered list
          </button>        
          <button onClick={() => editor.chain().focus().setDetails().run()} disabled={!editor.can().setDetails()}>
            <IconSelect width={16} height={16} />
            Set details
          </button>
          <button onClick={() => editor.chain().focus().unsetDetails().run()} disabled={!editor.can().unsetDetails()}>
            <IconSelect width={16} height={16} />
            Unset details
          </button> <br /><br />
        </div>
      </div>
      <EditorContent className='margin-bottom-300' editor={editor} />
    </>
  )
}

export default TextEditor
