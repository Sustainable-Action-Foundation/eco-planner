import "client-only";
import { isExternalSelection, RecipeDataTypes } from "@/functions/recipe/types";
import type { DatasetKeys } from "@/lib/api/utility";
import { ExternalDataset } from "@/lib/api/utility";
import type { JSONValue } from "@/types";
import type { RecipeContextType } from "./context/recipeContext.internal";


export function updateExternalVariableDataset(variableName: string, newDataset: string, setter: RecipeContextType["setVariable"]) {
  setter(variableName, prev => {
    const currentVar = { ...prev };
    if (!currentVar) {
      console.warn(`Variable '${variableName}' does not exist in the recipe`);
      return prev; // Do not update if variable does not exist
    } else if (currentVar.type !== RecipeDataTypes.External) {
      console.warn(`Variable '${variableName}' is not of type External`);
      return prev; // Do not update if the variable is not an external data source
    }

    const dataset = ExternalDataset[newDataset as keyof typeof ExternalDataset];
    if (!dataset || typeof dataset !== "object" || !("baseUrl" in dataset)) {
      console.warn(`Dataset '${newDataset}' not found`);
      return prev; // Do not update if the dataset is not known
    }

    return {
      ...currentVar,
      dataset: newDataset as DatasetKeys,
    };
  });
}

export function updateExternalVariableTable(variableName: string, newTable: string, setter: RecipeContextType["setVariable"]) {
  setter(variableName, prev => {
    const currentVar = { ...prev };
    if (!currentVar) {
      console.warn(`Variable '${variableName}' does not exist in the recipe`);
      return prev; // Do not update if variable does not exist
    }
    else if (currentVar.type !== RecipeDataTypes.External) {
      console.warn(`Variable '${variableName}' is not of type External`);
      return prev; // Do not update if the variable is not an external data source
    }

    return {
      ...currentVar,
      tableId: newTable,
    };
  });
}

export function updateExternalVariableSelection(variableName: string, newSelection: string, setter: RecipeContextType["setVariable"]) {
  setter(variableName, prev => {
    const currentVar = { ...prev };

    if (!currentVar) {
      console.warn(`Variable '${variableName}' does not exist in the recipe`);
      return prev; // Do not update if variable does not exist
    }
    else if (currentVar.type !== RecipeDataTypes.External) {
      console.warn(`Variable '${variableName}' is not of type External`);
      return prev; // Do not update if the variable is not an external data source
    }

    try {
      const selection = JSON.parse(newSelection) as JSONValue;
      if (!isExternalSelection(selection)) {
        console.warn("Invalid selection format", selection);
        return prev; // Do not update if selection is invalid
      }

      return {
        ...currentVar,
        selection: selection,
      };
    } catch (error) {
      console.warn("Failed to parse selection JSON", error);
      return prev; // Do not update if JSON parsing fails
    }
  });
}