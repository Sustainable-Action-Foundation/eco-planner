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
import { parseRecipe, Recipe, RecipeParseResult, trunc } from "../../src/functions/parseRecipe";

// Test Case Definitions
// ---------------------

const testBasicRecipe: Recipe = {
  eq: "${A} * 3 + ${B}*2 / ${C}",
  variables: {
    A: { type: "vector", value: [43, 44, 45] },
    B: { type: "vector", value: [6, 7, 8] },
    C: { type: "scalar", value: 0.5 },
  },
};

const testMissingVariableRecipe: Recipe = {
  eq: "${A} * 3 + ${B}*2 / ${C}",
  variables: {
    A: { type: "vector", value: [43, 44, 45] },
    B: { type: "vector", value: [6, 7, 8] },
    // C is missing
  },
};

const testExtraVariableRecipe: Recipe = {
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

const testEmptyRecipe: Recipe = {
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

const testManyVariables: Recipe = {
  eq: "${A} + ${B} + ${C} + ${D} + ${E} + ${F} + ${G} + ${H} + ${I} + ${J} + ${K} + ${L} + ${M} + ${N} + ${O} + ${P} + ${Q} + ${R} + ${S} + ${T} + ${U} + ${V} + ${W} + ${X} + ${Y} + ${Z}",
  variables: {
    A: { type: "scalar", value: 1 }, B: { type: "scalar", value: 2 }, C: { type: "scalar", value: 3 }, D: { type: "scalar", value: 4 }, E: { type: "scalar", value: 5 }, F: { type: "scalar", value: 6 }, G: { type: "scalar", value: 7 }, H: { type: "scalar", value: 8 }, I: { type: "scalar", value: 9 }, J: { type: "scalar", value: 10 }, K: { type: "scalar", value: 11 }, L: { type: "scalar", value: 12 }, M: { type: "scalar", value: 13 }, N: { type: "scalar", value: 14 }, O: { type: "scalar", value: 15 }, P: { type: "scalar", value: 16 }, Q: { type: "scalar", value: 17 }, R: { type: "scalar", value: 18 }, S: { type: "scalar", value: 19 }, T: { type: "scalar", value: 20 }, U: { type: "scalar", value: 21 }, V: { type: "scalar", value: 22 }, W: { type: "scalar", value: 23 }, X: { type: "scalar", value: 24 }, Y: { type: "scalar", value: 25 }, Z: { type: "scalar", value: 26 },
  }
}

const testHugeScalar: Recipe = {
  eq: "${A} + ${B}",
  variables: {
    A: { type: "scalar", value: Number.MAX_SAFE_INTEGER },
    B: { type: "scalar", value: Number.MAX_SAFE_INTEGER },
  },
};

const testDivideByZero: Recipe = {
  eq: "${A} / ${B}",
  variables: {
    A: { type: "scalar", value: 10 },
    B: { type: "scalar", value: 0 }, // This will cause a divide by zero error
  },
};

const testLongVariableNames: Recipe = {
  eq: "${veryLongVariableName1} + ${veryLongVariableName2}",
  variables: {
    veryLongVariableName1: { type: "scalar", value: 1 },
    veryLongVariableName2: { type: "scalar", value: 2 },
  },
};

const testBadCharactersInEquation: Recipe = {
  eq: "${A} % 3 & ${B} | | $ 7",
  variables: {
    A: { type: "scalar", value: 10 },
    B: { type: "scalar", value: 20 },
  },
};

const testEmptyStringTemplate: Recipe = {
  eq: "${}",
  variables: {
    A: { type: "scalar", value: 10 },
    B: { type: "scalar", value: 20 },
  },
};

const testNumberVariableName: Recipe = {
  eq: "${5}",
  variables: {
    5: { type: "scalar", value: 10 }, // Invalid variable name
    B: { type: "scalar", value: 20 },
  },
};

const test1800Variables: Recipe = {
  eq: new Array(1800).fill(0).map((_, i) => `\${V${i}}`).join("+"),
  variables: Object.fromEntries(
    new Array(1800).fill(0).map((_, i) => [`V${i}`, { type: "scalar", value: i }])
  ),
};

const test3000Variables: Recipe = {
  eq: new Array(3000).fill(0).map((_, i) => `\${V${i}}`).join("+"),
  variables: Object.fromEntries(
    new Array(3000).fill(0).map((_, i) => [`V${i}`, { type: "scalar", value: i }])
  ),
};

const testHugeVector: Recipe = {
  eq: "${A} * 0.5",
  variables: {
    A: { type: "vector", value: new Array(10000).fill(1) }, // Huge vector
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
];

// Test Runner
// -----------

type TestCase = {
  description: string;
  recipe: Partial<Recipe> | string;
  shouldPass: boolean;
};

const passColor = (text: string) => colors.rgbBG(20, 100, 20, text);
const failColor = (text: string) => colors.rgbBG(120, 20, 20, text);
const warnColor = colors.yellow;
const errorColor = (text: string) => colors.rgb(150, 75, 75, text);
const headerColor = colors.grayBG;
const infoColor = colors.white;

function logResult(res: RecipeParseResult) {
  console.debug("");
  console.debug(trunc(`Result: ${colors.gray("[" + (res.result || []).join(", ") + "]")}`));
  console.debug(trunc(`Warnings: ${res.warnings.length > 0 ? warnColor(res.warnings.join(", ")) : "None"}`));
}

function runTests() {
  const passed: string[] = [];
  const failed: string[] = [];

  (testCases as TestCase[]).forEach(({ description, recipe, shouldPass }) => {
    console.debug(headerColor(infoColor(`--- Testing: ${description} ---`.padEnd(process.stdout.columns || 40))));

    let testPassed = false;
    let resultMessage = "";

    try {
      // Test with recipe as object or string
      console.debug(`Sending recipe as ${typeof recipe}...\n`);
      const res1 = parseRecipe(typeof recipe === 'string' ? recipe : { ...recipe } as Recipe);
      logResult(res1);

      // Test with stringified JSON
      console.debug(`\n\nSending as stringified JSON...\n`);
      const res2 = parseRecipe(JSON.stringify(recipe));
      logResult(res2);

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

    // Footer
    const footerText = ` ${testPassed ? "PASS" : "FAIL"}: ${description} `;
    const footerColor = testPassed ? passColor : failColor;
    console.debug(footerColor(infoColor(footerText.padEnd(process.stdout.columns || 40))));
    console.debug(resultMessage);


    if (testPassed) {
      passed.push(description);
    } else {
      failed.push(description);
    }
    console.log("");
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
