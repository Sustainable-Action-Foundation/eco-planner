import { colors } from "../scripts/lib/colors.ts";
import "../scripts/lib/console.ts";
import crypto from "crypto";

function hash(input: string) {
  const hashObject = crypto.createHash("sha256");
  hashObject.update(JSON.stringify(input));
  return hashObject.digest("hex");
}

const normalizedVariableNames = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "AA", "AB", "AC", "AD", "AE", "AF", "AG", "AH", "AI", "AJ", "AK", "AL", "AM", "AN", "AO", "AP", "AQ", "AR", "AS", "AT", "AU", "AV", "AW", "AX", "AY", "AZ", "BA", "BB", "BC", "BD", "BE", "BF", "BG", "BH", "BI", "BJ", "BK", "BL", "BM", "BN", "BO", "BP", "BQ", "BR", "BS", "BT", "BU", "BV", "BW", "BX", "BY", "BZ", "CA", "CB", "CC", "CD", "CE", "CF", "CG", "CH", "CI", "CJ", "CK", "CL", "CM", "CN", "CO", "CP", "CQ", "CR", "CS", "CT", "CU", "CV"];
function getVariableName(index: number): string {
  // Try to get a normalized variable name from the predefined list
  if (normalizedVariableNames[index]) {
    return normalizedVariableNames[index];
  }

  // Fallback to calculating a name based on the index
  index = normalizedVariableNames.length; // Start from the end of the predefined list

  // Convert index to a letter (e.g., 0 -> 'A', 1 -> 'B', ..., 25 -> 'Z', 26 -> 'AA', etc.)
  let name = "";
  let i = index;
  do {
    name = String.fromCharCode((i % 26) + 65) + name; // 65 is ASCII code for 'A'
    i = Math.floor(i / 26) - 1; // Adjust for zero-based index
  } while (i >= 0);
  return name;
}

export type Recipe = {
  eq: string;
  inputs: Record<string, { type: "scalar" | "vector" | "url"; value: number | number[] | string }>;
};

export type RecipeParserOptions = {
  interpolationMethod: "interpolate all" | "only overlapping";
};
const defaultRecipeParserOptions: RecipeParserOptions = {
  interpolationMethod: "interpolate all",
}

function isValidRecipe(recipe: any): recipe is Recipe {
  return (
    // Basic structure checks
    typeof recipe === "object"
    && typeof recipe.eq === "string"
    && typeof recipe.inputs === "object"

    // Equation checks
    && recipe.eq.trim() !== ""
    && recipe.eq.match(/\$\{(\w+)\}/g) !== null // Contains at least one variable

    // Inputs checks
    && !Array.isArray(recipe.inputs) // It's an object, not an array
    && Object.keys(recipe.inputs).length > 0 // Has at least one input
    && Object.values(recipe.inputs).every(input =>
      !!input
      && typeof input === "object"
      && typeof (input as any).type === "string"
      && ["scalar", "vector", "url"].includes((input as any).type)
      && ((input as any).type !== "scalar" || (typeof (input as any).value === "number" && isFinite((input as any).value)))
      && ((input as any).type !== "vector" || (Array.isArray((input as any).value) && (input as any).value.every((v: any) => typeof v === "number")))
      && ((input as any).type !== "url" || (typeof (input as any).value === "string" && (input as any).value.trim() !== ""))
    )
  )
}

const allowedEqCharacters = /^[\w\s\+\-\*\/\(\)]+$/; // Allowed characters in the equation
function isValidEquationSyntax(equation: string): boolean {
  const validStructure = (
    typeof equation === "string"
    && equation.trim() !== ""
    && equation.match(/\$\{(\w+)\}/g) !== null // Contains at least one variable

    && allowedEqCharacters.test(equation.replace(/\$\{(\w+)\}/g, "X")) // Only contains allowed characters
  );
  if (!validStructure) return false;

  // Syntax checks

  // General syntax is: value operator value [operator value]*
  // where value can be a variable, or scalar and operator can be +, -, /, *

  // 1. Split the equation by tokens. Space between values and operators is optional.
  const tokens = equation.split(/(\s*[\+\-\*\/]\s*)/).map(token => token.trim()).filter(token => token !== "");
  const operatorTokens = tokens.filter(token => ["+", "-", "*", "/"].includes(token));
  const valueTokens = tokens.filter(token => !["+", "-", "*", "/"].includes(token));

  // 2. Check if there is at least one value
  if (valueTokens.length === 0) {
    console.error("Invalid equation syntax: Equation must contain at least one value.");
    return false;
  }

  // 3. Check if the first and last tokens are values (not operators)
  if (valueTokens[0] !== tokens[0] || valueTokens[valueTokens.length - 1] !== tokens[tokens.length - 1]) {
    console.error("Invalid equation syntax: Equation must start and end with a value.");
    return false;
  }

  // 4. Check if there are no consecutive operators
  for (let i = 0; i < tokens.length - 1; i++) {
    if (["+", "-", "*", "/"].includes(tokens[i]) && ["+", "-", "*", "/"].includes(tokens[i + 1])) {
      console.error("Invalid equation syntax: Equation cannot have consecutive operators.");
      return false;
    }
  }

  // 5. Check if all values are valid variables (e.g., ${A}, ${B}) or numbers
  for (const token of valueTokens) {
    if (!/^(\$\{\w+\}|-?\d+(\.\d+)?)$/.test(token)) {
      console.error(`Invalid equation syntax: Invalid value token "${token}". Expected a variable (e.g., \${A}), a number, or a vector.`);
      // Check if token is a variable (e.g., ${A}), a number, or a vector
      return false;
    }
  }

  // 6. Check if all operators are valid
  for (const token of operatorTokens) {
    if (!["+", "-", "*", "/"].includes(token)) {
      console.error(`Invalid equation syntax: Invalid operator "${token}". Expected one of +, -, *, /.`);
      return false;
    }
  }


  return true;
}

/** 
 * Returns the resulting vector of the recipe equation as a string array.
 */
export function parseRecipe(recipe: Recipe | string, options: RecipeParserOptions = defaultRecipeParserOptions): string[] {
  // Validate JSON
  try {
    if (typeof recipe === "string") {
      console.log("Provided recipe is a string, parsing JSON...");
      recipe = JSON.parse(recipe);
    }
    else {
      JSON.parse(JSON.stringify(recipe));
    }
  }
  catch (error) {
    // TODO - handle error more gracefully
    throw new Error("Invalid JSON format for recipe");
  }
  // At this point reading it as a Recipe type should be safe even thought it might not contain all the properties
  recipe = recipe as Recipe;

  console.info("Parsing recipe...", `${colors.green(recipe.eq)} (${colors.gray(hash(JSON.stringify(recipe)))})`);

  // Validate Recipe type
  if (!isValidRecipe(recipe)) {
    // TODO - handle error more gracefully
    throw new Error("Invalid recipe format. Expected an object with 'eq' and 'inputs' properties.");
  }

  // Validate equation syntax
  if (!isValidEquationSyntax(recipe.eq)) {
    // TODO - handle error more gracefully
    throw new Error("Invalid equation syntax. Expected a non-empty string with at least one variable.");
  }

  // Extract variables from the equation
  const variables = recipe.eq.match(/\$\{(\w+)\}/g);
  const definedVariables = Object.keys(recipe.inputs);
  if (!variables) {
    // TODO - handle error more gracefully
    throw new Error("No variables found in the equation");
  }
  const missingVariables = variables.map(v => v.replace(/\$\{|\}/g, "")).filter(v => !definedVariables.includes(v));
  if (missingVariables.length > 0) {
    // TODO - handle error more gracefully
    throw new Error(`Missing variables in the equation: ${missingVariables.join(", ")}`);
  }
  const extraVariables = definedVariables.filter(v => !variables.includes(`\${${v}}`));
  if (extraVariables.length > 0) {
    console.warn(`Extra variables defined but not used in the equation: ${extraVariables.join(", ")}`);
  }

  // Normalize variable names to letters
  const renameMap: Record<string, string> = Object.fromEntries(Object.keys(recipe.inputs).map((key, index) => [`${key}`, getVariableName(index)]));
  recipe.eq = recipe.eq.replace(/\$\{(\w+)\}/g, (_, varName) => {
    if (renameMap[varName]) {
      return `\${${renameMap[varName]}}`;
    }
    return `\${${varName}}`; // Fallback to original variable name if not found
  });
  recipe.inputs = Object.fromEntries(Object.entries(recipe.inputs).map(([key, input]) => {
    if (!renameMap[key]) {
      console.warn("Variable name not found in rename map:", key);
    }
    const normalizedKey = renameMap[key] || key; // Use the normalized name or fallback
    return [normalizedKey, input];
  }));

  // Validate inputs
  const vectors = Object.entries(recipe.inputs).filter(([_, input]) => input.type === "vector");
  const scalars = Object.entries(recipe.inputs).filter(([_, input]) => input.type === "scalar");
  const urls = Object.entries(recipe.inputs).filter(([_, input]) => input.type === "url");

  if (vectors.some(([_, input]) => !Array.isArray(input.value) || input.value.some(v => typeof v !== "number"))) {
    // TODO - handle error more gracefully
    throw new Error("Invalid vector input. Expected an array of numbers.");
  }
  if (scalars.some(([_, input]) => typeof input.value !== "number" || !isFinite(input.value))) {
    // TODO - handle error more gracefully
    throw new Error("Invalid scalar input. Expected a finite number.");
  }
  if (urls.some(([_, input]) => typeof input.value !== "string" || input.value.trim() === "" || !URL.canParse(input.value))) {
    // TODO - handle error more gracefully
    throw new Error("Invalid URL input. Expected a non-empty string.");
  }

  // Warn about sketchy inputs such as huge scalars or vectors and divide by zero
  const hugeScalar = scalars.some(([_, input]) => Math.abs(input.value as number) > 1e12);
  if (hugeScalar) {
    console.warn("Warning: Recipe contains huge scalar values, which may lead to performance issues or overflow errors.");
  }
  const hugeVector = vectors.some(([_, input]) => (input.value as number[]).some(v => Math.abs(v) > 1e12));
  if (hugeVector) {
    console.warn("Warning: Recipe contains huge vector values, which may lead to performance issues or overflow errors.");
  }
  const longVector = vectors.some(([_, input]) => (input.value as number[]).length > 50); // Data series should not be this long
  if (longVector) {
    console.warn("Warning: Recipe contains long vectors. Why?");
  }
  const divideByZero = scalars.some(([_, input]) => input.value === 0 && recipe.eq.includes(`\${${_}}`));
  if (divideByZero) {
    console.warn("Warning: Recipe contains a zero, which may result in an error during evaluation.");
  }


  return ["1", "2", "3"]; // Placeholder for the actual recipe evaluation logic
}