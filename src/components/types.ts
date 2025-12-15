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
