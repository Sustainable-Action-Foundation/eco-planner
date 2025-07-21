import { parseArgs } from "node:util";
import "../lib/console";
import { colors } from "../lib/colors";
import type { DataSeriesArray, RawRecipe } from "../../src/functions/recipe-parser/types";
import { parseRecipe, recipeFromUnknown } from "../../src/functions/parseRecipe";

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
export function truncPad(message: string, padLength: number = process.stdout.columns || 80) {
  return trunc(message).padEnd(padLength, " ");
}

/*
parseRecipe Test Module
=======================

This module contains tests for the `parseRecipe` function. It is designed to be modular,
allowing for easy addition of new test cases.

To add a new test:
1. Define your test recipe object.
2. Add a new entry to the `testCases` array with a description, the recipe, and whether it should pass or fail.
*/

const args = parseArgs({
  options: {
    "help": {
      short: "h",
      type: "boolean",
      description: "Show this help message",
      default: false,
    },
    // "failed": {
    //   type: "boolean",
    //   description: "Show only failed tests",
    //   default: false,
    // }
  }
});

if (args.values.help) {
  console.info("Usage: yarn tsx tests/files/recipe-parser.test.ts [--help]");
  console.info("Options:");
  console.info("  --help, -h    Show this help message");
  // console.info("  --failed      Show only failed tests");
  process.exit(0);
}

// Test Case Definitions
// ---------------------

const testBasicRecipe: RawRecipe = {
  eq: "${A} * 3 + ${B}*2 / ${C}",
  variables: {
    A: { type: "vector", value: [43, 44, 45] },
    B: { type: "vector", value: [6, 7, 8] },
    C: { type: "scalar", value: 0.5 },
  },
};

const testMissingVariableRecipe: RawRecipe = {
  eq: "${A} * 3 + ${B}*2 / ${C}",
  variables: {
    A: { type: "vector", value: [43, 44, 45] },
    B: { type: "vector", value: [6, 7, 8] },
    // C is missing
  },
};

const testExtraVariableRecipe: RawRecipe = {
  eq: "${A} * 3 + ${B}*2 / ${C}",
  variables: {
    A: { type: "vector", value: [43, 44, 45] },
    B: { type: "vector", value: [6, 7, 8] },
    C: { type: "scalar", value: 0.5 },
    D: { type: "scalar", value: 10 }, // Extra variable
  },
};

const testInvalidVariableRecipe = {
  eq: "${A} * 3 + ${B}*2 / ${C}",
  variables: {
    A: { type: "vector", value: [43, 44, 45] },
    B: { type: "vector", value: [6, 7, 8] },
    C: { type: "string", value: "0.5" }, // Invalid type
  },
};

const testEmptyRecipe: RawRecipe = {
  eq: "",
  variables: {},
};

const testNoInput = {
  eq: "${A} * 3 + ${B}*2 / ${C}",
};

const testNoEquation = {
  variables: {
    A: { type: "vector", value: [43, 44, 45] },
    B: { type: "vector", value: [6, 7, 8] },
    C: { type: "scalar", value: 0.5 },
  },
};

const testManyVariables: RawRecipe = {
  eq: "${A} + ${B} + ${C} + ${D} + ${E} + ${F} + ${G} + ${H} + ${I} + ${J} + ${K} + ${L} + ${M} + ${N} + ${O} + ${P} + ${Q} + ${R} + ${S} + ${T} + ${U} + ${V} + ${W} + ${X} + ${Y} + ${Z}",
  variables: {
    A: { type: "scalar", value: 1 }, B: { type: "scalar", value: 2 }, C: { type: "scalar", value: 3 }, D: { type: "scalar", value: 4 }, E: { type: "scalar", value: 5 }, F: { type: "scalar", value: 6 }, G: { type: "scalar", value: 7 }, H: { type: "scalar", value: 8 }, I: { type: "scalar", value: 9 }, J: { type: "scalar", value: 10 }, K: { type: "scalar", value: 11 }, L: { type: "scalar", value: 12 }, M: { type: "scalar", value: 13 }, N: { type: "scalar", value: 14 }, O: { type: "scalar", value: 15 }, P: { type: "scalar", value: 16 }, Q: { type: "scalar", value: 17 }, R: { type: "scalar", value: 18 }, S: { type: "scalar", value: 19 }, T: { type: "scalar", value: 20 }, U: { type: "scalar", value: 21 }, V: { type: "scalar", value: 22 }, W: { type: "scalar", value: 23 }, X: { type: "scalar", value: 24 }, Y: { type: "scalar", value: 25 }, Z: { type: "scalar", value: 26 },
  }
}

const testHugeScalar: RawRecipe = {
  eq: "${A} + ${B}",
  variables: {
    A: { type: "scalar", value: Number.MAX_SAFE_INTEGER },
    B: { type: "scalar", value: Number.MAX_SAFE_INTEGER },
  },
};

const testDivideByZero: RawRecipe = {
  eq: "${A} / ${B}",
  variables: {
    A: { type: "scalar", value: 10 },
    B: { type: "scalar", value: 0 }, // This will cause a divide by zero error
  },
};

const testLongVariableNames: RawRecipe = {
  eq: "${veryLongVariableName1} + ${veryLongVariableName2}",
  variables: {
    veryLongVariableName1: { type: "scalar", value: 1 },
    veryLongVariableName2: { type: "scalar", value: 2 },
  },
};

const testBadCharactersInEquation: RawRecipe = {
  eq: "${A} % 3 & ${B} | | $ 7",
  variables: {
    A: { type: "scalar", value: 10 },
    B: { type: "scalar", value: 20 },
  },
};

const testEmptyStringTemplate: RawRecipe = {
  eq: "${}",
  variables: {
    A: { type: "scalar", value: 10 },
    B: { type: "scalar", value: 20 },
  },
};

const testNumberVariableName: RawRecipe = {
  eq: "${5}",
  variables: {
    5: { type: "scalar", value: 10 }, // Invalid variable name
    B: { type: "scalar", value: 20 },
  },
};

const test1800Variables: RawRecipe = {
  eq: new Array(1800).fill(0).map((_, i) => `\${V${i}}`).join("+"),
  variables: Object.fromEntries(
    new Array(1800).fill(0).map((_, i) => [`V${i}`, { type: "scalar", value: i }])
  ),
};

const test3000Variables: RawRecipe = {
  eq: new Array(3000).fill(0).map((_, i) => `\${V${i}}`).join("+"),
  variables: Object.fromEntries(
    new Array(3000).fill(0).map((_, i) => [`V${i}`, { type: "scalar", value: i }])
  ),
};

const testHugeVector: RawRecipe = {
  eq: "${A} * 0.5",
  variables: {
    A: { type: "vector", value: new Array(10000).fill(1) }, // Huge vector
  },
};

const testMixedDataVector: RawRecipe = {
  eq: "${A} * 0.5",
  variables: {
    A: { type: "vector", value: [1, 2, 3, null, undefined, 5, "6", 7] }, // Mixed data types
  },
};

const testInvalidVector: RawRecipe = {
  eq: "${A} * 0.5",
  variables: {
    A: { type: "vector", value: [1, 2, "three", 4, 5] }, // Invalid vector with a string
  },
};

const testNegativeValues: RawRecipe = {
  eq: "${A} + ${B}",
  variables: {
    A: { type: "vector", value: [-1, -2, -3] },
    B: { type: "vector", value: [-4, -5, -6] },
  },
};

const testNegativeVectorValues: RawRecipe = {
  eq: "${A} * 2",
  variables: {
    A: { type: "vector", value: [-1, -2, -3] }, // Negative vector values
  },
};

const testCases = [
  { description: "Basic recipe", recipe: testBasicRecipe, shouldPass: true },
  { description: "Missing variable", recipe: testMissingVariableRecipe, shouldPass: false },
  { description: "Extra variable", recipe: testExtraVariableRecipe, shouldPass: true },
  { description: "Invalid variable", recipe: testInvalidVariableRecipe, shouldPass: false },
  { description: "Empty recipe", recipe: testEmptyRecipe, shouldPass: false },
  { description: "No input", recipe: testNoInput, shouldPass: false },
  { description: "No equation", recipe: testNoEquation, shouldPass: false },
  { description: "Many variables", recipe: testManyVariables, shouldPass: true },
  { description: "Huge scalar", recipe: testHugeScalar, shouldPass: true },
  { description: "Divide by zero", recipe: testDivideByZero, shouldPass: false },
  { description: "Long variable names", recipe: testLongVariableNames, shouldPass: true },
  { description: "Bad characters in equation", recipe: testBadCharactersInEquation, shouldPass: false },
  { description: "Empty string template", recipe: testEmptyStringTemplate, shouldPass: false },
  { description: "Number as variable name", recipe: testNumberVariableName, shouldPass: true },
  { description: "1800 variables", recipe: test1800Variables, shouldPass: true },
  { description: "3000 variables", recipe: test3000Variables, shouldPass: false },
  { description: "Huge vector", recipe: testHugeVector, shouldPass: true },
  { description: "Mixed data vector", recipe: testMixedDataVector, shouldPass: true },
  { description: "Invalid vector", recipe: testInvalidVector, shouldPass: false },
  { description: "Negative values", recipe: testNegativeValues, shouldPass: true },
  { description: "Negative vector values", recipe: testNegativeVectorValues, shouldPass: true },
];

// Test Runner
// -----------

type TestCase = {
  description: string;
  recipe: Partial<RawRecipe> | string;
  shouldPass: boolean;
};

type TestResult = {
  testCase: TestCase;
  passed: boolean;
  warnings: string[];
  errors: string[];
  result: DataSeriesArray | null; // The result of the parseRecipe function
};

const passColor = (text: string) => colors.cyanBrightBG(colors.black(text));
const failColor = (text: string) => colors.rgbBG(200, 0, 0, colors.black(text));
const headerColor = (text: string) => colors.cyanBG(colors.black(text));

function runTest(testCase: TestCase): TestResult {
  const { recipe, shouldPass } = testCase;
  const warnings: string[] = [];
  const errors: string[] = [];
  let passed = false;
  let result: DataSeriesArray | null = null;

  try {
    // Parse and normalize recipes
    const recipeFromObject = parseRecipe(recipe as RawRecipe);
    const recipeFromString = parseRecipe(recipeFromUnknown(JSON.stringify(recipe)));

    // See if they're the same
    if (JSON.stringify(recipeFromObject) !== JSON.stringify(recipeFromString)) {
      throw new Error("Parsed recipes do not match between object and string input.");
    }
    
    const 

    // Beautifully combine the warnings
    warnings.push(...new Set([...recipeFromObject.warnings, ...recipeFromString.warnings]));

    passed = shouldPass; // If no error is thrown, it passes
  } catch (error: any) {
    if (!shouldPass) {
      passed = true; // If it was supposed to fail, we consider it passed      
    } else {
      passed = false; // If it was supposed to pass but failed, we consider it failed
    }
    errors.push(error.stack);
  }

  return { passed, warnings, result, testCase, errors };
}

function runTests() {
  const results: TestResult[] = [];

  for (const testCase of testCases) {
    // Header
    console.debug(headerColor(truncPad(`Running - ${testCase.description} - ${testCase.shouldPass ? "should pass" : "should fail"}`)));

    // @ts-expect-error - the types are wrong in some cases
    const testResult = runTest(testCase);
    const { passed, result, errors, warnings } = testResult;

    results.push(testResult);

    if (passed) console.debug(passColor(truncPad("Passed")));
    else console.debug(failColor(truncPad("Failed")));

    // Deets
    if (result) {
      console.debug("Data series:", JSON.stringify(result));
    } else {
      console.debug("Data series: None (early exit)");
    }

    // Warnings
    if (warnings.length > 0) {
      console.debug("Warnings:");
      warnings.forEach(warning => console.debug(colors.yellow(` - ${warning}`)));
    } else {
      console.debug("Warnings: None");
    }

    // Errors
    if (errors.length > 0) {
      console.debug("Errors:");
      if (passed) errors.forEach(error => console.debug(` - ${error}`));
      else errors.forEach(error => console.debug(colors.red(` - ${error}`)));
    } else {
      console.debug("Errors: None");
    }

    console.debug("\n");
  }

  // Summary
  const total = results.length;
  const passedCount = results.filter(r => r.passed).length;
  const failedCount = total - passedCount;

  const passedNames = results.filter(r => r.passed).map(r => r.testCase.description);
  const failedCases = results.filter(r => !r.passed);

  console.debug(headerColor(truncPad(`Summary: passed=${passedCount}, failed=${failedCount}, ${passedCount}/${total} tests passed`)));
  console.debug(`Passed(${passedCount}): ${passedNames.length > 0 ? passedNames.join(", ") : "None"}`);
  if (failedCount > 0) {
    console.debug(colors.red(`Failed(${failedCount}):`));
    failedCases.forEach(testRes => console.debug(colors.red(` - ${testRes.testCase.description}  ${colors.gray(testRes.errors.map(e => e.split("\n")[0]).join(", "))}`)));
  }
  else {
    console.debug(colors.red("Failed: None"));
  }
  console.debug("\n");
}

runTests();