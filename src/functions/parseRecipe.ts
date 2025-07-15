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

  /** Replace all variables with their values to prepare for calculation */
  const resolvedEquation = normalizedRecipe.eq.replace(/\$\{(\w+)\}/g, (_, varName) => {
    if (normalizedRecipe.variables[varName]) {
      const variable = normalizedRecipe.variables[varName];

      // TODO - handle ExternalDataset stuff
      switch (variable.type) {
        case "scalar":
          return variable.value.toString();
        case "dataSeries":
          return `{${Object.entries(variable.value).map(([, value]) => value ?? "0").join(", ")}}`; // Convert data series to a string representation
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
  if (typeof rawResult === "number" && isFinite(rawResult)) {
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