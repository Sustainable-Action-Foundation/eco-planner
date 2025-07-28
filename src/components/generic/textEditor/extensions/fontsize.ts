import '@tiptap/extension-text-style'
import { Extension } from '@tiptap/core'

export type FontSizeOptions = {
  /**
   * The types where font size can be applied
   * @default ['textStyle']
   */
  types: string[],
  /**
   * Allowed font sizes
   */
  sizes: string[]
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontSize: {
      /**
       * Set the font size on selected text
       * @param size A string like '12px' or '20px'
       */
      setFontSize: (size: string) => ReturnType,
      /**
       * Unset the font size on selected text
       */
      unsetFontSize: () => ReturnType,
    }
  }
}

export const FontSize = Extension.create<FontSizeOptions>({
  name: 'fontSize',

  addOptions() {
    return {
      types: ['textStyle'],
      sizes: ['0.75rem', '1rem', '1.25rem'],
    }
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: element => {
              const fontSize = element.style.fontSize?.trim()
              return this.options.sizes.includes(fontSize) ? fontSize : null
            },
            renderHTML: attributes => {
              if (!attributes.fontSize || !this.options.sizes.includes(attributes.fontSize)) {
                return {}
              }
              return {
                style: `font-size: ${attributes.fontSize}`,
              }
            },
          },
        },
      },
    ]
  },

  addCommands() {
    return {
      setFontSize: (size: string) => ({ chain }) => {
        if (!this.options.sizes.includes(size)) {
          console.warn(`[FontSize Extension] Invalid size: ${size}`)
          return chain().run()
        }

        return chain()
          .setMark('textStyle', { fontSize: size })
          .run()
      },
      unsetFontSize: () => ({ chain }) => {
        return chain()
          .setMark('textStyle', { fontSize: null })
          .removeEmptyTextStyle()
          .run()
      },
    }
  },

  addKeyboardShortcuts() {
    return {
      'Mod-shift-1': () => this.editor.commands.setFontSize('1.25rem'),
      'Mod-shift-2': () => this.editor.commands.unsetFontSize(),
      'Mod-shift-3': () => this.editor.commands.setFontSize('0.75rem'),
    }
  },

})
