import { RecipeEquationError, RecipeInvalidFormatError, RecipeVariablesError } from "./errors";
import { UnparsedRecipe } from "./types";

export function validateRecipeType(recipe: UnparsedRecipe | string): UnparsedRecipe {
  // Validate JSON
  if (typeof recipe === "string") {
    try {
      recipe = JSON.parse(recipe);
    }
    catch (error) {
      throw new Error("Invalid JSON format for recipe");
    }
  }

  // At this point reading it as a Recipe type should be safe even thought it might not contain all the properties
  const r = recipe as UnparsedRecipe;

  // Validate Recipe type
  if (!r) {
    throw new RecipeInvalidFormatError("Recipe is undefined or null.");
  }
  // Has props
  if (typeof r !== "object" || !r.eq || !r.variables) {
    throw new RecipeInvalidFormatError("Invalid recipe format. Expected an object with 'eq' and 'variables' properties.");
  }
  // Non-empty equation
  if (typeof r.eq !== "string" || r.eq.trim() === "") {
    throw new RecipeEquationError(`Invalid equation format. Expected a non-empty string. (${r.eq})`);
  }
  // At least one variable in the equation
  if (r.eq.match(/\$\{([\w-]+)\}/g) === null) {
    throw new RecipeEquationError(`Invalid equation format. Expected at least one variable in the form \${variable}. (${r.eq})`);
  }
  // Variables should be a non-empty object
  if (typeof r.variables !== "object" || Array.isArray(r.variables) || Object.keys(r.variables).length === 0) {
    throw new RecipeVariablesError(`Invalid variables format. Expected a non-empty object where keys are variable names and values are objects, see type definitions. ${JSON.stringify(r.variables, null, 2)}`);
  }
  // Variable types should be valid
  for (const key in r.variables) {
    const variable = r.variables[key];
    if (!variable || typeof variable !== "object") {
      throw new RecipeVariablesError(`Invalid variable for '${key}'. Expected an object.`);
    }
    if (!("type" in variable) || !("value" in variable)) {
      throw new RecipeVariablesError(`Invalid variable for '${key}'. Expected 'type' and 'value' properties.`);
    }
    switch (variable.type) {
      case "scalar":
        if (typeof variable.value !== "number" || !isFinite(variable.value)) {
          throw new RecipeVariablesError(`Invalid scalar value for '${key}'. Expected a finite number.`);
        }
        break;
      case "vector":
        if (!Array.isArray(variable.value) || !variable.value.every(v => v === null || v === undefined || (typeof v === "number" && isFinite(v)) || (typeof v === "string" && isFinite(parseFloat(v))))) {
          throw new RecipeVariablesError(`Invalid vector value for '${key}'. Expected an array of finite numbers, nulls, or numeric strings.`);
        }
        break;
      case "url":
        if (typeof variable.value !== "string" || variable.value.trim() === "" || !URL.canParse(variable.value)) {
          throw new RecipeVariablesError(`Invalid URL value for '${key}'. Expected a valid URL string.`);
        }
        break;
      case "dataSeries":
        if (typeof variable.value !== "object" || Array.isArray(variable.value) || Object.keys(variable.value).length === 0 || !Object.values(variable.value).every(v => typeof v === "number" && isFinite(v) || v === null)) {
          throw new RecipeVariablesError(`Invalid data series value for '${key}'. Expected an object with year keys and finite number values or null.`);
        }
        break;
      case "externalDataset":
        if (typeof variable.value !== "object" || !("dataset" in variable.value) || !("tableId" in variable.value) || !("variableId" in variable.value) ||
          typeof variable.value.dataset !== "string" || typeof variable.value.tableId !== "string" || typeof variable.value.variableId !== "string") {
          throw new RecipeVariablesError(`Invalid external dataset value for '${key}'. Expected an object with 'dataset', 'tableId', and 'variableId' properties.`);
        }
        break;
      default:
        throw new RecipeVariablesError(`Invalid variable type for '${key}'. Expected 'scalar', 'vector', or 'url'.`);
    }
  }

  return r;
}
