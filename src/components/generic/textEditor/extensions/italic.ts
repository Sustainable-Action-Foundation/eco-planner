import '@tiptap/extension-text-style'
import { Extension } from '@tiptap/core'

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

  addKeyboardShortcuts() {
    return {
      'Mod-i': () => this.editor.commands.toggleItalic(),
      'Mod-I': () => this.editor.commands.toggleItalic(),
    }
  },

})