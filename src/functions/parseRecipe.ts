import mathjs from "@/math.ts";
import {
  DataSeries,
  ParsedRecipe,
  ParsedRecipeVariables,
  RecipeParserOptions,
  UnparsedRecipe,
  defaultRecipeParserOptions
} from "./recipe-parser/types.js";

import { RecipeError, RecipeEquationError, RecipeVariablesError } from "./recipe-parser/errors.js";
import { groupVariables, trunc } from "./recipe-parser/helpers.js";
import { normalizeRecipeVariableNames } from "./recipe-parser/normalize.js";
import { sketchyDataSeries, sketchyExternalDatasets, sketchyScalars, sketchyUrls, sketchyVectors } from "./recipe-parser/sanity-checks.js";
import { vectorToDataSeries } from "./recipe-parser/transformations.js";

export * from "./recipe-parser/errors.js";
export * from "./recipe-parser/types.js";

export function parseRecipe(recipe: UnparsedRecipe | string, options: Partial<RecipeParserOptions> = defaultRecipeParserOptions): { recipe: ParsedRecipe, result: DataSeries, warnings: string[] } {
  options = { ...defaultRecipeParserOptions, ...options };

  const warnings: string[] = [];
  const normalizedNamesRecipe = normalizeRecipeVariableNames(recipe, warnings);

  console.log(trunc(`Parsing recipe... ${normalizedNamesRecipe.eq}`));

  // Extract variables from the equation
  const variablesInEq = normalizedNamesRecipe.eq.match(/\$\{([\w-]+)\}/g);

  // No variables
  if (!variablesInEq) {
    // This should be caught by validateRecipeType, but as a safeguard:
    throw new RecipeEquationError("No variables found in the equation");
  }

  const definedVariables = Object.keys(normalizedNamesRecipe.variables);

  // Missing variable definitions
  const missingVariables = variablesInEq.map(v => v.replace(/\$\{|\}/g, "")).filter(v => !definedVariables.includes(v));
  if (missingVariables.length > 0) {
    throw new RecipeVariablesError(`Missing variables in the equation: ${missingVariables.join(", ")}`);
  }

  // Excess variable definitions
  const extraVariables = definedVariables.filter(v => !variablesInEq.includes(`\${${v}}`));
  if (extraVariables.length > 0) {
    warnings.push(`Extra variables defined but not used in the equation: ${extraVariables.join(", ")}`);
  }


  // Variable type sanity checks
  const { vectors, scalars, urls, dataSeries, externalDatasets } = groupVariables(normalizedNamesRecipe.variables);

  sketchyScalars(scalars, warnings);
  sketchyVectors(vectors, warnings);
  sketchyUrls(urls, warnings);
  sketchyDataSeries(dataSeries, warnings);
  sketchyExternalDatasets(externalDatasets, warnings);

  // Transform vectors to data series
  const transformedVariables: ParsedRecipeVariables = {};
  for (const [key, variable] of Object.entries(normalizedNamesRecipe.variables)) {
    switch (variable.type) {
      case "scalar":
        transformedVariables[key] = variable; // Scalars remain unchanged
        break;
      case "vector":
        // Convert vector to data series
        transformedVariables[key] = {
          type: "dataSeries",
          value: vectorToDataSeries(variable.value),
        };
        break;
      case "dataSeries":
        // Data series remain unchanged
        transformedVariables[key] = variable;
        break;
      case "url":
        // Ignore for now. TODO - implement URL handling
        console.warn(`Ignoring URL variable '${key}' for now. TODO - implement URL handling.`);
        break;
      case "externalDataset":
        // Ignore for now. TODO - implement external dataset handling
        console.warn(`Ignoring external dataset variable '${key}' for now. TODO - implement external dataset handling.`);
        break;
      default:
        // @ts-expect-error - In case of extreme type mismanagement
        throw new RecipeVariablesError(`Unknown variable type for '${key}': ${variable.type}`);
    }
  }

  const normalizedRecipe: ParsedRecipe = {
    eq: normalizedNamesRecipe.eq,
    variables: transformedVariables,
  };

  console.log(trunc(`Normalized recipe: ${JSON.stringify(normalizedRecipe)}`));

  /** Replace all variables with their values to prepare for calculation */
  const resolvedEquation = normalizedRecipe.eq.replace(/\$\{(\w+)\}/g, (_, varName) => {
    if (normalizedRecipe.variables[varName]) {
      const variable = normalizedRecipe.variables[varName];

      // TODO - handle ExternalDataset stuff
      switch (variable.type) {
        case "scalar":
          return mathjs.format(variable.value);
        case "dataSeries":
          // return mathjs.format(Object.values(variable.value));
          return mathjs.format(Object.entries(variable.value).map(([, value]) => value ?? 0)); // Convert data series to a string representation
        default:
          throw new RecipeVariablesError(`Unknown variable type for '${varName}': ${variable.type}`);
      }
    }
    else {
      throw new RecipeVariablesError(`Variable '${varName}' not found in the recipe variables.`);
    }
  });

  console.log(trunc(`Resolved equation: ${resolvedEquation}`));

  const rawResult: number | math.Matrix = mathjs.evaluate(resolvedEquation);

  if (mathjs.isNaN(rawResult)) {
    throw new RecipeEquationError("Result is NaN. This may be due to invalid operations such as division by zero or invalid mathematical operations.");
  }
  if (mathjs.isComplex(rawResult)) {
    throw new RecipeEquationError("Result is a complex number. This may be due to invalid operations or complex numbers in the equation.");
  }
  if (mathjs.isUnit(rawResult)) {
    throw new RecipeEquationError("Result is a unit. This may be due to invalid operations or units in the equation.");
  }
  if (mathjs.isBigNumber(rawResult)) {
    throw new RecipeEquationError("Result is a BigNumber. This may be due to invalid operations or very large numbers in the equation.");
  }

  // Return depending on the type of result
  if (typeof rawResult === "number" && Number.isFinite(rawResult)) {
    warnings.push("Recipe result is a single number. This may not be what you expected. Consider using vectors or data series for more complex calculations. Filling the result with the same number for each year.");
    return {
      recipe: normalizedRecipe,
      result: vectorToDataSeries(new Array(31).fill(rawResult)), // Fill with the same number for each year
      warnings
    };
  }

  if (Array.isArray(rawResult)) {
    return {
      recipe: normalizedRecipe,
      result: vectorToDataSeries(rawResult as (number | string | null | undefined)[]),
      warnings
    };
  }

  throw new RecipeError("Unexpected result type. Expected a number or an array of numbers.");
}

function normalizeArray(arr: (number | string | null | undefined)[], options = defaultRecipeParserOptions): number[] {
  options = { ...defaultRecipeParserOptions, ...options };

  for (const [index, value] of arr.entries()) {
    // Strings to numbers
    if (typeof value === "string") {
      const numValue = parseFloat(value);
      if (Number.isNaN(numValue)) throw new RecipeError(`Invalid number in array at index ${index}: '${value}'`);
      arr[index] = numValue; // Convert string to number
    }

    // Handle null and undefined
    if (value === null || value === undefined) {
      switch (options.interpolationMethod) {
        case "zero_fill":
          arr[index] = 0; // Fill with zero
          break;
        case "interpolate_missing":
          // Interpolate missing values (simple linear interpolation)
          const firstValidPrev = arr.slice(0, index).reverse().find(v => v !== null && v !== undefined);
          const firstValidNext = arr.slice(index + 1).find(v => v !== null && v !== undefined);
          if (firstValidPrev !== undefined && firstValidNext !== undefined) {
            arr[index] = (parseFloat(firstValidPrev.toString()) + parseFloat(firstValidNext.toString())) / 2; // Average of previous and next valid values
          } else if (firstValidPrev !== undefined) {
            arr[index] = firstValidPrev; // Use previous valid value
          } else if (firstValidNext !== undefined) {
            arr[index] = firstValidNext; // Use next valid value
          } else {
            arr[index] = 0; // Default to zero if no valid neighbors
            console.warn(`Unable to interpolate missing value at index ${index}. Using zero fill.`);
          }
          break;
        default:
          arr[index] = 0; // Default to zero fill for other methods
          break;
      }
    }
  }
  return arr as number[];
}

const array1 = [, 94, 73, 35, 84, 87, 24, 15, 23, , , 14, 13, 91, 27, 69, undefined, 24, null, 80, 62, undefined, 18, 60, 1, 81, 53, 91, 23, 8, 36]
const array2 = [4, 123, 45, 67, 89, 12, 34, 56, 78, 90, 11, 22, 33, 44, 55, 66, 77, 88, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 456, , , 234, 22222,];

const raw = [...array1];
console.log(`Raw(${raw.length}):`, raw);

// const zeroFill = normalizeArray([...array1], { interpolationMethod: "zero_fill" });
// console.log(`Zero(${zeroFill.length}):`, zeroFill);

const interpolate1 = normalizeArray([...array1], { interpolationMethod: "interpolate_missing" });
console.log(`Interpolate(${interpolate1.length}):`, interpolate1);

const interpolate2 = normalizeArray([...array2], { interpolationMethod: "interpolate_missing" });
console.log(`Interpolate(${interpolate2.length}):`, interpolate2);

const a = mathjs.format(interpolate1);
const b = mathjs.format(interpolate2);

const eq = `(${a} + ${b}) / 3`;
const node = mathjs.parse(eq);
try {
  const result = mathjs.evaluate(eq);
  console.log(`Result: ${result}`);
}
catch (error) {
  console.error(error.message);
}

// function makeSVG(data: number[]) {
//   const width = 1280;
//   const height = 720;

//   // Make line chart
//   const points = data.map((value, index) => `${index * (width / data.length)},${height - value}`).join(" ");
//   let svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;
//   svg += `<polyline points="${points}" fill="none" stroke="blue" stroke-width="2" />`;
//   svg += `<line x1="0" y1="${height}" x2="${width}" y2="${height}" stroke="black" stroke-width="1" />`; // X-axis
//   svg += `<line x1="0" y1="0" x2="0" y2="${height}" stroke="black" stroke-width="1" />`; // Y-axis
//   svg += `<text x="${width / 2}" y="${height - 5}" text-anchor="middle" font-size="12">Index</text>`;
//   svg += `<text x="5" y="${height / 2}" text-anchor="middle" font-size="12" transform="rotate(-90, 5, ${height / 2})">Value</text>`;
//   svg += `<text x="${width / 2}" y="15" text-anchor="middle" font-size="14">Data Series</text>`;
//   svg += `</svg>`;

//   return svg;
// }

// import fs from "node:fs";
// fs.writeFileSync("src/functions/recipe-parser/zero-fill.svg", makeSVG(zeroFill));
// fs.writeFileSync("src/functions/recipe-parser/interpolate.svg", makeSVG(interpolate));
// console.log("SVG files created: zero-fill.svg and interpolate.svg");