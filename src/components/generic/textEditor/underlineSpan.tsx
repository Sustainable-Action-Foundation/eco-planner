import '@tiptap/extension-text-style'
import { Extension } from '@tiptap/core'

export type UnderlineOptions = {
  /**
   * The types where the underline can be applied
   * @default ['textStyle']
   */
  types: string[],
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    underline: {
      /**
       * Toggle underline on the selected text
       * @example editor.commands.toggleUnderline()
       */
      toggleUnderline: () => ReturnType,
    }
  }
}

export const Underline = Extension.create<UnderlineOptions>({
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
              return textDecoration === 'underline' ? 'underline' : null
            },
            renderHTML: attributes => {
              if (attributes.textDecoration !== 'underline') {
                return {}
              }

              return {
                style: 'text-decoration: underline',
              }
            },
          },
        },
      },
    ]
  },

  addCommands() {
    return {
      toggleUnderline: () => ({ chain }) => {
        const attrs = (this.editor as any).getAttributes('textStyle')
        const isUnderlined = attrs.textDecoration === 'underline'

        return isUnderlined
          ? chain()
            .setMark('textStyle', { textDecoration: null })
            .removeEmptyTextStyle()
            .run()
          : chain()
            .setMark('textStyle', { textDecoration: 'underline' })
            .run()
      }

    }
  },
})

//

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
        const isUnderlined = attrs.textDecoration === 'line-through'

        return isUnderlined
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
})