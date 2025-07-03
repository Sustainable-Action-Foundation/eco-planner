import { Mark, mergeAttributes } from '@tiptap/core'
import type { RawCommands } from '@tiptap/core'

const UnderlineSpan = Mark.create({
  name: 'underline',
  excludes: '',  // ✅ allows it to coexist with other marks

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[style*="text-decoration: underline"]',
      },
      {
        tag: 'span.underline',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', {
      ...mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      style: 'text-decoration: underline;',
    }, 0]
  },

  addCommands() {
    return {
      toggleUnderline: () => () => {
        return this.editor.commands.toggleMark(this.name)
      },
    } as Partial<RawCommands>  // ✅ this line solves the type error
  },
})

export default UnderlineSpan