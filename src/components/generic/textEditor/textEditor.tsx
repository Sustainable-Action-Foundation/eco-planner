'use client'

// TODO: Remove duplicate extension names
// TODO: Check which extensions are actually used
// TODO: Replace rich text-editor with textarea if no js

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

const TextEditor = () => {
  const editor = useEditor({
    immediatelyRender: true,
    extensions: [
      Document, // Required
      Text, // Required
      Paragraph,
      TextStyle.configure({ mergeNestedSpanStyles: true }),
      Placeholder.configure({
        placeholder: 'Skriv något...'
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
        protocols: ['http', 'https', 'mailto', 'callto', 'tel'],
        /*isAllowedUri: (url, ctx) => {
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
        },*/
      })
    ], 
  })

  if (!editor) {
    return null
  }

  /* TODO: Apply aria-hidden to empty <p> tags */
  /* TODO: If there are empty tags after the last piece of content, remove them */
  /* TODO: Keyboard Shortcut for font size and grey-text */
  return (
    <div className='purewhite smooth' style={{ border: '1px solid var(--gray)' }}>
      <TextEditorMenu editor={editor} />
      <EditorContent editor={editor} />
    </div>
  )
}

export default TextEditor
