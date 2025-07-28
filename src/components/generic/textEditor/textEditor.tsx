'use client'

// TODO: Remove duplicate extension names
// TODO: Check which extensions are actually used

import { EditorContent, useEditor } from '@tiptap/react'
import TextEditorMenu from './textEditorMenu'
import {
  Superscript,
  Subscript,
  Details,
  DetailsContent,
  DetailsSummary,
  TextStyle,
  Link,
  Placeholder,
  History,
  BulletList,
  Document,
  ListItem,
  OrderedList,
  Paragraph,
  Text,
  Highlight,
  Color,
  Italic,
  Bold,
  LineThrough,
  Underline,
  GreyText,
  FontSize
} from './extensions'

export const allowedProtocols = ['http', 'https', 'mailto', 'callto', 'tel'];

const TextEditor = ({ 
  ariaLabelledBy,
  placeholder
}: {
  ariaLabelledBy: string,
  placeholder?: string
}) => {
  const editor = useEditor({
    immediatelyRender: true,
    extensions: [
      Document, // Required
      Text, // Required
      Paragraph,
      TextStyle.configure({ mergeNestedSpanStyles: true }),
      Placeholder.configure({
        placeholder: placeholder ? placeholder : undefined
      }),
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
      Color,
      History,
      GreyText,
      FontSize.configure({
        sizes: ['0.75rem', '1.25rem'],
      }),
      Details.configure({
        HTMLAttributes: {
          class: 'details',
        },
      }),
      DetailsSummary,
      DetailsContent,
      Link.configure({
        openOnClick: true,
        autolink: true,
        defaultProtocol: 'https',
        protocols: allowedProtocols,
      })
    ],
  })

  if (!editor) {
    return null
  }

  /* TODO: Apply aria-hidden to empty <p> tags */
  /* TODO: If there are empty tags after the last piece of content, remove them */
  /* TODO: Keyboard shortcut and custom menu for linkinput */
  return (
    <div className='tiptap-wrapper purewhite smooth' style={{ border: '1px solid var(--gray-80)' }}>
      <TextEditorMenu editor={editor} />
      <EditorContent editor={editor} aria-labelledby={ariaLabelledBy} />
    </div>
  )
}

export default TextEditor
