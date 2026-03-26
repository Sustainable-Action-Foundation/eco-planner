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

export type Position = {
  row: number,
  column: number
}

export type GridElement = GenericElement & {
  position?: Position,
  tabIndex?: 0 | -1,
  children?: React.ReactNode,
  onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>, // Note: we assume a gridcell is a div for now.
  onClick?: React.MouseEventHandler<HTMLDivElement> 
} 


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
  // @ts-expect-error - This is a module augmentation
  type LinkOptions = {
    onOpenLinkModal?: () => void
  }
}
