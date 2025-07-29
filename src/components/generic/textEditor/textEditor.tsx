'use client'

// TODO: Remove duplicate extension names

import { EditorContent, useEditor } from '@tiptap/react'
import TextEditorMenu from './textEditorMenu'
import {
  HardBreak,
  Superscript,
  Subscript,
  TextStyle,
  Link,
  Placeholder,
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
  CharacterCount,
  UndoRedo,
  FontSize
} from './extensions'

export const allowedProtocols = ['http', 'https', 'mailto', 'callto', 'tel'];
const limit = 5000

const TextEditor = ({
  ariaLabelledBy,
  placeholder,
  id
}: {
  ariaLabelledBy: string,
  placeholder?: string,
  id: string
}) => {

  const CustomColor = Color.extend({
    addKeyboardShortcuts() {
      return {
        'Mod-Shift-g': () => {
          const currentColor = this.editor.getAttributes('textStyle').color;
          const isGrey = currentColor === 'grey';
          return isGrey
            ? this.editor.chain().focus().unsetColor().run()
            : this.editor.chain().focus().setColor('grey').run();
        }
      }
    },
  })

  const editor = useEditor({
    immediatelyRender: true,
    shouldRerenderOnTransaction: true,
    extensions: [
      Document, // Required
      Text, // Required 
      CustomColor.configure({}),
      Paragraph,
      HardBreak,
      FontSize,
      TextStyle,
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
      Link.configure({
        openOnClick: true,
        autolink: true,
        defaultProtocol: 'https',
        protocols: allowedProtocols,
      }),
      UndoRedo
    ],
  })

  if (!editor) {
    return null
  }

  /* TODO: Keyboard shortcut and custom menu for linkinput */
  /* TODO: Character counter i18n */

  const percentage = editor ? Math.round((100 / limit) * editor.storage.characterCount.characters({ mode: 'nodeSize' })) : 0

  return (
    <div className='tiptap-wrapper purewhite smooth' style={{ border: '1px solid var(--gray-80)' }}>
      <TextEditorMenu editor={editor} editorId={id} />
      <EditorContent editor={editor} id={id} aria-labelledby={ariaLabelledBy} />
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
        <small style={{ fontSize: '12px' }}>
          Karaktärer: {editor.storage.characterCount.characters()}
        </small>
      </div>
    </div>
  )
}

export default TextEditor
