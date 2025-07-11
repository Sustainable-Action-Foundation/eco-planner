import mathjs from "@/math.ts";
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

export type Recipe = {
  eq: string;
  inputs: Record<string, { type: "scalar" | "vector" | "url"; value: number | number[] | string }>;
};

export type RecipeParserOptions = {
  interpolationMethod: "interpolate all" | "only overlapping" | "zero fill" | "none";
};
const defaultRecipeParserOptions: RecipeParserOptions = {
  interpolationMethod: "interpolate all",
}

function validateRecipeType(recipe: Recipe | string): Recipe {
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

  // Validate Recipe type
  if (!recipe) {
    throw new Error("Recipe is undefined or null.");
  }
  // Has props
  if (typeof recipe !== "object" || !recipe.eq || !recipe.inputs) {
    throw new Error("Invalid recipe format. Expected an object with 'eq' and 'inputs' properties.");
  }
  // Non-empty equation
  if (typeof recipe.eq !== "string" || recipe.eq.trim() === "") {
    throw new Error("Invalid equation format. Expected a non-empty string. (" + recipe.eq + ")");
  }
  // At least one variable in the equation
  if (recipe.eq.match(/\$\{([\w-]+)\}/g) === null) {
    throw new Error("Invalid equation format. Expected at least one variable in the form ${variable}. (" + recipe.eq + ")");
  }
  // Inputs should be a non-empty object
  if (typeof recipe.inputs !== "object" || Array.isArray(recipe.inputs) || Object.keys(recipe.inputs).length === 0) {
    throw new Error("Invalid inputs format. Expected a non-empty object where keys are variable names and values are objects, see type definitions. " + JSON.stringify(recipe.inputs, null, 2));
  }
  // Input types should be valid
  if (!Object.values(recipe.inputs).every(input =>
    !!input
    && typeof input === "object"
    && typeof (input as any).type === "string"
    && ["scalar", "vector", "url"].includes((input as any).type)
    && ((input as any).type !== "scalar" || (typeof (input as any).value === "number" && isFinite((input as any).value)))
    && ((input as any).type !== "vector" || (Array.isArray((input as any).value) && (input as any).value.every((v: any) => typeof v === "number")))
    && ((input as any).type !== "url" || (typeof (input as any).value === "string" && (input as any).value.trim() !== ""))
  )) {
    throw new Error("Invalid inputs format. Expected a non-empty object where keys are variable names and values are objects with type and value properties. " + JSON.stringify(recipe.inputs, null, 2));
  }

  return recipe;
}

export function normalizeRecipe(recipe: Recipe | string): Recipe {
  recipe = validateRecipeType(recipe);

  // Normalize variable names
  const renameMap: Record<string, string> = Object.fromEntries(Object.keys(recipe.inputs).map((key, index) => [`${key}`, getVariableName(index)]));
  recipe.eq = recipe.eq.replace(/\$\{([\w-]+)\}/g, (_, varName) => {
    if (renameMap[varName]) {
      return `\${${renameMap[varName]}}`;
    }
    return `\${${varName}}`; // Fallback to original variable name if not found
  });
  recipe.inputs = Object.fromEntries(Object.entries(recipe.inputs).map(([key, input]) => {
    if (!renameMap[key]) console.warn("Variable name not found in rename map:", key);
    const normalizedKey = renameMap[key] || key; // Use the normalized name or fallback
    return [normalizedKey, input];
  }));

  return recipe;
}

/** 
 * Returns the resulting vector of the recipe equation as a string array.
 */
export function parseRecipe(recipe: Recipe | string, options: RecipeParserOptions = defaultRecipeParserOptions): string[] {
  recipe = normalizeRecipe(recipe);

  console.info("Parsing recipe...", `${colors.green(recipe.eq)} (${colors.gray(hash(JSON.stringify(recipe)))})`);

  // Extract variables from the equation
  const variables = recipe.eq.match(/\$\{([\w-]+)\}/g);
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

  const resolvedEquation = recipe.eq.replace(/\$\{(\w+)\}/g, (_, varName) => {
    if (recipe.inputs[varName]) {
      const input = recipe.inputs[varName];
      if (input.type === "scalar") {
        return input.value.toString();
      } else if (input.type === "vector") {
        return `[${(input.value as number[]).join(",")}]`; // Convert vector to a string representation
      } else if (input.type === "url") {
        return `"${input.value}"`; // Convert URL to a string representation
      }
    }
    return `\${${varName}}`; // Fallback to original variable name if not found
  });

  console.info(`Resolved equation: ${colors.green(resolvedEquation)} (${colors.gray(hash(JSON.stringify({ ...recipe, eq: resolvedEquation })))})`);

  const result: number | math.Matrix = mathjs.evaluate(resolvedEquation);

  if (typeof result === "number" && !isFinite(result)) {
    // TODO - handle error more gracefully
    throw new Error("Result is not a finite number.");
  }

  if (typeof result === "number") {
    return [result.toString()];
  }
  if (mathjs.isMatrix(result)) {
    const data = result.toArray();
    if (Array.isArray(data)) {
      return data.flat().map(v => v.toString());
    }
  }

  throw new Error("Unexpected result type. Expected a number or an array of numbers.");
}