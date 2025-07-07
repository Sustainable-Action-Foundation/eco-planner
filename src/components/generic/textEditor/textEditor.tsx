'use client'

import { useCallback } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import TextEditorMenu from './textEditorMenu'
import Superscript from '@tiptap/extension-superscript'
import Subscript from '@tiptap/extension-subscript'
import Details from '@tiptap/extension-details'
import DetailsContent from '@tiptap/extension-details-content'
import DetailsSummary from '@tiptap/extension-details-summary'
import TextStyle from '@tiptap/extension-text-style'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import History from '@tiptap/extension-history'
import BulletList from '@tiptap/extension-bullet-list'
import Document from '@tiptap/extension-document'
import ListItem from '@tiptap/extension-list-item'
import OrderedList from '@tiptap/extension-ordered-list'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import Highlight from '@tiptap/extension-highlight'
import Color from '@tiptap/extension-color'
import { Italic, Bold, LineThrough, Underline } from './extensions'

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
      History,
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

  /* TODO: Apply aria-hidden to empty <p> tags */
  /* TODO: If there are empty tags after the last piece of content, remove them */
  return (

    <div className='purewhite smooth margin-bottom-300' style={{ border: '1px solid var(--gray)' }}>
      <TextEditorMenu editor={editor} />
      <EditorContent editor={editor} />
    </div>

  )
}

export default TextEditor
