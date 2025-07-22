import { parseArgs } from "node:util";
import "../lib/console";
import { colors } from "../lib/colors";
import type { DataSeriesArray, RawRecipe } from "../../src/functions/recipe-parser/types";
import { evaluateRecipe, parseRecipe, recipeFromUnknown, unsafeIsRawRecipe } from "../../src/functions/parseRecipe";

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
    A: { type: "dataSeries", value: { "2020": 43, "2021": 44, "2022": 45 } },
    B: { type: "dataSeries", value: { "2020": 6, "2021": 7, "2022": 8 } },
    C: { type: "scalar", value: 0.5 },
  },
};

const testMissingVariableRecipe: RawRecipe = {
  eq: "${A} * 3 + ${B}*2 / ${C}",
  variables: {
    A: { type: "dataSeries", value: { "2020": 43, "2021": 44, "2022": 45 } },
    B: { type: "dataSeries", value: { "2020": 6, "2021": 7, "2022": 8 } },
    // C is missing
  },
};

const testExtraVariableRecipe: RawRecipe = {
  eq: "${A} * 3 + ${B}*2 / ${C}",
  variables: {
    A: { type: "dataSeries", value: { "2020": 43, "2021": 44, "2022": 45 } },
    B: { type: "dataSeries", value: { "2020": 6, "2021": 7, "2022": 8 } },
    C: { type: "scalar", value: 0.5 },
    D: { type: "scalar", value: 10 }, // Extra variable
  },
};

const testInvalidVariableRecipe = {
  eq: "${A} * 3 + ${B}*2 / ${C}",
  variables: {
    A: { type: "dataSeries", value: { "2020": 43, "2021": 44, "2022": 45 } },
    B: { type: "dataSeries", value: { "2020": 6, "2021": 7, "2022": 8 } },
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
    A: { type: "dataSeries", value: { "2020": 43, "2021": 44, "2022": 45 } },
    B: { type: "dataSeries", value: { "2020": 6, "2021": 7, "2022": 8 } },
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
    A: { type: "dataSeries", value: Object.fromEntries(new Array(10000).fill(1).map((v, i) => [2020 + i, v])) }, // Huge dataSeries
  },
};

const testMixedDataVector: RawRecipe = {
  eq: "${A} * 0.5",
  variables: {
    A: { type: "dataSeries", value: { "2020": 1, "2021": 2, "2022": 3, "2023": null, "2025": 5, "2026": 6, "2027": 7 } }, // Mixed data types
  },
};

const testInvalidVector: RawRecipe = {
  eq: "${A} * 0.5",
  variables: {
    A: { type: "dataSeries", value: { "2020": 1, "2021": 2, "2022": "three", "2023": 4, "2024": 5 } as unknown as DataSeriesArray }, // Invalid dataSeries with a string
  },
};

const testNegativeValues: RawRecipe = {
  eq: "${A} + ${B}",
  variables: {
    A: { type: "dataSeries", value: { "2020": -1, "2021": -2, "2022": -3 } },
    B: { type: "dataSeries", value: { "2020": -4, "2021": -5, "2022": -6 } },
  },
};

const testNegativeVectorValues: RawRecipe = {
  eq: "${A} * 2",
  variables: {
    A: { type: "dataSeries", value: { "2020": -1, "2021": -2, "2022": -3 } }, // Negative dataSeries values
  },
};

const testUnicodeVariableNames: RawRecipe = {
  eq: "${变量1} + ${变量2}",
  variables: {
    变量1: { type: "scalar", value: 10 },
    变量2: { type: "scalar", value: 20 },
  },
};

const testVariableNameWithSpaces: RawRecipe = {
  eq: "${Variable With Spaces} / ${Another Variable}",
  variables: {
    "Variable With Spaces": { type: "dataSeries", value: { "2020": 5, "2021": 25, "2022": 123, "2023": 68, "2024": 675, "2027": 23, "2029": 34, "2030": 56, "2031": 78, "2032": 90 } },
    "Another Variable": { type: "scalar", value: 2 },
  },
};

const testNoEarlyDataInDataSeries: RawRecipe = {
  eq: "${CoolVector} * ${B}",
  variables: {
    "CoolVector": { type: "dataSeries", value: { "2023": 0, "2024": 12, "2025": 33, "2026": 0, "2030": 2, "2031": 12, "2032": 23, "2033": 4, "2034": 5, "2035": 6 } },
    "B": { type: "scalar", value: 0.03 },
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
  { description: "Huge dataSeries", recipe: testHugeVector, shouldPass: true },
  { description: "Mixed data dataSeries", recipe: testMixedDataVector, shouldPass: true },
  { description: "Invalid dataSeries", recipe: testInvalidVector, shouldPass: false },
  { description: "Negative values", recipe: testNegativeValues, shouldPass: true },
  { description: "Negative dataSeries values", recipe: testNegativeVectorValues, shouldPass: true },
  { description: "Unicode variable names", recipe: testUnicodeVariableNames, shouldPass: true },
  { description: "Variable names with spaces", recipe: testVariableNameWithSpaces, shouldPass: true },
  { description: "No early data in data series", recipe: testNoEarlyDataInDataSeries, shouldPass: true },
];

// Test Runner
// -----------
type TestCase = {
  description: string;
  recipe: Partial<RawRecipe>;
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

async function runTest(testCase: TestCase): Promise<TestResult> {
  const { recipe, shouldPass } = testCase;
  const warnings: string[] = [];
  const errors: string[] = [];
  let passed = false;
  let result: DataSeriesArray | null = null;

  try {
    // Parse and normalize recipes
    const recipeFromObject = await parseRecipe(recipe as RawRecipe);
    const recipeFromString = await parseRecipe(recipeFromUnknown(JSON.stringify(recipe)));

    // Test if unsafeIsRawRecipe works 
    const recipeFromObjectIsRaw = unsafeIsRawRecipe(recipeFromObject);
    const recipeFromStringIsRaw = unsafeIsRawRecipe(recipeFromString);
    // Add warning if it isn't acceptable which some shouldn't be
    if (!recipeFromObjectIsRaw || !recipeFromStringIsRaw) {
      warnings.push("Parsed recipe is not a valid RawRecipe object according to unsafeIsRawRecipe().");
    }

    // Resolve clean Recipes
    const objWarnings: string[] = [];
    const strWarnings: string[] = [];
    const resultFromObject = await evaluateRecipe(recipeFromObject, objWarnings);
    const resultFromString = await evaluateRecipe(recipeFromString, strWarnings);
    // They should still be the same
    if (JSON.stringify(resultFromObject) !== JSON.stringify(resultFromString)) {
      warnings.push("Results from object and string input do not match.");
    }

    warnings.push(...new Set([...objWarnings, ...strWarnings]));

    // Write the result to the test result
    result = resultFromObject;

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

async function runTests() {
  const results: TestResult[] = [];

  for (const testCase of testCases) {
    // Header
    console.debug(headerColor(truncPad(`Running - ${testCase.description} - ${testCase.shouldPass ? "should pass" : "should fail"}`)));

    const testResult = await runTest(testCase as unknown as TestCase);
    const { passed, result, errors, warnings } = testResult;

    results.push(testResult);

    if (passed) console.debug(passColor(truncPad("Passed")));
    else console.debug(failColor(truncPad("Failed")));

    // Input details
    console.debug(truncPad("Eq: " + JSON.stringify((testCase.recipe as RawRecipe)?.eq || "")));
    console.debug(truncPad("Variables: " + JSON.stringify((testCase.recipe as RawRecipe)?.variables || {})));

    // Result
    if (result) {
      console.debug(truncPad("Result: " + JSON.stringify(result)));
    } else {
      console.debug("Result: None (early exit?)");
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

await runTests();