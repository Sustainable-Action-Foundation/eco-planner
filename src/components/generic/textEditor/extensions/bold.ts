import '@tiptap/extension-text-style'
import { Extension } from '@tiptap/core'

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

  addKeyboardShortcuts() {
    return {
      'Mod-b': () => this.editor.commands.toggleBold(),
      'Mod-B': () => this.editor.commands.toggleBold(),
    }
  },

})