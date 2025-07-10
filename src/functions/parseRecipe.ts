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

export function parseRecipe(recipe: Recipe | string) {
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
  if (
    typeof recipe !== "object"
    || !recipe.eq
    || !recipe.inputs
    || typeof recipe.eq !== "string"
    || typeof recipe.inputs !== "object"
    || Array.isArray(recipe.inputs)
    || Object.keys(recipe.inputs).length === 0
    || Object.values(recipe.inputs).some(input =>
      typeof input !== "object" || !input.type || !input.value

      // Has a valid input type
      || (input.type !== "scalar" && input.type !== "vector" && input.type !== "url")

      // Scalar checks
      || (input.type === "scalar" && typeof input.value === "number" && !isFinite(input.value))
      // Vector checks
      || (input.type === "vector" && Array.isArray(input.value) && !input.value.every(v => typeof v === "number")
        // URL checks
        // TODO - @Leon, please add URL validation - Viggo
      ))
  ) {
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
    // TODO - handle error more gracefully
    console.warn(`Extra variables defined but not used in the equation: ${extraVariables.join(", ")}`);
  }



}