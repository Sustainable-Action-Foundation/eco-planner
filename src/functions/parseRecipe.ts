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
  if (
    typeof recipe !== "object"
    || !recipe.eq
    || !recipe.inputs
    || typeof recipe.eq !== "string"
    || typeof recipe.inputs !== "object"
    || Array.isArray(recipe.inputs)
    || Object.keys(recipe.inputs).length === 0
    || Object.values(recipe.inputs).some(
      input => typeof input !== "object" || !input.type || !input.value
        || (input.type !== "scalar" && input.type !== "vector")
        || (input.type === "scalar" && typeof input.value !== "number")
        || (input.type === "vector" && Array.isArray(input.value) && !input.value.every(v => typeof v === "number")
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

const testEmptyRecipe: Recipe = {
  eq: "",
  inputs: {},
};

const testNoInput = {
  eq: "${A} * 3 + ${B}*2 / ${C}",
};

const testNoEquation = {
  inputs: {
    A: { type: "vector", value: [43, 44, 45] },
    B: { type: "vector", value: [6, 7, 8] },
    C: { type: "scalar", value: 0.5 },
  },
};

const failed = [];
const passed = [];

// Basic recipe test
console.info(colors.grayBG(colors.white((" Basic recipe test:".padEnd(process.stdout.columns || 40)))));
try {
  console.log("Parsing basic recipe...");
  parseRecipe(testBasicRecipe);
  console.log("Parsing basic recipe... (string)");
  parseRecipe(JSON.stringify(testBasicRecipe));

  console.info(colors.green("\nBasic recipe passed"));
  passed.push("Basic recipe");
}
catch (error) {
  console.error("\nBasic recipe failed:", error);
  failed.push("Basic recipe");
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
  failed.push("Missing variable recipe");
}
catch (error: any) {
  console.info(colors.rgb(150, 50, 50, "\n" + error.stack));
  console.info(colors.green("\nMissing variable recipe failed as expected"));
  passed.push("Missing variable recipe");
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
  passed.push("Extra variable recipe");
}
catch (error) {
  console.error("\nExtra variable recipe failed:", error);
  failed.push("Extra variable recipe");
}
console.log("");

// Invalid variable recipe test
console.info(colors.grayBG(colors.white(" Invalid variable recipe test:".padEnd(process.stdout.columns || 40))));
try {
  console.log("Parsing invalid variable recipe...");
  parseRecipe(testInvalidVariableRecipe as unknown as Recipe);
  console.log("Parsing invalid variable recipe... (string)");
  parseRecipe(JSON.stringify(testInvalidVariableRecipe));

  console.error("\nInvalid variable recipe should have failed but passed");
  failed.push("Invalid variable recipe");
}
catch (error: any) {
  console.info(colors.rgb(150, 50, 50, "\n" + error.stack));
  console.info(colors.green("\nInvalid variable recipe failed as expected"));
  passed.push("Invalid variable recipe");
}
console.log("");

// Empty recipe test
console.info(colors.grayBG(colors.white(" Empty recipe test:".padEnd(process.stdout.columns || 40))));
try {
  console.log("Parsing empty recipe...");
  parseRecipe(testEmptyRecipe);
  console.log("Parsing empty recipe... (string)");
  parseRecipe(JSON.stringify(testEmptyRecipe));

  console.error("\nEmpty recipe should have failed but passed");
  failed.push("Empty recipe");
}
catch (error: any) {
  console.info(colors.rgb(150, 50, 50, "\n" + error.stack));
  console.info(colors.green("\nEmpty recipe failed as expected"));
  passed.push("Empty recipe");
}
console.log("");

// No input recipe test
console.info(colors.grayBG(colors.white(" No input recipe test:".padEnd(process.stdout.columns || 40))));
try {
  console.log("Parsing no input recipe...");
  parseRecipe(testNoInput as unknown as Recipe);
  console.log("Parsing no input recipe... (string)");
  parseRecipe(JSON.stringify(testNoInput));

  console.error("\nNo input recipe should have failed but passed");
  failed.push("No input recipe");
}
catch (error: any) {
  console.info(colors.rgb(150, 50, 50, "\n" + error.stack));
  console.info(colors.green("\nNo input recipe failed as expected"));
  passed.push("No input recipe");
}
console.log("");

// No equation recipe test
console.info(colors.grayBG(colors.white(" No equation recipe test:".padEnd(process.stdout.columns || 40))));
try {
  console.log("Parsing no equation recipe...");
  parseRecipe(testNoEquation as unknown as Recipe);
  console.log("Parsing no equation recipe... (string)");
  parseRecipe(JSON.stringify(testNoEquation));

  console.error("\nNo equation recipe should have failed but passed");
  failed.push("No equation recipe");
}
catch (error: any) {
  console.info(colors.rgb(150, 50, 50, "\n" + error.stack));
  console.info(colors.green("\nNo equation recipe failed as expected"));
  passed.push("No equation recipe");
}
console.log("");

// Summary
console.info(colors.grayBG(colors.white(" Summary:".padEnd(process.stdout.columns || 40))));
console.info(colors.green(`Passed: ${passed.length} ${colors.gray(`- ${passed.join(", ")}`)}`));
if (failed.length > 0) {
  console.info(colors.red(`Failed: ${failed.length} - ${failed.join(", ")}`));
}
else {
  console.info(colors.gray("Failed: 0"));
}
console.log("");