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

export type treeItem = option & {
  childNodes: Array<treeItem>
}