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
})

export type boldOptions = {
  /**
   * The types where the underline can be applied
   * @default ['textStyle']
   */
  types: string[],
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    bold: {
      /**
       * Toggle underline on the selected text
       * @example editor.commands.toggleUnderline()
       */
      toggleBold: () => ReturnType,
    }
  }
}

export const Bold = Extension.create<boldOptions>({
  name: 'bold',

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
          fontWeight: {
            default: null,
            parseHTML: element => {
              const fontWeight = element.style.fontWeight?.replace(/['"]+/g, '')
              return fontWeight === 'bold' ? 'bold' : null
            },
            renderHTML: attributes => {
              if (attributes.fontWeight !== 'bold') {
                return {}
              }

              return {
                style: 'font-weight: 600',
              }
            },
          },
        },
      },
    ]
  },

  addCommands() {
    return {
      toggleBold: () => ({ chain }) => {
        const attrs = (this.editor as any).getAttributes('textStyle')
        const isBold = attrs.fontWeight === 'bold'

        return isBold
          ? chain()
            .setMark('textStyle', { fontWeight: null })
            .removeEmptyTextStyle()
            .run()
          : chain()
            .setMark('textStyle', { fontWeight: 'bold' })
            .run()
      }

    }
  },
})

export type italicOptions = {
  /**
   * The types where the underline can be applied
   * @default ['textStyle']
   */
  types: string[],
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    italic: {
      /**
       * Toggle underline on the selected text
       * @example editor.commands.toggleUnderline()
       */
      toggleItalic: () => ReturnType,
    }
  }
}

export const Italic = Extension.create<italicOptions>({
  name: 'italic',

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
          fontStyle: {
            default: null,
            parseHTML: element => {
              const fontStyle = element.style.fontStyle?.replace(/['"]+/g, '')
              return fontStyle === 'italic' ? 'italic' : null
            },
            renderHTML: attributes => {
              if (attributes.fontStyle !== 'italic') {
                return {}
              }

              return {
                style: 'font-style: italic',
              }
            },
          },
        },
      },
    ]
  },

  addCommands() {
    return {
      toggleItalic: () => ({ chain }) => {
        const attrs = (this.editor as any).getAttributes('textStyle')
        const isItalic = attrs.fontStyle === 'italic'

        return isItalic
          ? chain()
            .setMark('textStyle', { fontStyle: null })
            .removeEmptyTextStyle()
            .run()
          : chain()
            .setMark('textStyle', { fontStyle: 'italic' })
            .run()
      }
    }
  },

})