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
};