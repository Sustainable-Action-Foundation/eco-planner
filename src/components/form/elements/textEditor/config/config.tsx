// Custom
import { Italic } from '../extensions/italic'
import { Bold } from '../extensions/bold'
import { LineThrough } from '../extensions/linethrough'
import { Underline } from '../extensions/underline'

// Tiptap extensions
import { BulletList, OrderedList, ListItem, } from '@tiptap/extension-list'
import { Placeholder, UndoRedo, CharacterCount } from '@tiptap/extensions'
import { TextStyle, Color, FontSize } from '@tiptap/extension-text-style'
import Superscript from '@tiptap/extension-superscript'
import Subscript from '@tiptap/extension-subscript'
import Link from '@tiptap/extension-link'
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import Highlight from '@tiptap/extension-highlight'
import HardBreak from '@tiptap/extension-hard-break'

export const allowedProtocols = ['http', 'https', 'mailto', 'callto', 'tel'];
export const nodeSizeLimit = 5000

export const CustomColor = Color.extend({
  addKeyboardShortcuts() {
    return {
      'Mod-Shift-g': () => {
        const currentColor = this.editor.getAttributes('textStyle').color as unknown;
        const isGrey = currentColor === 'grey';
        return isGrey
          ? this.editor.chain().focus().unsetColor().run()
          : this.editor.chain().focus().setColor('grey').run();
      }
    }
  },
})

const CustomLink = Link.extend({
  addKeyboardShortcuts() {
    return {
      'Mod-k': () => this.editor.commands.setLink({ href: '' }),
      'Mod-K': () => this.editor.commands.setLink({ href: '' }),
    }
  },
})

export const defaultExtensions = (placeholder?: string) => [
  Document,
  Text,
  CustomColor.configure({}),
  Paragraph,
  HardBreak,
  FontSize,
  TextStyle,
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
  UndoRedo,
  CustomLink.configure({
    openOnClick: false,
    autolink: true,
    defaultProtocol: 'https',
    protocols: allowedProtocols,
  }),
  Placeholder.configure({
    placeholder: placeholder || undefined,
  }),
  CharacterCount.configure({
    limit: nodeSizeLimit,
    mode: 'nodeSize'
  }),
]