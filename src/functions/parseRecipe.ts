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
    || Object.values(recipe.inputs).some(input =>
      typeof input !== "object"
      || !input.type
      || !input.value
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

const testManyInputs: Recipe = {
  eq: "${A} + ${B} + ${C} + ${D} + ${E} + ${F} + ${G} + ${H} + ${I} + ${J} + ${K} + ${L} + ${M} + ${N} + ${O} + ${P} + ${Q} + ${R} + ${S} + ${T} + ${U} + ${V} + ${W} + ${X} + ${Y} + ${Z}",
  inputs: {
    A: { type: "scalar", value: 1 },
    B: { type: "scalar", value: 2 },
    C: { type: "scalar", value: 3 },
    D: { type: "scalar", value: 4 },
    E: { type: "scalar", value: 5 },
    F: { type: "scalar", value: 6 },
    G: { type: "scalar", value: 7 },
    H: { type: "scalar", value: 8 },
    I: { type: "scalar", value: 9 },
    J: { type: "scalar", value: 10 },
    K: { type: "scalar", value: 11 },
    L: { type: "scalar", value: 12 },
    M: { type: "scalar", value: 13 },
    N: { type: "scalar", value: 14 },
    O: { type: "scalar", value: 15 },
    P: { type: "scalar", value: 16 },
    Q: { type: "scalar", value: 17 },
    R: { type: "scalar", value: 18 },
    S: { type: "scalar", value: 19 },
    T: { type: "scalar", value: 20 },
    U: { type: "scalar", value: 21 },
    V: { type: "scalar", value: 22 },
    W: { type: "scalar", value: 23 },
    X: { type: "scalar", value: 24 },
    Y: { type: "scalar", value: 25 },
    Z: { type: "scalar", value: 26 },
  }
}

const testPassthroughRecipe: Recipe = {
  eq: "${A}",
  inputs: {
    A: { type: "vector", value: [23, 1543, 123243, 223] },
  },
};

const testLongVectorRecipe: Recipe = {
  eq: "${A} + ${B}",
  inputs: {
    A: { type: "vector", value: Array.from({ length: 1000 }, (_, i) => i + 1) },
    B: { type: "vector", value: Array.from({ length: 1000 }, (_, i) => i + 1001) },
  },
};

const testHugeScalarRecipe: Recipe = {
  eq: "${A} + ${B}",
  inputs: {
    A: { type: "scalar", value: 1e12 },
    B: { type: "scalar", value: 2e12 },
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

// Many inputs recipe test
console.info(colors.grayBG(colors.white(" Many inputs recipe test:".padEnd(process.stdout.columns || 40))));
try {
  console.log("Parsing many inputs recipe...");
  parseRecipe(testManyInputs);
  console.log("Parsing many inputs recipe... (string)");
  parseRecipe(JSON.stringify(testManyInputs));

  console.info(colors.green("\nMany inputs recipe passed"));
  passed.push("Many inputs recipe");
}
catch (error) {
  console.error("\nMany inputs recipe failed:", error);
  failed.push("Many inputs recipe");
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