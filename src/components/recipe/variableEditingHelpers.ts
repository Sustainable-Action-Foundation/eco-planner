import "client-only";
import { emptyRecipeDataSeries, emptyRecipesByDataType, isRecipeExternalDatasetSelection, RecipeDataTypes, RecipeVariable } from "@/functions/recipe/types";
import { DatasetKeys, ExternalDataset } from "@/lib/api/utility";
import { JSONValue } from "@/types";
import { RecipeContextType } from "./context/recipeContext.provider";

export function updateVariableName(currentVariableName: string, newVariableName: string, setter: RecipeContextType["setVariables"]) {
  if (!newVariableName || currentVariableName === newVariableName) {
    console.warn("Variable name cannot be empty or the same as the current name");
    return; // Do not update if new name is empty or the same
  }

  setter(prev => {
    const copyOfVariables = { ...prev };

    const variableContent = copyOfVariables[currentVariableName];
    if (!variableContent) {
      console.warn(`Variable '${currentVariableName}' does not exist in the recipe`);
      return prev; // Do not update if variable does not exist
    }

    // Copy the variable content to the new name
    copyOfVariables[newVariableName] = { ...variableContent };
    // Remove the old variable name
    delete copyOfVariables[currentVariableName];

    return copyOfVariables;
  });
}

export function updateVariableType(variableName: string, newType: string, setter: RecipeContextType["setVariable"]) {
  setter(variableName, prev => {
    const currentVar = { ...prev };
    if (!currentVar) {
      console.warn(`Variable '${variableName}' does not exist in the recipe`);
      return prev; // Do not update if variable does not exist
    }

    if (!newType || !Object.values(RecipeDataTypes).includes(newType as RecipeDataTypes)) {
      console.warn(`Data type '${newType}' is not a valid RecipeDataType`);
      return prev; // Do not update if the type is invalid
    }

    if (!(newType in RecipeDataTypes)) {
      console.warn(`Data type '${newType}' is not recognized in RecipeDataTypes`);
      return prev; // Do not update if the type is not recognized
    }

    const newVar = { ...emptyRecipesByDataType[newType as RecipeDataTypes] } as RecipeVariable;
    if (!newVar || !newVar.type || Object.keys(newVar).length === 0) {
      console.warn(`No empty variable defined for data type '${newType}'`);
      return prev; // Do not update if no empty variable is defined
    }

    // Carry over unit if applicable
    if ("unit" in currentVar && "unit" in newVar) {
      newVar.unit = currentVar.unit;
    }

    return newVar;
  });
}

export function updateVariableUnit(variableName: string, newUnit: string | undefined | null, setter: RecipeContextType["setVariable"]) {
  setter(variableName, prev => {
    const currentVar = { ...prev };
    if (!currentVar) {
      console.warn(`Variable '${variableName}' does not exist in the recipe`);
      return prev; // Do not update if variable does not exist
    }

    return { ...currentVar, unit: newUnit };
  });
}

export function removeVariable(variableName: string, setter: RecipeContextType["setVariables"]) {
  setter(prev => {
    const newVariables = { ...prev };
    delete newVariables[variableName];

    return newVariables;
  });
}

export function updateScalarVariableValue(variableName: string, newValue: string | number, setter: RecipeContextType["setVariable"]) {
  setter(variableName, prev => {
    const currentVar = { ...prev };
    if (!currentVar) {
      console.warn(`Variable '${variableName}' does not exist in the recipe`);
      return prev; // Do not update if variable does not exist
    }

    if (currentVar.type === RecipeDataTypes.Scalar) {
      let parsedValue: number;
      if (typeof newValue === 'string') {
        parsedValue = parseFloat(newValue);
      }
      else {
        parsedValue = newValue;
      }

      if (!isNaN(parsedValue)) {
        return { ...currentVar, value: parsedValue };
      }
      else {
        console.warn(`Failed to parse '${newValue}' as number`);
        return prev; // Do not update if value is NaN
      }
    }
    else {
      console.warn(`Variable '${variableName}' is not of type Scalar`);
      return prev; // Do not update if the variable is not a scalar
    }
  });
}

export function updateDataSeriesLink(variableName: string, newLink: string | null, setter: RecipeContextType["setVariable"]) {
  setter(variableName, prev => {
    const currentVar = { ...prev };
    if (!currentVar) {
      console.warn(`Variable '${variableName}' does not exist in the recipe`);
      return prev; // Do not update if variable does not exist
    }
    else if (currentVar.type !== RecipeDataTypes.DataSeries) {
      console.warn(`Variable '${variableName}' is not of type DataSeries`);
      return prev; // Do not update if the variable is not a data series
    }

    if (newLink) {
      return {
        ...currentVar,
        link: newLink,
      };
    }
    else {
      // When unselecting, clear variable
      return { ...emptyRecipeDataSeries };
    }
  });
}

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
      if (!isRecipeExternalDatasetSelection(selection)) {
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