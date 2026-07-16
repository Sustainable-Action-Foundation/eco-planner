import type { ApiSelectionItem, ApiTableMetadata, ApiTableContent } from "@/lib/api/apiTypes";
import type { Recipe } from "@/functions/recipe/recipe";
import type { RecipeDataTypes, RecipeVariable } from "@/functions/recipe/types";
import type { DateValues } from "@/types";
import type { SetStateAction } from "react";
import "@/types/tiptap-commands";

// External data
export type ExternalData = {
  dataSource: string;
  table: { tableId: string; label: string } | null;
  tables: { tableId: string; label: string }[] | null;
  tableMetadata: ApiTableMetadata | null;
  tableContent: ApiTableContent | null;
  /** The query behind `tableContent`; set together with it, so consumers (e.g. `Recipe.fromExternalSource`) always see a matching pair. */
  selection: ApiSelectionItem[] | null;
  mainTimeDimensionId: string | null;
};

export type ExternalDataState = ExternalData | null

export type ExternalDataAction =
  | { type: "SELECT_DATASET"; dataSource: string }
  | { type: "SELECT_TABLE"; table: ExternalData["table"] }
  | { type: "SET_TABLES"; tables: ExternalData["tables"] }
  | { type: "UPDATE_TABLE_LABEL"; label: string }
  | { type: "SET_METADATA"; metadata: ApiTableMetadata | null }
  | { type: "SET_CONTENT"; content: ApiTableContent | null; selection: ApiSelectionItem[] | null };

// Recipe editing context
type VariableByType<TType extends RecipeDataTypes> = Extract<RecipeVariable, { type: TType }>;

export type GetVariable = {
  (variableId: string): RecipeVariable | undefined;
  <TType extends RecipeDataTypes>(variableId: string, expectedType: TType): VariableByType<TType> | undefined;
};

export type RecipeContextType = {
  recipe: Recipe;
  resultingDataSeries: DateValues | null;
  resultingUnit: string | null | undefined;

  warnings: string[];
  error: string | null;

  clearRecipe: () => void;
  applyRecipeUpdate: (recipeUpdate: SetStateAction<Recipe>) => Promise<void>;

  equation: Recipe["equation"];
  updateEquation: (equationUpdate: SetStateAction<Recipe["equation"]>) => void;

  variables: RecipeVariable[];
  replaceVariables: (variablesUpdate: SetStateAction<RecipeVariable[]>) => void;

  getVariable: GetVariable;
  upsertVariable: (variableId: string, variableUpdate: SetStateAction<RecipeVariable> | null) => void;
};

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