import '@tiptap/extension-text-style'
import { Extension } from '@tiptap/core'

export type LineThroughOptions = {
  /**
   * The types where the underline can be applied
   * @default ['textStyle']
   */
  types: string[],
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    LineThrough: {
      /**
       * Toggle underline on the selected text
       * @example editor.commands.toggleUnderline()
       */
      toggleLineThrough: () => ReturnType,
    }
  }
}

export const LineThrough = Extension.create<LineThroughOptions>({
  name: 'underline',

  addOptions() {
    return {
      types: ['textStyle'],
    }
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          textDecoration: {
            default: null,
            parseHTML: element => {
              const textDecoration = element.style.textDecoration?.replace(/['"]+/g, '')
              return textDecoration === 'line-through' ? 'line-through' : null
            },
            renderHTML: attributes => {
              if (attributes.textDecoration !== 'line-through') {
                return {}
              }

              return {
                style: 'text-decoration: line-through',
              }
            },
          },
        },
      },
    ]
  },

  addCommands() {
    return {
      toggleLineThrough: () => ({ chain }) => {
        const attrs = (this.editor as any).getAttributes('textStyle')
        const isLineThrough = attrs.textDecoration === 'line-through'

        return isLineThrough
          ? chain()
            .setMark('textStyle', { textDecoration: null })
            .removeEmptyTextStyle()
            .run()
          : chain()
            .setMark('textStyle', { textDecoration: 'line-through' })
            .run()
      }
    }
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-s': () => this.editor.commands.toggleLineThrough(),
    }
  },

})