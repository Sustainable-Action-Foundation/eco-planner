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
import Link from '@tiptap/extension-link'
import { IconBold, IconHighlight, IconItalic, IconLink, IconList, IconListNumbers, IconSelect, IconStrikethrough, IconSubscript, IconSuperscript, IconTextColor, IconUnderline } from '@tabler/icons-react'
import { useCallback } from 'react'
import Placeholder from '@tiptap/extension-placeholder'
import { Color } from '@tiptap/extension-color'

const TextEditor = () => {
  const editor = useEditor({
    immediatelyRender: true,
    extensions: [
      Placeholder.configure({
        placeholder: 'Skriv något...'
      }),
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
      Color,
      Link.configure({
        openOnClick: true,
        autolink: true,
        defaultProtocol: 'https',
        protocols: ['http', 'https', 'mailto', 'callto'],
        isAllowedUri: (url, ctx) => {
          try {
            // construct URL
            const parsedUrl = url.includes(':') ? new URL(url) : new URL(`${ctx.defaultProtocol}://${url}`)

            // use default validation
            if (!ctx.defaultValidate(parsedUrl.href)) {
              return false
            }

            // disallowed domains
            const disallowedDomains: string[] = []
            const domain = parsedUrl.hostname

            if (disallowedDomains.includes(domain)) {
              return false
            }

            const protocol = parsedUrl.protocol.replace(':', '')
            const allowedProtocols = ctx.protocols.map(p => (typeof p === 'string' ? p : p.scheme))
            if (!allowedProtocols.includes(protocol)) {
              return false
            }

            // all checks have passed
            return true
          } catch {
            return false
          }
        },
        shouldAutoLink: url => {
          try {
            // construct URL
            const parsedUrl = url.includes(':') ? new URL(url) : new URL(`https://${url}`)

            // only auto-link if the domain is not in the disallowed list
            const disallowedDomains: string[] = []
            const domain = parsedUrl.hostname

            return !disallowedDomains.includes(domain)
          } catch {
            return false
          }
        },

      }),
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

  if (!editor) {
    return null
  }

  return (
    <>
      <div className='padding-25 purewhite smooth margin-bottom-300' style={{ border: '1px solid var(--gray)' }}>
        <div className="control-group">
          <div className="button-group flex align-items-center" style={{ backgroundColor: 'var(--gray-95)', padding: '3px', borderRadius: '2px' }}>
            <div className='inline-flex align-items-center gap-25 padding-right-50 margin-right-50' style={{ borderRight: '1px solid var(--gray-80)' }}>
              <select defaultValue="default" className='transparent' style={{ fontSize: '12px', border: '0', outline: '0', '--icon-size': '16px', '--padding': '.25rem' } as React.CSSProperties}>
                <option value="smaller">Mindre</option>
                <option value="default">Normal</option>
                <option value="larger">Större</option>
              </select>
            </div>
            <div className='inline-flex align-items-center gap-25 padding-right-50 margin-right-50' style={{ borderRight: '1px solid var(--gray-80)' }}>
              <button
                onClick={() => editor.chain().focus().setColor('black').run()}
                data-testid="setBlack"
                className='padding-25 transparent'
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
            <div className='inline-flex align-items-center gap-25 padding-right-50 margin-right-50' style={{ borderRight: '1px solid var(--gray-80)' }}>
              <button className='padding-25 transparent' onClick={setLink} aria-label="set link">
                <IconLink className="grid" width={16} height={16} aria-hidden="true" />
              </button>
            </div>
            <div className='inline-flex align-items-center gap-25 padding-right-50 margin-right-50'>
              <button className="padding-25 transparent" onClick={() => editor.chain().focus().toggleBulletList().run()} aria-label="toggle bulleted list">
                <IconList width={16} height={16} className="grid" />
              </button>
              <button className="padding-25 transparent" onClick={() => editor.chain().focus().toggleOrderedList().run()} aria-label="toggle numbered list">
                <IconListNumbers width={16} height={16} className="grid" />
              </button>
              <button className="padding-25 transparent" onClick={() => editor.chain().focus().setDetails().run()} disabled={!editor.can().setDetails()} aria-label="add details">
                <IconSelect width={16} height={16} className="grid" />
              </button>
            </div>
          </div>
        </div>
        <EditorContent className='margin-bottom-300' editor={editor} />
      </div>
    </>
  )
}

export default TextEditor
