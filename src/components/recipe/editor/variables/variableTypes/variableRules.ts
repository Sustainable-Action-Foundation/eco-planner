export type InputRules = {
  allowNameEditing?: boolean;
  allowTypeEditing?: boolean;
  allowValueEditing?: boolean;
  allowDeleteVariables?: boolean;
};

export const defaultInputRules: InputRules = {
  allowNameEditing: true,
  allowTypeEditing: true,
  allowValueEditing: true,
  allowDeleteVariables: true,
};