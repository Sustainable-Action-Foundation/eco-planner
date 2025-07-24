import '@tiptap/extension-text-style'
import { Extension } from '@tiptap/core'

export type greyTextOptions = {
  /**
   * The types where the underline can be applied
   * @default ['textStyle']
   */
  types: string[],
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    greyText: {
      /**
       * Toggle underline on the selected text
       * @example editor.commands.toggleUnderline()
       */
      toggleGreyText: () => ReturnType,
    }
  }
}

export const GreyText = Extension.create<greyTextOptions>({
  name: 'greyText',

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
              const color = element.style.color?.replace(/['"]+/g, '')
              return color === 'greyText' ? 'greyText' : null
            },
            renderHTML: attributes => {
              if (attributes.color !== 'greyText') {
                return {}
              }

              return {
                style: 'color: grey',
              }
            },
          },
        },
      },
    ]
  },

  addCommands() {
    return {
      toggleGreyText: () => ({ chain }) => {
        const attrs = this.editor.getAttributes('textStyle');
        const isGreyText = attrs.color === 'grey'

        return isGreyText
          ? chain()
            .setMark('textStyle', { color: null })
            .removeEmptyTextStyle()
            .run()
          : chain()
            .setMark('textStyle', { color: 'grey' })
            .run()
      }
    }
  },

  /* TODO: Figure out commands for this
  addKeyboardShortcuts() {
    return {
      'Mod-b': () => this.editor.commands.toggleBold(),
      'Mod-B': () => this.editor.commands.toggleBold(),
    }
  },
   */
})