import '@tiptap/core';

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
