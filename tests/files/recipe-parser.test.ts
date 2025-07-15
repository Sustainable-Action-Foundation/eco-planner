/*
parseRecipe Test Module
=======================

This module contains tests for the `parseRecipe` function. It is designed to be modular,
allowing for easy addition of new test cases.

To add a new test:
1. Define your test recipe object.
2. Add a new entry to the `testCases` array with a description, the recipe, and whether it should pass or fail.
*/

import { colors } from "../lib/colors";
import "../lib/console";
import { parseRecipe, UnparsedRecipe, trunc, ParsedRecipe, DataSeries } from "../../src/functions/parseRecipe";
import { parseArgs } from "node:util";

const args = parseArgs({
  options: {
    "help": {
      short: "h",
      type: "boolean",
      description: "Show this help message",
      default: false,
    },
    "failed": {
      type: "boolean",
      description: "Show only failed tests",
      default: false,
    }
  }
});

if (args.values.help) {
  console.info("Usage: yarn tsx tests/files/recipe-parser.test.ts [--help] [--failed]");
  console.info("Options:");
  console.info("  --help, -h    Show this help message");
  console.info("  --failed      Show only failed tests");
  process.exit(0);
}


// Test Case Definitions
// ---------------------

const testBasicRecipe: UnparsedRecipe = {
  eq: "${A} * 3 + ${B}*2 / ${C}",
  variables: {
    A: { type: "vector", value: [43, 44, 45] },
    B: { type: "vector", value: [6, 7, 8] },
    C: { type: "scalar", value: 0.5 },
  },
};

const testMissingVariableRecipe: UnparsedRecipe = {
  eq: "${A} * 3 + ${B}*2 / ${C}",
  variables: {
    A: { type: "vector", value: [43, 44, 45] },
    B: { type: "vector", value: [6, 7, 8] },
    // C is missing
  },
};

const testExtraVariableRecipe: UnparsedRecipe = {
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

const testEmptyRecipe: UnparsedRecipe = {
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

const testManyVariables: UnparsedRecipe = {
  eq: "${A} + ${B} + ${C} + ${D} + ${E} + ${F} + ${G} + ${H} + ${I} + ${J} + ${K} + ${L} + ${M} + ${N} + ${O} + ${P} + ${Q} + ${R} + ${S} + ${T} + ${U} + ${V} + ${W} + ${X} + ${Y} + ${Z}",
  variables: {
    A: { type: "scalar", value: 1 }, B: { type: "scalar", value: 2 }, C: { type: "scalar", value: 3 }, D: { type: "scalar", value: 4 }, E: { type: "scalar", value: 5 }, F: { type: "scalar", value: 6 }, G: { type: "scalar", value: 7 }, H: { type: "scalar", value: 8 }, I: { type: "scalar", value: 9 }, J: { type: "scalar", value: 10 }, K: { type: "scalar", value: 11 }, L: { type: "scalar", value: 12 }, M: { type: "scalar", value: 13 }, N: { type: "scalar", value: 14 }, O: { type: "scalar", value: 15 }, P: { type: "scalar", value: 16 }, Q: { type: "scalar", value: 17 }, R: { type: "scalar", value: 18 }, S: { type: "scalar", value: 19 }, T: { type: "scalar", value: 20 }, U: { type: "scalar", value: 21 }, V: { type: "scalar", value: 22 }, W: { type: "scalar", value: 23 }, X: { type: "scalar", value: 24 }, Y: { type: "scalar", value: 25 }, Z: { type: "scalar", value: 26 },
  }
}

const testHugeScalar: UnparsedRecipe = {
  eq: "${A} + ${B}",
  variables: {
    A: { type: "scalar", value: Number.MAX_SAFE_INTEGER },
    B: { type: "scalar", value: Number.MAX_SAFE_INTEGER },
  },
};

const testDivideByZero: UnparsedRecipe = {
  eq: "${A} / ${B}",
  variables: {
    A: { type: "scalar", value: 10 },
    B: { type: "scalar", value: 0 }, // This will cause a divide by zero error
  },
};

const testLongVariableNames: UnparsedRecipe = {
  eq: "${veryLongVariableName1} + ${veryLongVariableName2}",
  variables: {
    veryLongVariableName1: { type: "scalar", value: 1 },
    veryLongVariableName2: { type: "scalar", value: 2 },
  },
};

const testBadCharactersInEquation: UnparsedRecipe = {
  eq: "${A} % 3 & ${B} | | $ 7",
  variables: {
    A: { type: "scalar", value: 10 },
    B: { type: "scalar", value: 20 },
  },
};

const testEmptyStringTemplate: UnparsedRecipe = {
  eq: "${}",
  variables: {
    A: { type: "scalar", value: 10 },
    B: { type: "scalar", value: 20 },
  },
};

const testNumberVariableName: UnparsedRecipe = {
  eq: "${5}",
  variables: {
    5: { type: "scalar", value: 10 }, // Invalid variable name
    B: { type: "scalar", value: 20 },
  },
};

const test1800Variables: UnparsedRecipe = {
  eq: new Array(1800).fill(0).map((_, i) => `\${V${i}}`).join("+"),
  variables: Object.fromEntries(
    new Array(1800).fill(0).map((_, i) => [`V${i}`, { type: "scalar", value: i }])
  ),
};

const test3000Variables: UnparsedRecipe = {
  eq: new Array(3000).fill(0).map((_, i) => `\${V${i}}`).join("+"),
  variables: Object.fromEntries(
    new Array(3000).fill(0).map((_, i) => [`V${i}`, { type: "scalar", value: i }])
  ),
};

const testHugeVector: UnparsedRecipe = {
  eq: "${A} * 0.5",
  variables: {
    A: { type: "vector", value: new Array(10000).fill(1) }, // Huge vector
  },
};

const testMixedDataVector: UnparsedRecipe = {
  eq: "${A} * 0.5",
  variables: {
    A: { type: "vector", value: [1, 2, 3, null, undefined, 5, "6", 7] }, // Mixed data types
  },
};

const testInvalidVector: UnparsedRecipe = {
  eq: "${A} * 0.5",
  variables: {
    A: { type: "vector", value: [1, 2, "three", 4, 5] }, // Invalid vector with a string
  },
};

const testNegativeValues: UnparsedRecipe = {
  eq: "${A} + ${B}",
  variables: {
    A: { type: "vector", value: [-1, -2, -3] },
    B: { type: "vector", value: [-4, -5, -6] },
  },
};

const testNegativeVectorValues: UnparsedRecipe = {
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
  recipe: Partial<UnparsedRecipe> | string;
  shouldPass: boolean;
};

const passColor = (text: string) => colors.rgbBG(20, 100, 20, text);
const failColor = (text: string) => colors.rgbBG(120, 20, 20, text);
const warnColor = colors.yellow;
const headerColor = colors.grayBG;
const infoColor = colors.white;

/**
 * Log the result of a recipe test.
 * @param {Object} res - The result object.
 * @param {Object} res.result - The parsed recipe result.
 * @param {Array} res.warnings - Any warnings generated during parsing.
 * @returns {string | undefined} The formatted string or undefined if no result.
 */
function logResult(res: { result: any; warnings: any[] }): string {
  if (!res) return "";

  const { result, warnings } = res;

  const output: string[] = [];
  output.push("");
  output.push(trunc(`Result: ${colors.gray("{" + Object.entries(result).map(([y, v]) => `${y}:${v}`).join(", ") + "}")}`));
  output.push(`Warnings${warnings.length > 0 && `(${warnings.length})`}:${warnings.length > 0 ? warnColor("\n - " + warnings.join("\n - ")) : " None"}`);

  return output.join("\n");
}

function runTests() {
  const passed: string[] = [];
  const failed: string[] = [];

  (testCases as TestCase[]).forEach(({ description, recipe, shouldPass }) => {
    let testPassed = false;
    let resultMessage = "";
    const output: string[] = [];

    try {
      // Test with recipe as object or string
      output.push(`Sending recipe as ${typeof recipe}...\n`);
      const res1 = parseRecipe(typeof recipe === 'string' ? recipe : { ...recipe } as UnparsedRecipe);
      output.push(logResult(res1));

      // Test with stringified JSON
      output.push(`\n\nSending as stringified JSON...\n`);
      const res2 = parseRecipe(JSON.stringify(recipe));
      output.push(logResult(res2));

      // They should be the same
      if (JSON.stringify(res1) !== JSON.stringify(res2)) {
        throw new Error("Results do not match between object and stringified JSON.");
      }

      if (shouldPass) {
        testPassed = true;
        resultMessage = "Test passed as expected.";
      } else {
        testPassed = false;
        resultMessage = "Test failed: Should have failed but passed without errors.";
      }
    } catch (error: any) {
      if (!shouldPass) {
        testPassed = true;
        resultMessage = `Test failed as expected: ${error.message}`;
      } else {
        testPassed = false;
        resultMessage = `Test failed unexpectedly: ${error.message}`;
      }
    }

    if (testPassed) {
      passed.push(description);
    } else {
      failed.push(description);
    }

    if (!args.values.failed || !testPassed) {
      console.debug(headerColor(infoColor(`--- Testing: ${description} ---`.padEnd(process.stdout.columns || 40))));
      console.debug(output.join("\n"));

      // Footer
      const footerText = ` ${testPassed ? "PASS" : "FAIL"}: ${description} `;
      const footerColor = testPassed ? passColor : failColor;
      console.debug("");
      console.debug(footerColor(infoColor(footerText.padEnd(process.stdout.columns || 40))));
      console.debug(resultMessage);
      console.log("");
    }
  });

  // Summary
  console.info(headerColor(infoColor(" Summary ".padEnd(process.stdout.columns || 40))));
  console.info(colors.green(`Passed: ${passed.length} ${colors.gray(`- ${passed.join(", ")}`)}`));
  if (failed.length > 0) {
    console.info(colors.red(`Failed: ${failed.length}\n\t- ${failed.join("\n\t- ")}`));
  } else {
    console.info(colors.red("Failed: 0"));
  }
  console.log("");
}

// Execute tests
runTests();
