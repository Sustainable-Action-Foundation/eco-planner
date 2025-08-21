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

 {/* TODO: Update typing for content */}
const TextEditor = ({
  className,
  style,
  ariaLabelledBy,
  placeholder,
  id,
  content,
  editable,
  defaultStyles = true,
  onChange
}: {
  className?: string
  style?: React.CSSProperties
  ariaLabelledBy?: string,
  placeholder?: string,
  id: string,
  content?: any,
  editable: boolean,
  defaultStyles?: boolean,
  onChange?: (json: any) => void
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
    onUpdate: ({ editor }) => {
      if (onChange) {
        onChange(editor.getJSON())
      }
    },
    editable: editable,
    // Fallback to just the content incase a string is passed (For backwards compatability)
    content: (() => { try { return JSON.parse(content)} catch { return content} })(), 
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
  /* TODO: When selecting menuitem Enter should focus editor, space should not. */
  /* TODO: For some reason the undo/redo is not disabled */

  const percentage = editor ? Math.round((100 / limit) * editor.storage.characterCount.characters({ mode: 'nodeSize' })) : 0

  return (
    <div 
      className={`${className ? `${className} ` : ''}${defaultStyles ? 'tiptap-wrapper purewhite smooth' : ''}`}
      style={{ ...style, border:`${defaultStyles ? '1px solid var(--gray-80)' : ''}` }}
    >
      {defaultStyles ? 
        <TextEditorMenu editor={editor} editorId={id} /> // TODO: Disable all inputs if the editor is disabled  
      : null }
      <EditorContent editor={editor} id={id} aria-labelledby={ariaLabelledBy} />
      {defaultStyles ? 
        <div className='flex align-items-center justify-content-flex-end gap-50 padding-50'>
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
        </div>
      : null }
    </div>
  )
}

export default TextEditor
