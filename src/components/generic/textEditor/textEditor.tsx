'use client'

// TODO: Remove duplicate extension names
// TODO: Check which extensions are actually used

import { EditorContent, useEditor } from '@tiptap/react'
import TextEditorMenu from './textEditorMenu'
import {
  HardBreak,
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
  FontSize,
  CharacterCount
} from './extensions'

export const allowedProtocols = ['http', 'https', 'mailto', 'callto', 'tel'];
const limit = 5000

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
      HardBreak,
      TextStyle.configure({ mergeNestedSpanStyles: true }),
      Placeholder.configure({
        placeholder: placeholder ? placeholder : undefined
      }),
      CharacterCount.configure({
        limit,
        mode: 'nodeSize'
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

  /* TODO: Keyboard shortcut and custom menu for linkinput */

  const percentage = editor ? Math.round((100 / limit) * editor.storage.characterCount.characters({ mode: 'nodeSize' })) : 0

  return (
      <div className='tiptap-wrapper purewhite smooth' style={{ border: '1px solid var(--gray-80)' }}>
        <TextEditorMenu editor={editor} />
        <EditorContent editor={editor} aria-labelledby={ariaLabelledBy} />
        <div className='flex align-items-center gap-50 padding-50'>
          <svg height="24" width="24" viewBox="0 0 20 20">
            <circle r="10" cx="10" cy="10" fill="#e9ecef" />
            <circle
              r="5"
              cx="10"
              cy="10"
              fill="transparent"
              stroke={`${editor.storage.characterCount.characters({ mode: 'nodeSize' }) === limit ? '#d83545ff' : 'var(--blue-40)'}`}
              strokeWidth="10"
              strokeDasharray={`calc(${percentage} * 31.4 / 100) 31.4`}
              transform="rotate(-90) translate(-20)"
            />
            <circle r="6" cx="10" cy="10" fill="white" />
          </svg>
          <small style={{fontSize: '12px'}}>
            Karaktärer: {editor.storage.characterCount.characters()}
          </small>
        </div>
      </div>
  )
}

export default TextEditor
