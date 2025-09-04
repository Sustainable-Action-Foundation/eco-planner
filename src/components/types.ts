// TODO: Use uppercase?
// TODO: Use set?

export type genericElement = {
  className?: string;
  style?: React.CSSProperties;
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
