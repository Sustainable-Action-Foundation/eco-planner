'use client'

// TODO: Remove duplicate extension names
import { Content, Editor, EditorContent, useEditor } from '@tiptap/react'
import TextEditorMenu from './menu'
import { defaultExtensions, nodeSizeLimit } from './config/config';
import { useMemo } from 'react';
import { useDebouncedCallback } from 'use-debounce';

{/* TODO: Update typing for content */ }
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
  content?: Content,
  editable: boolean,
  defaultStyles?: boolean,
  onChange?: (json: ReturnType<Editor['getJSON']>) => void
}) => {

  const parsedContent = useMemo(() => {
    if (!content) return null;
    try {
      return JSON.parse(content as string) as Content;
    } catch {
      return content;
    }
  }, [content]);
 
  const debouncedOnChange  = useDebouncedCallback((editor: Editor) => {
    if (onChange) onChange(editor.getJSON());
  }, 200); 

  const editor = useEditor({
    immediatelyRender: true,
    shouldRerenderOnTransaction: true,
    editable,
    onUpdate: ({ editor }) => {
      debouncedOnChange(editor)
    },
    content: parsedContent,
    extensions: defaultExtensions(placeholder),
  })

  if (!editor) {
    return null
  }

  const percentage = editor ? Math.round((100 / nodeSizeLimit) * editor.storage.characterCount.characters({ mode: 'nodeSize' })) : 0
  const circumference = 2 * Math.PI * 5; // r = 5
  const dash = (percentage / 100) * circumference;

  return (
    <div
      className={`${className ? `${className} ` : ''}${defaultStyles ? 'tiptap-wrapper purewhite smooth relative' : ''}`}
      style={{ ...style, border: `${defaultStyles ? '1px solid var(--gray-80)' : ''}` }}
    >
      {defaultStyles ?
        <TextEditorMenu editor={editor} editorId={id} />  // TODO: Disable menuitems when editor is disabled
        : null}
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
              stroke={`${editor.storage.characterCount.characters({ mode: 'nodeSize' }) === nodeSizeLimit ? '#d83545ff' : 'var(--blue-40)'}`}
              strokeWidth="10"
              strokeDasharray={`${dash} ${circumference}`}
              transform="rotate(-90) translate(-20)"
            />
            <circle r="6" cx="10" cy="10" fill="white" />
          </svg>
        </div>
        : null}
    </div>
  )
}

export default TextEditor
