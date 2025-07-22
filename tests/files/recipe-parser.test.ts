import { parseArgs } from "node:util";
import "../lib/console";
import { colors } from "../lib/colors";
import { RecipeVariableType, type DataSeriesArray, type RawRecipe } from "../../src/functions/recipe-parser/types";
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
  eq: "${stellarEnergy} * 3 + ${cosmicDust}*2 / ${gravityWell}",
  variables: {
    stellarEnergy: { type: RecipeVariableType.DataSeries, value: { "2020": 43, "2021": 44, "2022": 45 } },
    cosmicDust: { type: RecipeVariableType.DataSeries, value: { "2020": 6, "2021": 7, "2022": 8 } },
    gravityWell: { type: RecipeVariableType.Scalar, value: 0.5 },
  },
};

const testMissingVariableRecipe: RawRecipe = {
  eq: "${stellarEnergy} * 3 + ${cosmicDust}*2 / ${gravityWell}",
  variables: {
    stellarEnergy: { type: RecipeVariableType.DataSeries, value: { "2020": 43, "2021": 44, "2022": 45 } },
    cosmicDust: { type: RecipeVariableType.DataSeries, value: { "2020": 6, "2021": 7, "2022": 8 } },
    // gravityWell is missing
  },
};

const testExtraVariableRecipe: RawRecipe = {
  eq: "${stellarEnergy} * 3 + ${cosmicDust}*2 / ${gravityWell}",
  variables: {
    stellarEnergy: { type: RecipeVariableType.DataSeries, value: { "2020": 43, "2021": 44, "2022": 45 } },
    cosmicDust: { type: RecipeVariableType.DataSeries, value: { "2020": 6, "2021": 7, "2022": 8 } },
    gravityWell: { type: RecipeVariableType.Scalar, value: 0.5 },
    blackHole: { type: RecipeVariableType.Scalar, value: 10 }, // Extra variable
  },
};

const testInvalidVariableRecipe = {
  eq: "${stellarEnergy} * 3 + ${cosmicDust}*2 / ${gravityWell}",
  variables: {
    stellarEnergy: { type: RecipeVariableType.DataSeries, value: { "2020": 43, "2021": 44, "2022": 45 } },
    cosmicDust: { type: RecipeVariableType.DataSeries, value: { "2020": 6, "2021": 7, "2022": 8 } },
    gravityWell: { type: "string", value: "0.5" }, // Invalid type
  },
};

const testEmptyRecipe: RawRecipe = {
  eq: "",
  variables: {},
};

const testNoInput = {
  eq: "${stellarEnergy} * 3 + ${cosmicDust}*2 / ${gravityWell}",
};

const testNoEquation = {
  variables: {
    stellarEnergy: { type: RecipeVariableType.DataSeries, value: { "2020": 43, "2021": 44, "2022": 45 } },
    cosmicDust: { type: RecipeVariableType.DataSeries, value: { "2020": 6, "2021": 7, "2022": 8 } },
    gravityWell: { type: RecipeVariableType.Scalar, value: 0.5 },
  },
};

const testManyVariables: RawRecipe = {
  eq: "${alpha} + ${beta} + ${gamma} + ${delta} + ${epsilon} + ${zeta} + ${eta} + ${theta} + ${iota} + ${kappa} + ${lambda} + ${mu} + ${nu} + ${xi} + ${omicron} + ${pi} + ${rho} + ${sigma} + ${tau} + ${upsilon} + ${phi} + ${chi} + ${psi} + ${omega} + ${alphaPrime} + ${betaPrime}",
  variables: {
    alpha: { type: RecipeVariableType.Scalar, value: 1 }, beta: { type: RecipeVariableType.Scalar, value: 2 }, gamma: { type: RecipeVariableType.Scalar, value: 3 }, delta: { type: RecipeVariableType.Scalar, value: 4 }, epsilon: { type: RecipeVariableType.Scalar, value: 5 }, zeta: { type: RecipeVariableType.Scalar, value: 6 }, eta: { type: RecipeVariableType.Scalar, value: 7 }, theta: { type: RecipeVariableType.Scalar, value: 8 }, iota: { type: RecipeVariableType.Scalar, value: 9 }, kappa: { type: RecipeVariableType.Scalar, value: 10 }, lambda: { type: RecipeVariableType.Scalar, value: 11 }, mu: { type: RecipeVariableType.Scalar, value: 12 }, nu: { type: RecipeVariableType.Scalar, value: 13 }, xi: { type: RecipeVariableType.Scalar, value: 14 }, omicron: { type: RecipeVariableType.Scalar, value: 15 }, pi: { type: RecipeVariableType.Scalar, value: 16 }, rho: { type: RecipeVariableType.Scalar, value: 17 }, sigma: { type: RecipeVariableType.Scalar, value: 18 }, tau: { type: RecipeVariableType.Scalar, value: 19 }, upsilon: { type: RecipeVariableType.Scalar, value: 20 }, phi: { type: RecipeVariableType.Scalar, value: 21 }, chi: { type: RecipeVariableType.Scalar, value: 22 }, psi: { type: RecipeVariableType.Scalar, value: 23 }, omega: { type: RecipeVariableType.Scalar, value: 24 }, alphaPrime: { type: RecipeVariableType.Scalar, value: 25 }, betaPrime: { type: RecipeVariableType.Scalar, value: 26 },
  }
}

const testHugeScalar: RawRecipe = {
  eq: "${gargantuan} + ${colossal}",
  variables: {
    gargantuan: { type: RecipeVariableType.Scalar, value: Number.MAX_SAFE_INTEGER },
    colossal: { type: RecipeVariableType.Scalar, value: Number.MAX_SAFE_INTEGER },
  },
};

const testDivideByZero: RawRecipe = {
  eq: "${dividend} / ${divisor}",
  variables: {
    dividend: { type: RecipeVariableType.Scalar, value: 10 },
    divisor: { type: RecipeVariableType.Scalar, value: 0 }, // This will cause a divide by zero error
  },
};

const testLongVariableNames: RawRecipe = {
  eq: "${aVeryLongAndDescriptiveVariableName} + ${anotherSuperLongAndVerboseVariableName}",
  variables: {
    aVeryLongAndDescriptiveVariableName: { type: RecipeVariableType.Scalar, value: 1 },
    anotherSuperLongAndVerboseVariableName: { type: RecipeVariableType.Scalar, value: 2 },
  },
};

const testBadCharactersInEquation: RawRecipe = {
  eq: "${badApple} % 3 & ${rottenTomato} | | $ 7",
  variables: {
    badApple: { type: RecipeVariableType.Scalar, value: 10 },
    rottenTomato: { type: RecipeVariableType.Scalar, value: 20 },
  },
};

const testEmptyStringTemplate: RawRecipe = {
  eq: "${}",
  variables: {
    emptyMind: { type: RecipeVariableType.Scalar, value: 10 },
    blankSlate: { type: RecipeVariableType.Scalar, value: 20 },
  },
};

const testNumberVariableName: RawRecipe = {
  eq: "${5}",
  variables: {
    5: { type: RecipeVariableType.Scalar, value: 10 }, // Invalid variable name
    someOtherVar: { type: RecipeVariableType.Scalar, value: 20 },
  },
};

const test1800Variables: RawRecipe = {
  eq: new Array(1800).fill(0).map((_, i) => `\${V${i}}`).join("+"),
  variables: Object.fromEntries(
    new Array(1800).fill(0).map((_, i) => [`V${i}`, { type: RecipeVariableType.Scalar, value: i }])
  ),
};

const test3000Variables: RawRecipe = {
  eq: new Array(3000).fill(0).map((_, i) => `\${V${i}}`).join("+"),
  variables: Object.fromEntries(
    new Array(3000).fill(0).map((_, i) => [`V${i}`, { type: RecipeVariableType.Scalar, value: i }])
  ),
};

const testHugeVector: RawRecipe = {
  eq: "${timeSeriesOfDoom} * 0.5",
  variables: {
    timeSeriesOfDoom: { type: RecipeVariableType.DataSeries, value: Object.fromEntries(new Array(10000).fill(1).map((v, i) => [2020 + i, v])) }, // Huge dataSeries
  },
};

const testMixedDataVector: RawRecipe = {
  eq: "${chaoticDataStream} * 0.5",
  variables: {
    chaoticDataStream: { type: RecipeVariableType.DataSeries, value: { "2020": 1, "2021": 2, "2022": 3, "2023": null, "2025": 5, "2026": 6, "2027": 7 } }, // Mixed data types
  },
};

const testInvalidVector: RawRecipe = {
  eq: "${corruptedDataFlow} * 0.5",
  variables: {
    corruptedDataFlow: { type: RecipeVariableType.DataSeries, value: { "2020": 1, "2021": 2, "2022": "three", "2023": 4, "2024": 5 } as unknown as DataSeriesArray }, // Invalid dataSeries with a string
  },
};

const testNegativeValues: RawRecipe = {
  eq: "${depth} + ${pressure}",
  variables: {
    depth: { type: RecipeVariableType.DataSeries, value: { "2020": -1, "2021": -2, "2022": -3 } },
    pressure: { type: RecipeVariableType.DataSeries, value: { "2020": -4, "2021": -5, "2022": -6 } },
  },
};

const testNegativeVectorValues: RawRecipe = {
  eq: "${theVoidStaresBack} * 2",
  variables: {
    theVoidStaresBack: { type: RecipeVariableType.DataSeries, value: { "2020": -1, "2021": -2, "2022": -3 } }, // Negative dataSeries values
  },
};

const testUnicodeVariableNames: RawRecipe = {
  eq: "${变量1} + ${变量2}",
  variables: {
    变量1: { type: RecipeVariableType.Scalar, value: 10 },
    变量2: { type: RecipeVariableType.Scalar, value: 20 },
  },
};

const testVariableNameWithSpaces: RawRecipe = {
  eq: "${The Quick Brown Fox} / ${Jumps Over The Lazy Dog}",
  variables: {
    "The Quick Brown Fox": { type: RecipeVariableType.DataSeries, value: { "2020": 5, "2021": 25, "2022": 123, "2023": 68, "2024": 675, "2027": 23, "2029": 34, "2030": 56, "2031": 78, "2032": 90 } },
    "Jumps Over The Lazy Dog": { type: RecipeVariableType.Scalar, value: 2 },
  },
};

const testNoEarlyDataInDataSeries: RawRecipe = {
  eq: "${intermittentSignal} * ${amplificationFactor}",
  variables: {
    "intermittentSignal": { type: RecipeVariableType.DataSeries, value: { "2023": 0, "2024": 12, "2025": 33, "2026": 0, "2030": 2, "2031": 12, "2032": 23, "2033": 4, "2034": 5, "2035": 6 } },
    "amplificationFactor": { type: RecipeVariableType.Scalar, value: 0.03 },
  },
};

const testOperatorPrecedence: RawRecipe = {
  eq: "(${a} + ${b}) * ${c} / (${d} - ${e})^2",
  variables: {
    a: { type: RecipeVariableType.Scalar, value: 10 },
    b: { type: RecipeVariableType.Scalar, value: 5 },
    c: { type: RecipeVariableType.Scalar, value: 2 },
    d: { type: RecipeVariableType.Scalar, value: 4 },
    e: { type: RecipeVariableType.Scalar, value: 2 },
  },
};

const testMathFunctions: RawRecipe = {
  eq: "map(map(map(${matrix}, sin), abs), sqrt) + log(${ten}) - pow(${a number}, 2)",
  variables: {
    matrix: { type: RecipeVariableType.DataSeries, value: { "2020": -1, "2021": 0.5, "2022": 1 } },
    ten: { type: RecipeVariableType.Scalar, value: 10 },
    "a number": { type: RecipeVariableType.Scalar, value: 2 },
  },
};

const testComplexResult: RawRecipe = {
  eq: "sqrt(${a})",
  variables: {
    a: { type: RecipeVariableType.Scalar, value: -4 },
  },
};

const testInfinityResult: RawRecipe = {
  eq: "log(${a})",
  variables: {
    a: { type: RecipeVariableType.Scalar, value: 0 },
  },
};

const testMatrixResult: RawRecipe = {
  eq: "${a} * transpose(${b})",
  variables: {
    a: { type: RecipeVariableType.DataSeries, value: { "2020": 1, "2021": 2 } },
    b: { type: RecipeVariableType.DataSeries, value: { "2020": 3, "2021": 4 } },
  },
};

const testUnitCalculation: RawRecipe = {
  eq: "${distance} / ${time}",
  variables: {
    distance: { type: RecipeVariableType.DataSeries, value: { "2020": 100, "2021": 200 }, unit: "km" },
    time: { type: RecipeVariableType.Scalar, value: 2, unit: "h" },
  },
};

const testIncompatibleUnits: RawRecipe = {
  eq: "${mass} + ${length}",
  variables: {
    mass: { type: RecipeVariableType.Scalar, value: 10, unit: "kg" },
    length: { type: RecipeVariableType.Scalar, value: 5, unit: "m" },
  },
};

const testRecursiveDefinition: RawRecipe = {
  eq: "${a}",
  variables: {
    a: { type: RecipeVariableType.Scalar, value: "${b}" as any },
    b: { type: RecipeVariableType.Scalar, value: 10 },
  },
};

const testInvalidSyntax: RawRecipe = {
  eq: "sqrt(4",
  variables: {},
};

const testReservedJSKeywords: RawRecipe = {
  eq: "${function} + ${class} * ${case}",
  variables: {
    function: { type: RecipeVariableType.Scalar, value: 1 },
    class: { type: RecipeVariableType.Scalar, value: 2 },
    case: { type: RecipeVariableType.Scalar, value: 3 },
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
  { description: "Operator precedence", recipe: testOperatorPrecedence, shouldPass: true },
  { description: "Math functions", recipe: testMathFunctions, shouldPass: true },
  { description: "Complex number result", recipe: testComplexResult, shouldPass: false },
  { description: "Infinity result", recipe: testInfinityResult, shouldPass: false },
  { description: "Matrix result", recipe: testMatrixResult, shouldPass: false },
  { description: "Unit calculation", recipe: testUnitCalculation, shouldPass: false },
  { description: "Incompatible units", recipe: testIncompatibleUnits, shouldPass: false },
  { description: "Recursive definition", recipe: testRecursiveDefinition, shouldPass: false },
  { description: "Invalid syntax", recipe: testInvalidSyntax, shouldPass: false },
  { description: "Reserved JS keywords", recipe: testReservedJSKeywords, shouldPass: true },
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