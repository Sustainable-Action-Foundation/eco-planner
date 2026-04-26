// TODO: Use set for tree items and map for options?

export type Theme = {
  className?: string;
  style?: React.CSSProperties;
}

export type GenericElement = Theme & {
  id?: string;
};

export type InputElement = GenericElement & {
  id: string;
  name: string,
  required?: boolean,
  disabled?: boolean,
  placeholder?: string,
  defaultValue?: string,
};

// TODO: DO not use name (reserved keyword)
export type Option = {
  name: string,
  value: string,
}

export type TreeItem = {
  name: string,
  value: string,
  expanded: boolean | null,
  loading?: boolean;
  childNodes?: Array<TreeItem>,
  onExpand?: () => Array<TreeItem> | Promise<Array<TreeItem>>
}

export type GridCell = GenericElement & {
  position?: {row: number, column: number},
  tabIndex?: 0 | -1,
  children?: React.ReactNode,
  onKeyDown?: React.KeyboardEventHandler<HTMLTableCellElement>, 
  onClick?: React.MouseEventHandler<HTMLTableCellElement>
}
export type GridColumnHeader = GenericElement & { children?: React.ReactNode }
export type GridRowHeader = GenericElement & { children?: React.ReactNode }

export type TabElement = GenericElement & {
  children?: React.ReactNode
}

export type TabProps = TabElement & {
  tabIndex?: 0 | -1,
  selected?: boolean,
  onClick?: () => void
}

export type TabPanelProps = TabElement & {
  hidden?: boolean
}


import '@tiptap/extension-link'

declare module '@tiptap/extension-link' {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface LinkOptions {
    onOpenLinkModal?: () => void
  }
}
