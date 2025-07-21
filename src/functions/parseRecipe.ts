// import mathjs from "@/math.ts";
// import {
//   DataSeries,
//   ParsedRecipe,
//   ParsedRecipeVariables,
//   RecipeParserOptions,
//   UnparsedRecipe,
//   defaultRecipeParserOptions
// } from "./recipe-parser/types.js";

import { randomUUID } from "node:crypto";
import { getVariableName } from "./recipe-parser/helpers";
import { vectorToDataSeries, years } from "./recipe-parser/transformations";

// import { RecipeError, RecipeEquationError, RecipeVariablesError } from "./recipe-parser/errors.js";
// import { groupVariables, trunc } from "./recipe-parser/helpers.js";
// import { normalizeRecipeVariableNames } from "./recipe-parser/normalize.js";
// import { sketchyDataSeries, sketchyExternalDatasets, sketchyScalars, sketchyUrls, sketchyVectors } from "./recipe-parser/sanity-checks.js";
// import { vectorToDataSeries } from "./recipe-parser/transformations.js";

// export * from "./recipe-parser/errors.js";
// export * from "./recipe-parser/types.js";

// export function parseRecipe(recipe: UnparsedRecipe | string, options: Partial<RecipeParserOptions> = defaultRecipeParserOptions): { recipe: ParsedRecipe, result: DataSeries, warnings: string[] } {
//   options = { ...defaultRecipeParserOptions, ...options };

//   const warnings: string[] = [];
//   const normalizedNamesRecipe = normalizeRecipeVariableNames(recipe, warnings);

//   console.log(trunc(`Parsing recipe... ${normalizedNamesRecipe.eq}`));

//   // Extract variables from the equation
//   const variablesInEq = normalizedNamesRecipe.eq.match(/\$\{([\w-]+)\}/g);

//   // No variables
//   if (!variablesInEq) {
//     // This should be caught by validateRecipeType, but as a safeguard:
//     throw new RecipeEquationError("No variables found in the equation");
//   }

//   const definedVariables = Object.keys(normalizedNamesRecipe.variables);

//   // Missing variable definitions
//   const missingVariables = variablesInEq.map(v => v.replace(/\$\{|\}/g, "")).filter(v => !definedVariables.includes(v));
//   if (missingVariables.length > 0) {
//     throw new RecipeVariablesError(`Missing variables in the equation: ${missingVariables.join(", ")}`);
//   }

//   // Excess variable definitions
//   const extraVariables = definedVariables.filter(v => !variablesInEq.includes(`\${${v}}`));
//   if (extraVariables.length > 0) {
//     warnings.push(`Extra variables defined but not used in the equation: ${extraVariables.join(", ")}`);
//   }


//   // Variable type sanity checks
//   const { vectors, scalars, urls, dataSeries, externalDatasets } = groupVariables(normalizedNamesRecipe.variables);

//   sketchyScalars(scalars, warnings);
//   sketchyVectors(vectors, warnings);
//   sketchyUrls(urls, warnings);
//   sketchyDataSeries(dataSeries, warnings);
//   sketchyExternalDatasets(externalDatasets, warnings);

//   // Transform vectors to data series
//   const transformedVariables: ParsedRecipeVariables = {};
//   for (const [key, variable] of Object.entries(normalizedNamesRecipe.variables)) {
//     switch (variable.type) {
//       case "scalar":
//         transformedVariables[key] = variable; // Scalars remain unchanged
//         break;
//       case "vector":
//         // Convert vector to data series
//         transformedVariables[key] = {
//           type: "dataSeries",
//           value: vectorToDataSeries(variable.value),
//         };
//         break;
//       case "dataSeries":
//         // Data series remain unchanged
//         transformedVariables[key] = variable;
//         break;
//       case "url":
//         // Ignore for now. TODO - implement URL handling
//         console.warn(`Ignoring URL variable '${key}' for now. TODO - implement URL handling.`);
//         break;
//       case "externalDataset":
//         // Ignore for now. TODO - implement external dataset handling
//         console.warn(`Ignoring external dataset variable '${key}' for now. TODO - implement external dataset handling.`);
//         break;
//       default:
//         // @ts-expect-error - In case of extreme type mismanagement
//         throw new RecipeVariablesError(`Unknown variable type for '${key}': ${variable.type}`);
//     }
//   }

//   const normalizedRecipe: ParsedRecipe = {
//     eq: normalizedNamesRecipe.eq,
//     variables: transformedVariables,
//   };

//   console.log(trunc(`Normalized recipe: ${JSON.stringify(normalizedRecipe)}`));

//   /** Replace all variables with their values to prepare for calculation */
//   const resolvedEquation = normalizedRecipe.eq.replace(/\$\{(\w+)\}/g, (_, varName) => {
//     if (normalizedRecipe.variables[varName]) {
//       const variable = normalizedRecipe.variables[varName];

//       // TODO - handle ExternalDataset stuff
//       switch (variable.type) {
//         case "scalar":
//           return mathjs.format(variable.value);
//         case "dataSeries":
//           // return mathjs.format(Object.values(variable.value));
//           return mathjs.format(Object.entries(variable.value).map(([, value]) => value ?? 0)); // Convert data series to a string representation
//         default:
//           throw new RecipeVariablesError(`Unknown variable type for '${varName}': ${variable.type}`);
//       }
//     }
//     else {
//       throw new RecipeVariablesError(`Variable '${varName}' not found in the recipe variables.`);
//     }
//   });

//   console.log(trunc(`Resolved equation: ${resolvedEquation}`));

//   const rawResult: number | math.Matrix = mathjs.evaluate(resolvedEquation);
//   // const node = mathjs.parse(resolvedEquation);
//   // let rawResult: number | math.Matrix | math.Complex | math.Unit | math.BigNumber;
//   // try {
//   //   rawResult = node.evaluate();
//   // }
//   // catch (error) {
//   //   throw new RecipeEquationError(`Error evaluating the equation: ${error instanceof Error ? error.message : String(error)}`);
//   // }

//   if (mathjs.isNaN(rawResult)) {
//     throw new RecipeEquationError("Result is NaN. This may be due to invalid operations such as division by zero or invalid mathematical operations.");
//   }
//   if (mathjs.isComplex(rawResult)) {
//     throw new RecipeEquationError("Result is a complex number. This may be due to invalid operations or complex numbers in the equation.");
//   }
//   if (mathjs.isUnit(rawResult)) {
//     throw new RecipeEquationError("Result is a unit. This may be due to invalid operations or units in the equation.");
//   }
//   if (mathjs.isBigNumber(rawResult)) {
//     throw new RecipeEquationError("Result is a BigNumber. This may be due to invalid operations or very large numbers in the equation.");
//   }

//   // Return depending on the type of result
//   if (typeof rawResult === "number" && Number.isFinite(rawResult)) {
//     warnings.push("Recipe result is a single number. This may not be what you expected. Consider using vectors or data series for more complex calculations. Filling the result with the same number for each year.");
//     return {
//       recipe: normalizedRecipe,
//       result: vectorToDataSeries(new Array(31).fill(rawResult)), // Fill with the same number for each year
//       warnings
//     };
//   }

//   if (Array.isArray(rawResult)) {
//     return {
//       recipe: normalizedRecipe,
//       result: vectorToDataSeries(rawResult as (number | string | null | undefined)[]),
//       warnings
//     };
//   }

//   throw new RecipeError("Unexpected result type. Expected a number or an array of numbers.");
// }

// function normalizeArray(arr: (number | string | null | undefined)[], options = defaultRecipeParserOptions): number[] {
//   options = { ...defaultRecipeParserOptions, ...options };

//   for (const [index, value] of arr.entries()) {
//     // Strings to numbers
//     if (typeof value === "string") {
//       const numValue = parseFloat(value);
//       if (Number.isNaN(numValue)) throw new RecipeError(`Invalid number in array at index ${index}: '${value}'`);
//       arr[index] = numValue; // Convert string to number
//     }

//     // Handle null and undefined
//     if (value === null || value === undefined) {
//       switch (options.interpolationMethod) {
//         case "zero_fill":
//           arr[index] = 0; // Fill with zero
//           break;
//         case "interpolate_missing":
//           // Interpolate missing values (simple linear interpolation)
//           const firstValidPrev = arr.slice(0, index).reverse().find(v => v !== null && v !== undefined);
//           const firstValidNext = arr.slice(index + 1).find(v => v !== null && v !== undefined);
//           if (firstValidPrev !== undefined && firstValidNext !== undefined) {
//             arr[index] = (parseFloat(firstValidPrev.toString()) + parseFloat(firstValidNext.toString())) / 2; // Average of previous and next valid values
//           } else if (firstValidPrev !== undefined) {
//             arr[index] = firstValidPrev; // Use previous valid value
//           } else if (firstValidNext !== undefined) {
//             arr[index] = firstValidNext; // Use next valid value
//           } else {
//             arr[index] = 0; // Default to zero if no valid neighbors
//             console.warn(`Unable to interpolate missing value at index ${index}. Using zero fill.`);
//           }
//           break;
//         default:
//           arr[index] = 0; // Default to zero fill for other methods
//           break;
//       }
//     }
//   }
//   return arr as number[];
// }

// const a = [, 94, 73, 35, 84, 87, 24, 15, 23, , , 14, 13, 91, 27, 69, undefined, 24, null, 80, 62, undefined, 18, 60, 1, 81, 53, 91, 23, 8, 36]
// const b = [4, 123, 45, 67, 89, 12, 34, 56, 78, 90, 11, 22, 33, 44, 55, 66, 77, 88, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 456, , , 234, 22222,];
// // const array1 = [, 94, 73, 35, 84, 87, 24, 15, 23, , , 14, 13, 91, 27, 69, undefined, 24, null, 80, 62, undefined, 18, 60, 1, 81, 53, 91, 23, 8, 36]
// // const array2 = [4, 123, 45, 67, 89, 12, 34, 56, 78, 90, 11, 22, 33, 44, 55, 66, 77, 88, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 456, , , 234, 22222,];

// const eq = `(${mathjs.format(normalizeArray(a))} + ${mathjs.format(normalizeArray(b))}) / 3`;
// console.log(eq);
// const node = mathjs.parse(eq);
// console.log(node);

// // const raw = [...array1];
// // console.log(`Raw(${raw.length}):`, raw);

// // // const zeroFill = normalizeArray([...array1], { interpolationMethod: "zero_fill" });
// // // console.log(`Zero(${zeroFill.length}):`, zeroFill);

// // const interpolate1 = normalizeArray([...array1], { interpolationMethod: "interpolate_missing" });
// // console.log(`Interpolate(${interpolate1.length}):`, interpolate1);

// // const interpolate2 = normalizeArray([...array2], { interpolationMethod: "interpolate_missing" });
// // console.log(`Interpolate(${interpolate2.length}):`, interpolate2);

// // const a = mathjs.format(interpolate1);
// // const b = mathjs.format(interpolate2);

// // const eq = `(${a} + ${b}) / 3`;
// // const node = mathjs.parse(eq);
// // try {
// //   const result = mathjs.evaluate(eq);
// //   console.log(`Result: ${result}`);
// // }
// // catch (error) {
// //   console.error(error.message);
// // }

// // function makeSVG(data: number[]) {
// //   const width = 1280;
// //   const height = 720;

// //   // Make line chart
// //   const points = data.map((value, index) => `${index * (width / data.length)},${height - value}`).join(" ");
// //   let svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;
// //   svg += `<polyline points="${points}" fill="none" stroke="blue" stroke-width="2" />`;
// //   svg += `<line x1="0" y1="${height}" x2="${width}" y2="${height}" stroke="black" stroke-width="1" />`; // X-axis
// //   svg += `<line x1="0" y1="0" x2="0" y2="${height}" stroke="black" stroke-width="1" />`; // Y-axis
// //   svg += `<text x="${width / 2}" y="${height - 5}" text-anchor="middle" font-size="12">Index</text>`;
// //   svg += `<text x="5" y="${height / 2}" text-anchor="middle" font-size="12" transform="rotate(-90, 5, ${height / 2})">Value</text>`;
// //   svg += `<text x="${width / 2}" y="15" text-anchor="middle" font-size="14">Data Series</text>`;
// //   svg += `</svg>`;

// //   return svg;
// // }

// // import fs from "node:fs";
// // fs.writeFileSync("src/functions/recipe-parser/zero-fill.svg", makeSVG(zeroFill));
// // fs.writeFileSync("src/functions/recipe-parser/interpolate.svg", makeSVG(interpolate));
// // console.log("SVG files created: zero-fill.svg and interpolate.svg");

type uuid = string;
type DataSeriesDbEntry = {
  uuid: uuid;
  unit?: string;
  data: DataSeriesArray;
};
const dataSeriesDB: Record<uuid, DataSeriesDbEntry> = {};


export type DataSeriesArray = {
  "2020": number | null;
  "2021": number | null;
  "2022": number | null;
  "2023": number | null;
  "2024": number | null;
  "2025": number | null;
  "2026": number | null;
  "2027": number | null;
  "2028": number | null;
  "2029": number | null;
  "2030": number | null;
  "2031": number | null;
  "2032": number | null;
  "2033": number | null;
  "2034": number | null;
  "2035": number | null;
  "2036": number | null;
  "2037": number | null;
  "2038": number | null;
  "2039": number | null;
  "2040": number | null;
  "2041": number | null;
  "2042": number | null;
  "2043": number | null;
  "2044": number | null;
  "2045": number | null;
  "2046": number | null;
  "2047": number | null;
  "2048": number | null;
  "2049": number | null;
  "2050": number | null;
};

export type RecipeVariableScalar = {
  type: "scalar";
  value: number;
  unit?: string;
};
export type RecipeVariableVector = {
  type: "vector";
  value: (number | string | null | undefined)[];
  unit?: string;
};
/** A data series might be defined in the inheritance form or it might be imported and it might have a unit */
export type RecipeVariableRawDataSeries = {
  type: "dataSeries";
  link: string; // uuid of data series in the database
} | {
  type: "dataSeries";
  value: Partial<DataSeriesArray>;
  unit?: string;
};
export type RecipeVariableDataSeries = {
  type: "dataSeries";
  link: uuid; // uuid of data series in the database
};

type RecipeVariables = RecipeVariableScalar | RecipeVariableDataSeries;
export type Recipe = {
  eq: string;
  variables: Record<string, RecipeVariables>;
}

type RawRecipeVariables = RecipeVariableScalar | RecipeVariableVector | RecipeVariableRawDataSeries;
/** Considered unsafe as it is. Comes from the client */
export type RawRecipe = {
  eq: string;
  variables: Record<string, RawRecipeVariables>;
}

export class RecipeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RecipeError";
  }
}

export function recipeFromString(recipe: string): RawRecipe {
  try {
    return JSON.parse(recipe) as RawRecipe;
  } catch (error) {
    throw new RecipeError(`Failed to parse recipe from string: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function parseRecipe(rawRecipe: RawRecipe): Recipe {
  // Basic validation of the recipe structure
  if (!rawRecipe || typeof rawRecipe !== "object" || !rawRecipe.eq || !rawRecipe.variables || Array.isArray(rawRecipe) || Array.isArray(rawRecipe.variables) || Array.isArray(rawRecipe.eq)) {
    throw new RecipeError("Invalid recipe format. Expected an object with 'eq' and 'variables' properties.");
  }

  const parsedRecipe: Recipe = {} as Recipe;

  /** 
   * Cast and clean variables
   */
  const parsedVariables: Record<string, RecipeVariables> = {};
  for (const [key, variable] of Object.entries(rawRecipe.variables)) {
    /** Scalar parsing */
    if (variable.type === "scalar") {
      let value = variable.value;
      if (typeof value !== "number") {
        value = parseFloat(value as string);
        if (isNaN(value)) {
          throw new RecipeError(`Invalid scalar value for variable '${key}': expected a number, got ${typeof variable.value}`);
        }
      }
      if (!Number.isFinite(value)) {
        throw new RecipeError(`Scalar value for variable '${key}' is not finite: ${value}`);
      }
      parsedVariables[key] = { type: "scalar", value };
    }

    /** Vector parsing */
    else if (variable.type === "vector") {
      if (!Array.isArray(variable.value)) {
        throw new RecipeError(`Invalid vector value for variable '${key}': expected an array, got ${typeof variable.value}`);
      }

      const dataSeries = vectorToDataSeries(variable.value);

      if (!dataSeries) {
        throw new RecipeError(`Failed to convert vector to data series for variable '${key}'. Ensure the vector has valid numeric values.`);
      }
      if (Object.keys(dataSeries).length === 0) {
        throw new RecipeError(`Converted vector to data series for variable '${key}' is empty. Ensure the vector has valid numeric values.`);
      }

      // Write to "db" and link TODO - do this properly
      const uuid = randomUUID();
      dataSeriesDB[uuid] = {
        uuid,
        data: dataSeries,
        unit: variable.unit
      };
      parsedVariables[key] = { type: "dataSeries", link: uuid };
    }

    /** Data series parsing */
    else if (variable.type === "dataSeries") {
      // If it has a link, use that
      // @ts-expect-error - type checking
      const link = variable.link;
      if (link) {
        if (typeof link !== "string" || !dataSeriesDB[link]) {
          throw new RecipeError(`Invalid data series link for variable '${key}': link '${link}' does not exist in the database.`);
        }

        // If link is valid, use it
        parsedVariables[key] = { type: "dataSeries", link };
      }
      else {
        // @ts-expect-error - type checking
        const value = variable.value;

        if (typeof value !== "object" || value === null || Array.isArray(value)) {
          throw new RecipeError(`Invalid data series value for variable '${key}': expected an object, got ${typeof value}`);
        }

        // Validate the data series structure and map to known valid years
        const dataSeries: Partial<DataSeriesArray> = {};
        for (const year of years) {
          const inputValue = value[year];
          if (inputValue === undefined || inputValue === null) {
            dataSeries[year] = null; // Explicitly set to null for missing years
          }
          else if (typeof inputValue === "number" && Number.isFinite(inputValue)) {
            dataSeries[year] = inputValue; // Valid number
          }
          else {
            throw new RecipeError(`Invalid data series value for year '${year}' in variable '${key}': expected a finite number, got ${inputValue}`);
          }
        }

        // Check unit
        // @ts-expect-error - type checking
        const unit = variable.unit;
        if (unit && typeof unit !== "string") {
          throw new RecipeError(`Invalid unit for variable '${key}': expected a string, got ${typeof unit}`);
        }

        // Write to "db" and link TODO - do this properly
        const uuid = randomUUID();
        dataSeriesDB[uuid] = {
          uuid,
          data: dataSeries as DataSeriesArray,
          ...(unit ? { unit } : {})
        };

        parsedVariables[key] = { type: "dataSeries", link: uuid };
      }
    }

    /** Wtf... */
    else {
      throw new RecipeError(`Unknown variable type for '${key}': ` +
        // @ts-expect-error - In case of extreme type mismanagement
        variable.type
      );
    }
  }
  // Sanity checks
  if (Object.keys(parsedVariables).length === 0) {
    throw new RecipeError("No valid variables found in the recipe.");
  }

  /** 
   * Normalize variable names
   */
  const renamedVariables: Record<string, RecipeVariables> = {};
  const nameMapping: Record<string, string> = {};
  for (const [key, variable] of Object.entries(parsedVariables)) {
    const index = Object.keys(renamedVariables).length;
    const newName = getVariableName(index);

    // If it already exists, panic
    if (renamedVariables[newName]) {
      throw new RecipeError(`Variable name '${newName}' already exists. This should not happen.`);
    }

    renamedVariables[newName] = variable;
    nameMapping[key] = newName;
  }
  // Sanity checks
  if (Object.keys(nameMapping).length === 0) {
    throw new RecipeError("No valid variables found in the recipe after renaming.");
  }
  if (Object.keys(renamedVariables).length === 0) {
    throw new RecipeError("No valid variables found in the recipe after renaming.");
  }

  /** 
   * Replace variable names in the equation
   */
  let transformingEquation = rawRecipe.eq.trim();
  for (const [oldName, newName] of Object.entries(nameMapping)) {
    const split = transformingEquation.split(`\${${oldName}}`);
    if (split.length < 2) {
      // TODO - decide level of strictness here
      console.warn(`Variable '${oldName}' not found in the equation. This may be due to a variable not being used in the equation.`);
      // throw new RecipeError(`Variable '${oldName}' not found in the equation.`);
    }
    transformingEquation = split.join(`\${${newName}}`);
  }
  const renamedEquation = transformingEquation;
  // Sanity check
  if (!renamedEquation) {
    throw new RecipeError("Recipe equation is empty after renaming variables.");
  }


  /** 
   * Return the parsed recipe
  */
  parsedRecipe.eq = renamedEquation;
  parsedRecipe.variables = renamedVariables;
  return parsedRecipe;
}

const input: RawRecipe = {
  eq: "(${Aasdåaö\`a} + ${qdB}) / 2",
  variables: {
    "Aasdåaö\`a": { type: "scalar", value: 10 },
    qdB: { type: "vector", value: [1, 2, 3, 4, 5] },
    dfgvhsödlfsjlfdnkj: { type: "dataSeries", value: { "2020": 1, "2021": 2, "2022": 3 } }
  }
};
const rec = parseRecipe(input);

console.log("Before:");
console.log(input);
console.log("After:");
console.log(rec);

console.log(rec.variables);

// const dataSeries = rec.variables.C.value;
