import '@tiptap/core';
import '@tiptap/extension-link';

declare module '@tiptap/extension-link' {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface LinkOptions {
    onOpenLinkModal?: () => void
  }
}

declare module '@tiptap/core' {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface Commands<ReturnType> {
    bold: {
      toggleBold: () => ReturnType;
    };
    italic: {
      toggleItalic: () => ReturnType;
    };
    lineThrough: {
      toggleLineThrough: () => ReturnType;
    };
    underline: {
      toggleUnderline: () => ReturnType;
    };
  }
}
