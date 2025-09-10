import { parseArgs } from "node:util";
import "../lib/console";
import { colors } from "../lib/colors";
import { isRecipe, RecipeDataTypes, type Recipe } from "../../src/functions/recipe-parser/types";
import { evaluateRecipe, recipeFromUnknown } from "../../src/functions/parseRecipe";
import { DataSeriesValueFields } from "../../src/types";

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
    "failed": {
      type: "boolean",
      description: "Truncate passed tests to make it easier to find failed tests",
      default: false,
    }
  }
});

if (args.values.help) {
  console.info("Usage: yarn tsx tests/files/recipe-parser.test.ts [--help]");
  console.info("Options:");
  console.info("  --help, -h    Show this help message");
  console.info("  --failed      Show only failed tests");
  process.exit(0);
}

// Test Case Definitions
// ---------------------

const testBasicRecipe: Recipe = {
  eq: "${stellarEnergy} * 3 + ${cosmicDust}*2 / ${gravityWell}",
  variables: {
    stellarEnergy: { type: RecipeDataTypes.DataSeries, value: { "val2020": 43, "val2021": 44, "val2022": 45 } },
    cosmicDust: { type: RecipeDataTypes.DataSeries, value: { "val2020": 6, "val2021": 7, "val2022": 8 } },
    gravityWell: { type: RecipeDataTypes.Scalar, value: 0.5 },
  },
};

const testMissingVariableRecipe: Recipe = {
  eq: "${stellarEnergy} * 3 + ${cosmicDust}*2 / ${gravityWell}",
  variables: {
    stellarEnergy: { type: RecipeDataTypes.DataSeries, value: { "val2020": 43, "val2021": 44, "val2022": 45 } },
    cosmicDust: { type: RecipeDataTypes.DataSeries, value: { "val2020": 6, "val2021": 7, "val2022": 8 } },
    // gravityWell is missing
  },
};

const testExtraVariableRecipe: Recipe = {
  eq: "${stellarEnergy} * 3 + ${cosmicDust}*2 / ${gravityWell}",
  variables: {
    stellarEnergy: { type: RecipeDataTypes.DataSeries, value: { "val2020": 43, "val2021": 44, "val2022": 45 } },
    cosmicDust: { type: RecipeDataTypes.DataSeries, value: { "val2020": 6, "val2021": 7, "val2022": 8 } },
    gravityWell: { type: RecipeDataTypes.Scalar, value: 0.5 },
    blackHole: { type: RecipeDataTypes.Scalar, value: 10 }, // Extra variable
  },
};

const testInvalidVariableRecipe = {
  eq: "${stellarEnergy} * 3 + ${cosmicDust}*2 / ${gravityWell}",
  variables: {
    stellarEnergy: { type: RecipeDataTypes.DataSeries, value: { "val2020": 43, "val2021": 44, "val2022": 45 } },
    cosmicDust: { type: RecipeDataTypes.DataSeries, value: { "val2020": 6, "val2021": 7, "val2022": 8 } },
    gravityWell: { type: "string", value: "0.5" }, // Invalid type
  },
};

const testEmptyRecipe: Recipe = {
  name: undefined,
  eq: "",
  variables: {},
};

const testNoInput = {
  eq: "${stellarEnergy} * 3 + ${cosmicDust}*2 / ${gravityWell}",
};

const testNoEquation = {
  variables: {
    stellarEnergy: { type: RecipeDataTypes.DataSeries, value: { "val2020": 43, "val2021": 44, "val2022": 45 } },
    cosmicDust: { type: RecipeDataTypes.DataSeries, value: { "val2020": 6, "val2021": 7, "val2022": 8 } },
    gravityWell: { type: RecipeDataTypes.Scalar, value: 0.5 },
  },
};

const testManyVariables: Recipe = {
  eq: "${alpha} + ${beta} + ${gamma} + ${delta} + ${epsilon} + ${zeta} + ${eta} + ${theta} + ${iota} + ${kappa} + ${lambda} + ${mu} + ${nu} + ${xi} + ${omicron} + ${pi} + ${rho} + ${sigma} + ${tau} + ${upsilon} + ${phi} + ${chi} + ${psi} + ${omega} + ${alphaPrime} + ${betaPrime}",
  variables: {
    alpha: { type: RecipeDataTypes.Scalar, value: 1 }, beta: { type: RecipeDataTypes.Scalar, value: 2 }, gamma: { type: RecipeDataTypes.Scalar, value: 3 }, delta: { type: RecipeDataTypes.Scalar, value: 4 }, epsilon: { type: RecipeDataTypes.Scalar, value: 5 }, zeta: { type: RecipeDataTypes.Scalar, value: 6 }, eta: { type: RecipeDataTypes.Scalar, value: 7 }, theta: { type: RecipeDataTypes.Scalar, value: 8 }, iota: { type: RecipeDataTypes.Scalar, value: 9 }, kappa: { type: RecipeDataTypes.Scalar, value: 10 }, lambda: { type: RecipeDataTypes.Scalar, value: 11 }, mu: { type: RecipeDataTypes.Scalar, value: 12 }, nu: { type: RecipeDataTypes.Scalar, value: 13 }, xi: { type: RecipeDataTypes.Scalar, value: 14 }, omicron: { type: RecipeDataTypes.Scalar, value: 15 }, pi: { type: RecipeDataTypes.Scalar, value: 16 }, rho: { type: RecipeDataTypes.Scalar, value: 17 }, sigma: { type: RecipeDataTypes.Scalar, value: 18 }, tau: { type: RecipeDataTypes.Scalar, value: 19 }, upsilon: { type: RecipeDataTypes.Scalar, value: 20 }, phi: { type: RecipeDataTypes.Scalar, value: 21 }, chi: { type: RecipeDataTypes.Scalar, value: 22 }, psi: { type: RecipeDataTypes.Scalar, value: 23 }, omega: { type: RecipeDataTypes.Scalar, value: 24 }, alphaPrime: { type: RecipeDataTypes.Scalar, value: 25 }, betaPrime: { type: RecipeDataTypes.Scalar, value: 26 },
  }
}

const testHugeScalar: Recipe = {
  eq: "${gargantuan} + ${colossal}",
  variables: {
    gargantuan: { type: RecipeDataTypes.Scalar, value: Number.MAX_SAFE_INTEGER },
    colossal: { type: RecipeDataTypes.Scalar, value: Number.MAX_SAFE_INTEGER },
  },
};

const testDivideByZero: Recipe = {
  eq: "${dividend} / ${divisor}",
  variables: {
    dividend: { type: RecipeDataTypes.Scalar, value: 10 },
    divisor: { type: RecipeDataTypes.Scalar, value: 0 }, // This will cause a divide by zero error
  },
};

const testLongVariableNames: Recipe = {
  eq: "${aVeryLongAndDescriptiveVariableName} + ${anotherSuperLongAndVerboseVariableName}",
  variables: {
    aVeryLongAndDescriptiveVariableName: { type: RecipeDataTypes.Scalar, value: 1 },
    anotherSuperLongAndVerboseVariableName: { type: RecipeDataTypes.Scalar, value: 2 },
  },
};

const testBadCharactersInEquation: Recipe = {
  eq: "${badApple} % 3 & ${rottenTomato} | | $ 7",
  variables: {
    badApple: { type: RecipeDataTypes.Scalar, value: 10 },
    rottenTomato: { type: RecipeDataTypes.Scalar, value: 20 },
  },
};

const testEmptyStringTemplate: Recipe = {
  eq: "${}",
  variables: {
    emptyMind: { type: RecipeDataTypes.Scalar, value: 10 },
    blankSlate: { type: RecipeDataTypes.Scalar, value: 20 },
  },
};

const testNumberVariableName: Recipe = {
  eq: "${5}",
  variables: {
    5: { type: RecipeDataTypes.Scalar, value: 10 }, // Invalid variable name
    someOtherVar: { type: RecipeDataTypes.Scalar, value: 20 },
  },
};

const test1800Variables: Recipe = {
  eq: new Array(1800).fill(0).map((_, i) => `\${V${i}}`).join("+"),
  variables: Object.fromEntries(
    new Array(1800).fill(0).map((_, i) => [`V${i}`, { type: RecipeDataTypes.Scalar, value: i }])
  ),
};

const test3000Variables: Recipe = {
  eq: new Array(3000).fill(0).map((_, i) => `\${V${i}}`).join("+"),
  variables: Object.fromEntries(
    new Array(3000).fill(0).map((_, i) => [`V${i}`, { type: RecipeDataTypes.Scalar, value: i }])
  ),
};

const testHugeVector: Recipe = {
  eq: "${timeSeriesOfDoom} * 0.5",
  variables: {
    timeSeriesOfDoom: { type: RecipeDataTypes.DataSeries, value: Object.fromEntries(new Array(10000).fill(1).map((v, i) => ["val" + (2020 + i), v])) }, // Huge dataSeries
  },
};

const testMixedDataVector: Recipe = {
  eq: "${chaoticDataStream} * 0.5",
  variables: {
    chaoticDataStream: { type: RecipeDataTypes.DataSeries, value: { "val2020": 1, "val2021": 2, "val2022": 3, "val2023": null, "val2025": 5, "val2026": 6, "val2027": 7 } }, // Mixed data types
  },
};

const testInvalidVector: Recipe = {
  eq: "${corruptedDataFlow} * 0.5",
  variables: {
    corruptedDataFlow: { type: RecipeDataTypes.DataSeries, value: { "val2020": 1, "val2021": 2, "val2022": "three", "val2023": 4, "val2024": 5 } as unknown as DataSeriesArray }, // Invalid dataSeries with a string
  },
};

const testNegativeValues: Recipe = {
  eq: "${depth} + ${pressure}",
  variables: {
    depth: { type: RecipeDataTypes.DataSeries, value: { "val2020": -1, "val2021": -2, "val2022": -3 } },
    pressure: { type: RecipeDataTypes.DataSeries, value: { "val2020": -4, "val2021": -5, "val2022": -6 } },
  },
};

const testNegativeVectorValues: Recipe = {
  eq: "${theVoidStaresBack} * 2",
  variables: {
    theVoidStaresBack: { type: RecipeDataTypes.DataSeries, value: { "val2020": -1, "val2021": -2, "val2022": -3 } }, // Negative dataSeries values
  },
};

const testUnicodeVariableNames: Recipe = {
  eq: "${变量1} + ${变量2}",
  variables: {
    变量1: { type: RecipeDataTypes.Scalar, value: 10 },
    变量2: { type: RecipeDataTypes.Scalar, value: 20 },
  },
};

const testVariableNameWithSpaces: Recipe = {
  eq: "${The Quick Brown Fox} / ${Jumps Over The Lazy Dog}",
  variables: {
    "The Quick Brown Fox": { type: RecipeDataTypes.DataSeries, value: { "val2020": 5, "val2021": 25, "val2022": 123, "val2023": 68, "val2024": 675, "val2027": 23, "val2029": 34, "val2030": 56, "val2031": 78, "val2032": 90 } },
    "Jumps Over The Lazy Dog": { type: RecipeDataTypes.Scalar, value: 2 },
  },
};

const testNoEarlyDataInDataSeries: Recipe = {
  eq: "${intermittentSignal} * ${amplificationFactor}",
  variables: {
    "intermittentSignal": { type: RecipeDataTypes.DataSeries, value: { "val2023": 0, "val2024": 12, "val2025": 33, "val2026": 0, "val2030": 2, "val2031": 12, "val2032": 23, "val2033": 4, "val2034": 5, "val2035": 6 } },
    "amplificationFactor": { type: RecipeDataTypes.Scalar, value: 0.03 },
  },
};

const testOperatorPrecedence: Recipe = {
  eq: "(${a} + ${b}) * ${c} / (${d} - ${e})^2",
  variables: {
    a: { type: RecipeDataTypes.Scalar, value: 10 },
    b: { type: RecipeDataTypes.Scalar, value: 5 },
    c: { type: RecipeDataTypes.Scalar, value: 2 },
    d: { type: RecipeDataTypes.Scalar, value: 4 },
    e: { type: RecipeDataTypes.Scalar, value: 2 },
  },
};

const testMathFunctions: Recipe = {
  eq: "map(map(map(${matrix}, sin), abs), sqrt) + log(${ten}) - pow(${a number}, 2)",
  variables: {
    matrix: { type: RecipeDataTypes.DataSeries, value: { "val2020": -1, "val2021": 0.5, "val2022": 1 } },
    ten: { type: RecipeDataTypes.Scalar, value: 10 },
    "a number": { type: RecipeDataTypes.Scalar, value: 2 },
  },
};

const testComplexResult: Recipe = {
  eq: "sqrt(${a})",
  variables: {
    a: { type: RecipeDataTypes.Scalar, value: -4 },
  },
};

const testInfinityResult: Recipe = {
  eq: "log(${a})",
  variables: {
    a: { type: RecipeDataTypes.Scalar, value: 0 },
  },
};

const testMatrixResult: Recipe = {
  eq: "${a} * transpose([[1,2], [3,4]])",
  variables: {
    a: { type: RecipeDataTypes.DataSeries, value: { "val2020": 1, "val2021": 2 } },
  },
};

const testUnitCalculation: Recipe = {
  eq: "${distance} / ${time}",
  variables: {
    distance: { type: RecipeDataTypes.DataSeries, value: { "val2020": 100, "val2021": 200 }, unit: "km" },
    time: { type: RecipeDataTypes.Scalar, value: 2, unit: "h" },
  },
};

const testIncompatibleUnits: Recipe = {
  eq: "${mass} + ${length}",
  variables: {
    mass: { type: RecipeDataTypes.Scalar, value: 10, unit: "kg" },
    length: { type: RecipeDataTypes.Scalar, value: 5, unit: "m" },
  },
};

const testRecursiveDefinition: Recipe = {
  eq: "${a}",
  variables: {
    a: { type: RecipeDataTypes.Scalar, value: "${b}" as any },
    b: { type: RecipeDataTypes.Scalar, value: 10 },
  },
};

const testInvalidSyntax: Recipe = {
  eq: "sqrt(4",
  variables: {},
};

const testReservedJSKeywords: Recipe = {
  eq: "${function} + ${class} * ${case}",
  variables: {
    function: { type: RecipeDataTypes.Scalar, value: 1 },
    class: { type: RecipeDataTypes.Scalar, value: 2 },
    case: { type: RecipeDataTypes.Scalar, value: 3 },
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
  { description: "val1800 variables", recipe: test1800Variables, shouldPass: true },
  { description: "val3000 variables", recipe: test3000Variables, shouldPass: false },
  { description: "Huge dataSeries", recipe: testHugeVector, shouldPass: true },
  { description: "Mixed data dataSeries", recipe: testMixedDataVector, shouldPass: true },
  { description: "Invalid dataSeries", recipe: testInvalidVector, shouldPass: false },
  { description: "Negative values", recipe: testNegativeValues, shouldPass: true },
  { description: "Negative dataSeries values", recipe: testNegativeVectorValues, shouldPass: true },
  { description: "Unicode variable names", recipe: testUnicodeVariableNames, shouldPass: true },
  { description: "Variable names with spaces", recipe: testVariableNameWithSpaces, shouldPass: true },
  { description: "No early data in data series", recipe: testNoEarlyDataInDataSeries, shouldPass: true },
  { description: "Operator precedence", recipe: testOperatorPrecedence, shouldPass: true },
  { description: "Math functions", recipe: testMathFunctions, shouldPass: true },
  { description: "Complex number result", recipe: testComplexResult, shouldPass: false },
  { description: "Infinity result", recipe: testInfinityResult, shouldPass: false },
  { description: "Matrix result", recipe: testMatrixResult, shouldPass: true },
  { description: "Unit calculation", recipe: testUnitCalculation, shouldPass: true },
  { description: "Incompatible units", recipe: testIncompatibleUnits, shouldPass: false },
  { description: "Recursive definition", recipe: testRecursiveDefinition, shouldPass: false },
  { description: "Invalid syntax", recipe: testInvalidSyntax, shouldPass: false },
  { description: "Reserved JS keywords", recipe: testReservedJSKeywords, shouldPass: true },
];

// Test Runner
// -----------
type TestCase = {
  description: string;
  recipe: Partial<Recipe>;
  shouldPass: boolean;
};

type TestResult = {
  testCase: TestCase;
  passed: boolean;
  warnings: string[];
  errors: string[];
  result: {
    dataSeries: DataSeriesValueFields;
    unit: string | null | undefined;
  } | null; // The result of the parseRecipe function
};

const passColor = (text: string) => colors.cyanBrightBG(colors.black(text));
const failColor = (text: string) => colors.rgbBG(200, 0, 0, colors.black(text));
const headerColor = (text: string) => colors.cyanBG(colors.black(text));

async function runTest(testCase: TestCase): Promise<TestResult> {
  const { recipe, shouldPass } = testCase;
  const warnings: string[] = [];
  const errors: string[] = [];
  let passed = false;
  let result: {
    dataSeries: DataSeriesValueFields;
    unit: string | null | undefined;
  } | null = null;

  try {
    // Parse and normalize recipes
    const recipeFromObject = recipeFromUnknown(recipe);
    const recipeFromString = recipeFromUnknown(JSON.stringify(recipe));

    // Test if unsafeIsRawRecipe works 
    const recipeFromObjectIsOk = isRecipe(recipeFromObject);
    const recipeFromStringIsOk = isRecipe(recipeFromString);
    // Add warning if it isn't acceptable which some shouldn't be
    if (!recipeFromObjectIsOk || !recipeFromStringIsOk) {
      warnings.push("Parsed recipe is not a valid Recipe object according to isRecipe().");
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
  } catch (error: unknown) {
    if (!(error instanceof Error)) {
      throw error; // Re-throw if it's not an Error
    }
    if (!shouldPass) {
      passed = true; // If it was supposed to fail, we consider it passed      
    } else {
      passed = false; // If it was supposed to pass but failed, we consider it failed
    }
    errors.push(error.stack ?? error.message);
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

    // Failed flag
    if (args.values.failed && passed) {
      continue;
    };

    // Input details
    console.debug(truncPad("Eq: " + colors.gray(JSON.stringify((testCase.recipe as Recipe)?.eq || ""))));
    console.debug(truncPad("Variables: " + colors.gray(JSON.stringify((testCase.recipe as Recipe)?.variables || {}))));

    // Result
    if (result) {
      console.debug(truncPad(`Result${result.unit ? ` (${result.unit})` : ""}: ${JSON.stringify(result)}`));
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