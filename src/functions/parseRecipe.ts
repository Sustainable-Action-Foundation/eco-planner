import { colors } from "../scripts/lib/colors.ts";
import "../scripts/lib/console.ts";
import crypto from "crypto";

const hash = (input: string) => {
  const hashObject = crypto.createHash("sha256");
  hashObject.update(JSON.stringify(input));
  return hashObject.digest("hex");
};

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

export function parseRecipe(recipe: Recipe | string, options: RecipeParserOptions = defaultRecipeParserOptions) {
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

  // Validate Recipe type
  if (!isValidRecipe(recipe)) {
    // TODO - handle error more gracefully
    throw new Error("Invalid recipe format. Expected an object with 'eq' and 'inputs' properties.");
  }

  // Should be a Recipe type at this point
  recipe = recipe as Recipe;

  console.info("Parsing recipe...", `${colors.green(recipe.eq)} (${colors.gray(hash(JSON.stringify(recipe)))})`);

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

  // TODO - normalize variable names to letters

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

  
}