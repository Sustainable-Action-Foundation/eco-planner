import "client-only";
import { emptyRecipesByDataType, isRecipeExternalDatasetSelection, Recipe, RecipeDataTypes, RecipeVariable } from "@/functions/recipe-parser/types";
import { DatasetKeys, ExternalDataset } from "@/lib/api/utility";
import { JSONValue } from "@/types";

export function changeName(oldName: string, newName: string, setter: React.Dispatch<React.SetStateAction<Recipe | null>>) {
  setter((prev) => {
    if (!prev) return null;

    if (oldName === newName) {
      return prev; // No change needed
    }

    if (!newName) {
      console.warn("Variable name cannot be empty");
      return prev; // Do not update if new name is empty
    }

    const copyOfVariables = { ...prev.variables };

    const variableContent = copyOfVariables[oldName];
    if (!variableContent) {
      console.warn(`Variable '${oldName}' does not exist in the recipe`);
      return prev; // Do not update if variable does not exist
    }

    // Copy the variable content to the new name
    copyOfVariables[newName] = { ...variableContent };
    // Remove the old variable name
    delete copyOfVariables[oldName];

    return { ...prev, variables: copyOfVariables };
  });
}

export function changeType(name: string, newType: string, setter: React.Dispatch<React.SetStateAction<Recipe | null>>) {
  setter(prev => {
    if (!prev) return null;

    const copyOfVariables = { ...prev.variables };

    const currentVar = copyOfVariables[name];
    if (!currentVar) {
      console.warn(`Variable '${name}' does not exist in the recipe`);
      return prev; // Do not update if variable does not exist
    }

    if (!newType || !Object.values(RecipeDataTypes).includes(newType as RecipeDataTypes)) {
      console.warn(`Data type '${newType}' is not a valid RecipeDataType`);
      return prev; // Do not update if the type is invalid
    }

    const newVar = { ...emptyRecipesByDataType[newType as RecipeDataTypes] };
    if (!newVar || !newVar.type || Object.keys(newVar).length === 0) {
      console.warn(`No empty variable defined for data type '${newType}'`);
      return prev; // Do not update if no empty variable is defined
    }

    // Replace old variable with new one and remove its data. TODO: keep as much data as possible
    copyOfVariables[name] = newVar as RecipeVariable;

    return { ...prev, variables: copyOfVariables };
  });
}

export function changeUnit(name: string, newUnit: string | undefined | null, setter: React.Dispatch<React.SetStateAction<Recipe | null>>) {
  setter(prev => {
    if (!prev) return null;

    const copyOfVariables = { ...prev.variables };

    const currentVar = copyOfVariables[name];
    if (!currentVar) {
      console.warn(`Variable '${name}' does not exist in the recipe`);
      return prev; // Do not update if variable does not exist
    }

    copyOfVariables[name] = { ...currentVar, unit: newUnit };

    return { ...prev, variables: copyOfVariables };
  });
}

export function changeScalarValue(name: string, newValue: string | number, setter: React.Dispatch<React.SetStateAction<Recipe | null>>) {
  setter(prev => {
    if (!prev) return null;

    const copyOfVariables = { ...prev.variables };
    const currentVar = copyOfVariables[name];
    if (!currentVar) {
      console.warn(`Variable '${name}' does not exist in the recipe`);
      return prev; // Do not update if variable does not exist
    }

    if (currentVar.type === RecipeDataTypes.Scalar) {
      if (typeof newValue === 'string') {
        newValue = parseFloat(newValue);
      }

      if (!isNaN(newValue)) {
        copyOfVariables[name] = { ...currentVar, value: newValue };
      } else {
        console.warn(`Failed to parse '${newValue}' as number`);
        return prev; // Do not update if value is NaN
      }
    } else {
      return prev; // Do not update if the variable is not a scalar
    }

    return { ...prev, variables: copyOfVariables };
  });
}

export function changeDataSeries(name: string, newDataSeries: string, setter: React.Dispatch<React.SetStateAction<Recipe | null>>) {
  setter(prev => {
    if (!prev) return null;

    if (!newDataSeries) {
      console.warn("No data series selected");
      return prev; // Do not update if no data series is selected
    }

    const copyOfVariables = { ...prev.variables };

    const currentVar = copyOfVariables[name];
    if (!currentVar) {
      console.warn(`Variable '${name}' does not exist in the recipe`);
      return prev; // Do not update if variable does not exist
    } else if (currentVar.type !== RecipeDataTypes.DataSeries) {
      console.warn(`Variable '${name}' is not of type DataSeries`);
      return prev; // Do not update if the variable is not a data series
    }

    copyOfVariables[name] = {
      ...currentVar,
      link: newDataSeries,
    };


    return { ...prev, variables: copyOfVariables };
  });
}

export function changeDataset(name: string, newDataset: string, setter: React.Dispatch<React.SetStateAction<Recipe | null>>) {
  setter(prev => {
    if (!prev) return null;

    const dataset = ExternalDataset[newDataset as keyof typeof ExternalDataset];
    if (!dataset || typeof dataset !== "object" || !("baseUrl" in dataset)) {
      console.warn(`Dataset '${newDataset}' not found`);
      return prev; // Do not update if the dataset is not known
    }

    const copyOfVariables = { ...prev.variables };

    const currentVar = copyOfVariables[name];
    if (!currentVar) {
      console.warn(`Variable '${name}' does not exist in the recipe`);
      return prev; // Do not update if variable does not exist
    } else if (currentVar.type !== RecipeDataTypes.External) {
      console.warn(`Variable '${name}' is not of type External`);
      return prev; // Do not update if the variable is not an external data source
    }

    copyOfVariables[name] = {
      ...currentVar,
      dataset: newDataset as DatasetKeys,
    };

    return { ...prev, variables: copyOfVariables };
  });
}

export function changeTable(name: string, newTable: string, setter: React.Dispatch<React.SetStateAction<Recipe | null>>) {
  setter(prev => {
    if (!prev) return null;

    const copyOfVariables = { ...prev.variables };

    const currentVar = copyOfVariables[name];
    if (!currentVar) {
      console.warn(`Variable '${name}' does not exist in the recipe`);
      return prev; // Do not update if variable does not exist
    } else if (currentVar.type !== RecipeDataTypes.External) {
      console.warn(`Variable '${name}' is not of type External`);
      return prev; // Do not update if the variable is not an external data source
    }

    copyOfVariables[name] = {
      ...currentVar,
      tableId: newTable,
    };

    return { ...prev, variables: copyOfVariables };
  });
}

export function changeExternalSelection(name: string, newSelection: string, setter: React.Dispatch<React.SetStateAction<Recipe | null>>) {
  setter(prev => {
    if (!prev) return null;

    const copyOfVariables = { ...prev.variables };

    const currentVar = copyOfVariables[name];
    if (!currentVar) {
      console.warn(`Variable '${name}' does not exist in the recipe`);
      return prev; // Do not update if variable does not exist
    } else if (currentVar.type !== RecipeDataTypes.External) {
      console.warn(`Variable '${name}' is not of type External`);
      return prev; // Do not update if the variable is not an external data source
    }

    try {
      const selection = JSON.parse(newSelection) as JSONValue;
      if (!isRecipeExternalDatasetSelection(selection)) {
        console.warn("Invalid selection format", selection);
        return prev; // Do not update if selection is invalid
      }
      copyOfVariables[name] = {
        ...currentVar,
        selection: selection,
      };
    } catch (error) {
      console.warn("Failed to parse selection JSON", error);
      return prev; // Do not update if JSON parsing fails
    }

    return { ...prev, variables: copyOfVariables };
  });
}

export function deleteVariable(name: string, setter: React.Dispatch<React.SetStateAction<Recipe | null>>) {
  setter(prev => {
    if (!prev) return null;

    const newVariables = { ...prev.variables };
    delete newVariables[name];

    return { ...prev, variables: newVariables };
  });
}