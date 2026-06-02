// TODO: Use set for tree items and map for options?
import "@/types/tiptap-commands";

export type Theme = {
  className?: string;
  style?: React.CSSProperties;
}

export type GenericElement = Theme & {
  id?: string;
};

export type InputElement = GenericElement & {
  id: string;
  name: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  defaultValue?: string;
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
  childNodes?: TreeItem[],
  onExpand?: () => TreeItem[] | Promise<TreeItem[]>
}

export type GridElement = Theme & {
  id: string,
}

export type GridCell = GenericElement & {
  children?: React.ReactNode,
  tabIndex?: 0 | -1,
  ariaSelected?: boolean, 
  position?: {row: number, column: number},
  onKeyDown?: React.KeyboardEventHandler<HTMLTableCellElement>, 
  onClick?: React.MouseEventHandler<HTMLTableCellElement>,
  onDoubleClick?: React.MouseEventHandler<HTMLTableCellElement>
}
export type GridRow = GenericElement & { children?: React.ReactNode }
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