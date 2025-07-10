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
    // TODO - handle error more gracefully
    console.warn(`Extra variables defined but not used in the equation: ${extraVariables.join(", ")}`);
  }



}