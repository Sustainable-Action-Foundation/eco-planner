import { parseArgs } from "node:util";
import { DataSeries, parseRecipe, UnparsedRecipe } from "../../src/functions/parseRecipe";
import "../lib/console";
import { colors } from "../lib/colors";
import { trunc, truncPad } from "../../src/functions/recipe-parser/helpers";

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

type TestResult = {
  testCase: TestCase;
  passed: boolean;
  warnings: string[];
  errors: string[];
  result: DataSeries | null; // The result of the parseRecipe function
};

const passColor = (text: string) => colors.cyanBrightBG(colors.black(text));
const failColor = (text: string) => colors.rgbBG(200, 0, 0, colors.black(text));
const warnColor = colors.yellow;
const infoColor = colors.white;
const headerColor = (text: string) => colors.cyanBG(colors.black(text));

function runTest(testCase: TestCase): TestResult {
  const { recipe, shouldPass } = testCase;
  const warnings: string[] = [];
  const errors: string[] = [];
  let passed = false;
  let result: DataSeries | null = null;

  try {
    const objRes = parseRecipe(recipe as UnparsedRecipe);
    const strRes = parseRecipe(JSON.stringify(recipe));

    if (JSON.stringify(objRes.recipe) !== JSON.stringify(strRes.recipe)) {
      throw new Error("Parsed recipes do not match between object and string input.");
    }

    // Beautifully combine the warnings
    warnings.push(...new Set([...objRes.warnings, ...strRes.warnings]));

    passed = shouldPass; // If no error is thrown, it passes
  } catch (error: any) {
    if (!shouldPass) {
      passed = true; // If it was supposed to fail, we consider it passed      
    } else {
      passed = false; // If it was supposed to pass but failed, we consider it failed
    }
    errors.push(`${error.name} - ${error.message} (${error.stack})`);
  }

  return { passed, warnings, result, testCase, errors };
}

function runTests() {
  for (const testCase of testCases) {
    // Header
    console.debug(headerColor(truncPad(`Running - ${testCase.description} - ${testCase.shouldPass ? "should pass" : "should fail"}`)));

    // @ts-expect-error - the types are wrong in some cases
    const { passed, result, errors, warnings } = runTest(testCase);

    if (passed) console.debug(passColor(truncPad("Passed")));
    else console.debug(failColor(truncPad("Failed")));
    console.debug("\n");
  }
}

// async function runTests(): Promise<void> {
//   const results: TestResult[] = await Promise.all(
//     // @ts-expect-error - the types are wrong in some cases
//     testCases.map(testCase => runTest(testCase))
//   );

//   // Log results
//   results.filter((res) => {
//     if (args.values.failed) {
//       return !res.passed; // Show only failed tests
//     }
//     return true; // Show all tests
//   }).forEach(({ testCase, passed, warnings, result, errors }) => {
//     const output: string[] = [];
//     output.push(headerColor(infoColor(` ${testCase.description} `.padEnd(process.stdout.columns || 40))));
//     output.push(trunc(`Result: ${colors.gray("{" + Object.entries(result || {}).map(([y, v]) => `${y}:${v}`).join(", ") + "}")}`));
//     output.push(`Warnings${warnings.length > 0 ? `(${warnings.length})` : ""}:${warnings.length > 0 ? warnColor("\n - " + warnings.join("\n - ")) : " None"}`);
//     output.push(`Errors${errors.length > 0 ? `(${errors.length})` : ""}:${errors.length > 0 ? failColor("\n - " + errors.join("\n - ")) : " None"}`);
//     console.info(output.join("\n"));
//     console.info(`\nExpected to ${testCase.shouldPass ? "pass" : "fail"}. ${passed ? passColor("Test passed") : failColor("Test failed")}.`);
//     console.debug("");
//   });

//   // Summery
//   const totalTests = results.length;
//   const passedTests = results.filter(r => r.passed).length;
//   const failedTests = totalTests - passedTests;
//   console.info(headerColor(infoColor(`\n Summary: ${totalTests} tests run, ${passedTests} passed, ${failedTests} failed.`)));
//   if (failedTests > 0) {
//     console.info(failColor(`${failedTests} tests failed.`));
//     results.filter(r => !r.passed).forEach(({ testCase, warnings }) => {
//       console.info(failColor(` - ${testCase.description}`));
//       if (warnings.length > 0) {
//         console.info(warnColor(`   Warnings: ${warnings.join(", ")}`));
//       }
//     });
//   }
//   else {
//     console.info(passColor("All tests passed!"));
//   }
//   console.debug("");
// }

// await runTests();

runTests();