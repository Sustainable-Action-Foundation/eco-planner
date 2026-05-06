export const RecipeEditorPermissions = {
  allowAddVariables: true,
  allowDeleteVariables: true,
  allowNameEditing: true,
  allowValueEditing: true,
} as const;
export type RecipeEditorPermissions = Partial<Record<keyof typeof RecipeEditorPermissions, boolean>>;