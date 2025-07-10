import "../scripts/lib/console.ts";
import { colors } from "../scripts/lib/colors.ts";
import crypto from "crypto";

const hash = (input: string) => {
  const hashObject = crypto.createHash("sha256");
  hashObject.update(JSON.stringify(input));
  return hashObject.digest("hex");
};

export type Recipe = {
  eq: string;
  inputs: Record<string, { type: "scalar" | "vector"; value: number | number[] }>;
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
  if (typeof recipe !== "object" || !recipe.eq || !recipe.inputs || typeof recipe.eq !== "string" || typeof recipe.inputs !== "object") {
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

/* 
 * Validation
 */
const testBasicRecipe: Recipe = {
  eq: "${A} * 3 + ${B}*2 / ${C}",
  inputs: {
    A: { type: "vector", value: [43, 44, 45] },
    B: { type: "vector", value: [6, 7, 8] },
    C: { type: "scalar", value: 0.5 },
  },
};

const testMissingVariableRecipe: Recipe = {
  eq: "${A} * 3 + ${B}*2 / ${C}",
  inputs: {
    A: { type: "vector", value: [43, 44, 45] },
    B: { type: "vector", value: [6, 7, 8] },
    // C is missing
  },
};

const testExtraVariableRecipe: Recipe = {
  eq: "${A} * 3 + ${B}*2 / ${C}",
  inputs: {
    A: { type: "vector", value: [43, 44, 45] },
    B: { type: "vector", value: [6, 7, 8] },
    C: { type: "scalar", value: 0.5 },
    D: { type: "scalar", value: 10 }, // Extra variable
  },
};

const testInvalidVariableRecipe = {
  eq: "${A} * 3 + ${B}*2 / ${C}",
  inputs: {
    A: { type: "vector", value: [43, 44, 45] },
    B: { type: "vector", value: [6, 7, 8] },
    C: { type: "string", value: "0.5" }, // Invalid type
  },
};

// Basic recipe test
console.info(colors.grayBG(colors.white((" Basic recipe test:".padEnd(process.stdout.columns || 40)))));
try {
  console.log("Parsing basic recipe...");
  parseRecipe(testBasicRecipe);
  console.log("Parsing basic recipe... (string)");
  parseRecipe(JSON.stringify(testBasicRecipe));

  console.info(colors.green("\nBasic recipe passed"));
}
catch (error) {
  console.error("\nBasic recipe failed:", error);
}
console.log("");

// Missing variable recipe test
console.info(colors.grayBG(colors.white(" Missing variable recipe test:".padEnd(process.stdout.columns || 40))));
try {
  console.log("Parsing missing variable recipe...");
  parseRecipe(testMissingVariableRecipe);
  console.log("Parsing missing variable recipe... (string)");
  parseRecipe(JSON.stringify(testMissingVariableRecipe));
  console.error("\nMissing variable recipe should have failed but passed");
}
catch (error: any) {
  console.info(colors.rgb(150, 50, 50, "\n" + error.stack));
  console.info(colors.green("\nMissing variable recipe failed as expected"));
}
console.log("");

// Extra variable recipe test
console.info(colors.grayBG(colors.white(" Extra variable recipe test:".padEnd(process.stdout.columns || 40))));
try {
  console.log("Parsing extra variable recipe...");
  parseRecipe(testExtraVariableRecipe);
  console.log("Parsing extra variable recipe... (string)");
  parseRecipe(JSON.stringify(testExtraVariableRecipe));
  console.info(colors.green("\nExtra variable recipe passed"));
}
catch (error) {
  console.error("\nExtra variable recipe failed:", error);
}
console.log("");