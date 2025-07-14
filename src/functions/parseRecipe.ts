import mathjs from "@/math.ts";
import "../scripts/lib/console.ts";
import crypto from "crypto";

/** Truncates a message to fit within the terminal width, adding ellipses and excess length information if necessary. */
export function trunc(message: string) {
  const maxLength = process.stdout.columns || 80; // Default to 80 if columns is not defined
  if (message.length > maxLength) {
    const ellipses = "... "
    const excessLength = message.length - maxLength;
    const excessMarker = `(${excessLength}) `
    return message.slice(0, maxLength - ellipses.length - excessMarker.length) + ellipses + excessMarker;
  }
  return message;
}

/** Used when saving recipes into the database */
function hashRecipe(input: string) {
  const hashObject = crypto.createHash("sha256");
  hashObject.update(JSON.stringify(input));
  return hashObject.digest("hex");
}

/** Predefined variable names for normalization. */
const normalizedVariableNames = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "AA", "AB", "AC", "AD", "AE", "AF", "AG", "AH", "AI", "AJ", "AK", "AL", "AM", "AN", "AO", "AP", "AQ", "AR", "AS", "AT", "AU", "AV", "AW", "AX", "AY", "AZ", "BA", "BB", "BC", "BD", "BE", "BF", "BG", "BH", "BI", "BJ", "BK", "BL", "BM", "BN", "BO", "BP", "BQ", "BR", "BS", "BT", "BU", "BV", "BW", "BX", "BY", "BZ", "CA", "CB", "CC", "CD", "CE", "CF", "CG", "CH", "CI", "CJ", "CK", "CL", "CM", "CN", "CO", "CP", "CQ", "CR", "CS", "CT", "CU", "CV"];
function getVariableName(index: number): string {
  // Try to get a normalized variable name from the predefined list
  if (normalizedVariableNames[index]) {
    return normalizedVariableNames[index];
  }

  const maxTries = 1000; // Limit to prevent infinite loop
  let tries = 0;

  // Fallback to calculating a name based on the index
  index = normalizedVariableNames.length + index; // Start from the end of the predefined list  

  // Convert index to a letter (e.g., 0 -> 'A', 1 -> 'B', ..., 25 -> 'Z', 26 -> 'AA', etc.)
  let name = "";
  let i = index;
  do {
    if (tries++ > maxTries) {
      throw new Error("Too many tries to generate a variable name, something is wrong.");
    }

    name = String.fromCharCode((i % 26) + 65) + name; // 65 is ASCII code for 'A'
    i = Math.floor(i / 26) - 1; // Adjust for zero-based index
  } while (i >= 0);
  return name;
}

export class RecipeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}
export class RecipeInvalidFormatError extends RecipeError { }
export class RecipeEquationError extends RecipeError { }
export class RecipeVariablesError extends RecipeError { }

export type Recipe = {
  eq: string;
  variables: Record<string, { type: "scalar" | "vector" | "url"; value: number | number[] | string }>;
};

export type RecipeParseResult = {
  result: string[];
  warnings: string[];
};

export type RecipeParserOptions = {
  interpolationMethod: "interpolate all" | "only overlapping" | "zero fill" | "none";
};
const defaultRecipeParserOptions: RecipeParserOptions = {
  interpolationMethod: "interpolate all",
}

function validateRecipeType(recipe: Recipe | string): Recipe {
  // Validate JSON
  if (typeof recipe === "string") {
    try {
      console.log("Provided recipe is a string, parsing JSON...");
      recipe = JSON.parse(recipe);
    }
    catch (error) {
      throw new Error("Invalid JSON format for recipe");
    }
  }

  // At this point reading it as a Recipe type should be safe even thought it might not contain all the properties
  const r = recipe as Recipe;

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
        if (!Array.isArray(variable.value) || !variable.value.every(v => typeof v === "number" && isFinite(v))) {
          throw new RecipeVariablesError(`Invalid vector value for '${key}'. Expected an array of finite numbers.`);
        }
        break;
      case "url":
        if (typeof variable.value !== "string" || variable.value.trim() === "" || !URL.canParse(variable.value)) {
          throw new RecipeVariablesError(`Invalid URL value for '${key}'. Expected a valid URL string.`);
        }
        break;
      default:
        throw new RecipeVariablesError(`Invalid variable type for '${key}'. Expected 'scalar', 'vector', or 'url'.`);
    }
  }

  return r;
}

export function normalizeRecipe(recipe: Recipe | string, warnings: string[] = []): Recipe {
  recipe = validateRecipeType(recipe);

  // Normalize variable names
  const renameMap: Record<string, string> = Object.fromEntries(Object.keys(recipe.variables).map((key, index) => [`${key}`, getVariableName(index)]));
  recipe.eq = recipe.eq.replace(/\$\{([\w-]+)\}/g, (_, varName) => {
    if (renameMap[varName]) {
      return `\${${renameMap[varName]}}`;
    }
    return `\${${varName}}`; // Fallback to original variable name if not found
  });
  recipe.variables = Object.fromEntries(Object.entries(recipe.variables).map(([key, variable]) => {
    if (!renameMap[key]) warnings.push(`Variable name not found in rename map: ${key}`);
    const normalizedKey = renameMap[key] || key; // Use the normalized name or fallback
    return [normalizedKey, variable];
  }));

  return recipe;
}

/**
 * Returns the resulting vector of the recipe equation as a string array.
 */
export function parseRecipe(recipe: Recipe | string, options: RecipeParserOptions = defaultRecipeParserOptions): RecipeParseResult {
  const warnings: string[] = [];
  const normalizedRecipe = normalizeRecipe(recipe, warnings);

  console.log(trunc(`Parsing recipe... ${normalizedRecipe.eq}`));

  // Extract variables from the equation
  const variables = normalizedRecipe.eq.match(/\$\{([\w-]+)\}/g);
  const definedVariables = Object.keys(normalizedRecipe.variables);
  if (!variables) {
    // This should be caught by validateRecipeType, but as a safeguard:
    throw new RecipeEquationError("No variables found in the equation");
  }
  const missingVariables = variables.map(v => v.replace(/\$\{|\}/g, "")).filter(v => !definedVariables.includes(v));
  if (missingVariables.length > 0) {
    throw new RecipeVariablesError(`Missing variables in the equation: ${missingVariables.join(", ")}`);
  }
  const extraVariables = definedVariables.filter(v => !variables.includes(`\${${v}}`));
  if (extraVariables.length > 0) {
    warnings.push(`Extra variables defined but not used in the equation: ${extraVariables.join(", ")}`);
  }

  const vectors = Object.entries(normalizedRecipe.variables).filter(([, variable]) => variable.type === "vector");
  const scalars = Object.entries(normalizedRecipe.variables).filter(([, variable]) => variable.type === "scalar");
  // TODO - see if any sanity checks can be done on URLs
  // const urls = Object.entries(recipe.variables).filter(([, variable]) => variable.type === "url");

  // Warn about sketchy variables such as huge scalars or vectors and divide by zero
  const hugeScalar = scalars.some(([, variable]) => Math.abs(variable.value as number) > 1e12);
  if (hugeScalar) {
    warnings.push("Recipe contains huge scalar values, which may lead to performance issues or overflow errors.");
  }
  const hugeVector = vectors.some(([, variable]) => (variable.value as number[]).some(v => Math.abs(v) > 1e12));
  if (hugeVector) {
    warnings.push("Recipe contains huge vector values, which may lead to performance issues or overflow errors.");
  }
  const longVector = vectors.some(([, variable]) => (variable.value as number[]).length > 50); // Data series should not be this long
  if (longVector) {
    warnings.push("Recipe contains very long vectors. Why?");
  }
  const divideByZero = scalars.some(([key, variable]) => variable.value === 0 && new RegExp(`\\/\\s*\\$\\{${key}\\}`).test(normalizedRecipe.eq));
  if (divideByZero) {
    warnings.push("Recipe contains a division by a scalar with value zero, which may result in an error during evaluation.");
  }

  const resolvedEquation = normalizedRecipe.eq.replace(/\$\{(\w+)\}/g, (_, varName) => {
    if (normalizedRecipe.variables[varName]) {
      const variable = normalizedRecipe.variables[varName];
      if (variable.type === "scalar") {
        return variable.value.toString();
      } else if (variable.type === "vector") {
        return `[${(variable.value as number[]).join(",")}]`; // Convert vector to a string representation
      } else if (variable.type === "url") {
        return `"${variable.value}"`; // Convert URL to a string representation
      }
    }
    return `\${${varName}}`; // Fallback to original variable name if not found
  });

  console.log(trunc(`Resolved equation: ${resolvedEquation}`));

  const result: number | math.Matrix = mathjs.evaluate(resolvedEquation);

  if (typeof result === "number" && !Number.isFinite(result)) {
    throw new RecipeEquationError("Result is not a finite number.");
  }

  if (typeof result === "number") {
    return { result: [result.toString()], warnings };
  }
  if (mathjs.isMatrix(result)) {
    const data = result.toArray();
    if (Array.isArray(data)) {
      return { result: data.flat().map(v => v.toString()), warnings };
    }
  }

  throw new RecipeError("Unexpected result type. Expected a number or an array of numbers.");
}