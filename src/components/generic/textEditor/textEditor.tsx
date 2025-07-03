'use client'

import BulletList from '@tiptap/extension-bullet-list'
import Document from '@tiptap/extension-document'
import ListItem from '@tiptap/extension-list-item'
import OrderedList from '@tiptap/extension-ordered-list'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import Highlight from '@tiptap/extension-highlight'
import { EditorContent, useEditor } from '@tiptap/react'
import TextStyle from '@tiptap/extension-text-style'
import Superscript from '@tiptap/extension-superscript'
import Subscript from '@tiptap/extension-subscript'
import Details from '@tiptap/extension-details'
import DetailsContent from '@tiptap/extension-details-content'
import DetailsSummary from '@tiptap/extension-details-summary'

const TextEditor = () => {
  const editor = useEditor({
    immediatelyRender: true,  
    extensions: [
      Document, // Required
      Text, // Required
      Paragraph, 
      Highlight,
      Subscript,
      Superscript,
      TextStyle,
      BulletList, 
      OrderedList, 
      ListItem,
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
          <button onClick={() => editor.chain().focus().setDetails().run()} disabled={!editor.can().setDetails()}>
            Set details
          </button> 
          <button onClick={() => editor.chain().focus().unsetDetails().run()} disabled={!editor.can().unsetDetails()}>
            Unset details
          </button> <br /><br />
          <button
            onClick={() => editor.chain().focus().toggleSubscript().run()}
            className={editor.isActive('subscript') ? 'is-active' : ''}
          >
            Toggle subscript
          </button> <br /> <br />

          <button
            onClick={() => editor.chain().focus().toggleSuperscript().run()}
            className={editor.isActive('superscript') ? 'is-active' : ''}
          >
            Toggle superscript
          </button> <br /> <br />

          <button
            onClick={() => editor.chain().focus().toggleHighlight().run()}
            className={editor.isActive('highlight') ? 'is-active' : ''}
          >
            Toggle highlight
          </button> <br /><br />

          <button
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={editor.isActive('bulletList') ? 'is-active' : ''}
          >
            Toggle bullet list
          </button> <br />
          <button
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={editor.isActive('orderedList') ? 'is-active' : ''}
          >
            Toggle ordered list
          </button> <br />
          <button
            onClick={() => editor.chain().focus().splitListItem('listItem').run()}
            disabled={!editor.can().splitListItem('listItem')}
          >
            Split list item
          </button>
          <button
            onClick={() => editor.chain().focus().sinkListItem('listItem').run()}
            disabled={!editor.can().sinkListItem('listItem')}
          >
            Sink list item
          </button>
          <button
            onClick={() => editor.chain().focus().liftListItem('listItem').run()}
            disabled={!editor.can().liftListItem('listItem')}
          >
            Lift list item
          </button>
        </div>
      </div>
      <EditorContent className='margin-bottom-300' editor={editor} />
    </>
  )
}

export default TextEditor
