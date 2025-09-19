// TODO: Use uppercase?
// TODO: Use set for tree items and map for options?

export type theme = {
  className?: string;
  style?: React.CSSProperties;
}

export type genericElement = theme & {
  id?: string;
};

export type inputElement = genericElement & {
  id: string; 
  name: string,
  required?: boolean,
  disabled?: boolean,
  placeholder?: string,
  defaultValue?: string,
};

export type option = {
  name: string,
  value: string,
}

export type treeItem = { 
  name: string,
  value: string,
  expanded: boolean | null,  
  childNodes?: Array<treeItem>,
  onExpand?: () => Array<treeItem> | Promise<Array<treeItem>>
}
