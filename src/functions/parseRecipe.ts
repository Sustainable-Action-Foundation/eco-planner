import { randomUUID } from "node:crypto";
import { getVariableName } from "./recipe-parser/helpers";
import type { DataSeriesArray, EvalTimeDataSeries, EvalTimeScalar, RawRecipe, Recipe, RecipeVariableDataSeries, RecipeVariables, RecipeVariableScalar } from "./recipe-parser/types";
import { RecipeVariableType, isRawDataSeriesByValue, lenientIsRawDataSeriesByLink, isRecipeVariableScalar, MathjsError, RecipeError } from "./recipe-parser/types";
import { sketchyDataSeries, sketchyScalars } from "./recipe-parser/sanityChecks";
import mathjs from "@/math";
import { isStandardObject, uuidRegex } from "@/types";

const startYear = 2020;
const endYear = 2050;
export const years = Array.from({ length: endYear - startYear + 1 }, (_, i) => (startYear + i).toString()) as (keyof DataSeriesArray)[];

type DataSeriesDbEntry = {
  uuid: string;
  unit?: string;
  data: Partial<DataSeriesArray>;
};
const dataSeriesDB: Record<string, DataSeriesDbEntry> = {};

export function unsafeIsRawRecipe(recipe: unknown): recipe is RawRecipe {
  return (
    // Should be a regular object
    typeof recipe === "object" &&
    recipe != null &&
    !Array.isArray(recipe) &&
    // Should have equation string
    "eq" in recipe &&
    typeof recipe.eq === "string" &&
    // Should have variables object
    "variables" in recipe &&
    typeof recipe.variables === "object" &&
    recipe.variables != null &&
    !Array.isArray(recipe.variables) &&
    Object.entries(recipe.variables).every(([key, value]: [string, unknown]) => (
      // Each variable should have a string key and a value object
      typeof key === "string" &&
      typeof value === "object" &&
      value != null &&
      !Array.isArray(value) &&
      // Each variable should match a RawRecipeVariables type
      (
        // Scalar
        (
          "type" in value &&
          value.type === "scalar" &&
          "value" in value &&
          typeof value.value === "number" &&
          ( // unit is optional
            !("unit" in value) ||
            typeof value.unit === "string"
          )
        ) ||
        // Linked data series
        (
          "type" in value &&
          value.type === "dataSeries" &&
          "link" in value &&
          typeof value.link === "string"
        ) ||
        // New data series with values
        (
          "type" in value &&
          value.type === "dataSeries" &&
          "value" in value &&
          typeof value.value === "object" &&
          value.value != null &&
          !Array.isArray(value.value) &&
          Object.entries(value.value).every(([key, val]: [string, unknown]) => (
            // Each key should be a stringified year and value should be a number or null
            typeof key === "string" &&
            Number.isFinite(parseInt(key)) &&
            (typeof val === "number" || val === null)
          ))
        )
      )
    ))
  );
}

export function recipeFromUnknown(recipe: unknown): RawRecipe {
  if (typeof recipe === "string") {
    try {
      recipe = JSON.parse(recipe);
    } catch (error) {
      throw new RecipeError(`Failed to parse recipe from string: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (!unsafeIsRawRecipe(recipe)) {
    throw new RecipeError("Invalid recipe format. Expected a RawRecipe JSON string or object.");
  }

  return { eq: recipe.eq, variables: recipe.variables };
}

/**
 * Cleans up a user made recipe from the form into a db friendly Recipe
 * Throws a somewhat user-friendly RecipeError if the recipe is invalid, so catching and displaying any errors is recommended.
 */
export async function parseRecipe(rawRecipe: unknown /* RawRecipe */): Promise<Recipe> {
  // Basic validation of the recipe structure
  function hasValidStructure(obj: unknown): obj is { eq: string, variables: object } {
    return (
      // is object
      typeof obj === "object" &&
      obj != null &&
      !Array.isArray(obj) &&
      // has eq string
      "eq" in obj &&
      typeof obj.eq === "string" &&
      // has variables object
      "variables" in obj &&
      typeof obj.variables === "object" &&
      obj.variables != null &&
      !Array.isArray(obj.variables)
    );
  }

  if (!hasValidStructure(rawRecipe)) {
    throw new RecipeError("Invalid recipe format. Expected an object with 'eq' and 'variables' properties.");
  }

  const parsedRecipe: Recipe = {} as Recipe;

  /** 
   * Cast and clean variables
   */
  const parsedVariables: Record<string, RecipeVariables> = {};
  for (const [key, variable] of Object.entries(rawRecipe.variables)) {
    if (!isStandardObject(variable)) {
      throw new RecipeError(`Invalid structure of '${key}': expected an object, got ${typeof variable === "object" ? (Array.isArray(variable) ? "array" : "null") : typeof variable}`);
    }

    if (!("type" in variable) || typeof variable.type !== "string") {
      throw new RecipeError(`Missing or invalid 'type' property in variable '${key}'.`);
    }

    if (![RecipeVariableType.Scalar, RecipeVariableType.DataSeries].includes(variable.type as RecipeVariableType)) {
      throw new RecipeError(`Unknown variable type '${variable.type}' in variable '${key}'.`);
    }

    switch (variable.type) {
      /** Scalar parsing */
      case RecipeVariableType.Scalar:
        if (!isRecipeVariableScalar(variable)) {
          if (!("value" in variable)) {
            throw new RecipeError(`Missing 'value' property in scalar variable '${key}'.`);
          }
          if ("unit" in variable && typeof variable.unit !== "string") {
            throw new RecipeError(`Invalid 'unit' property in scalar variable '${key}': expected a string or undefined, got ${typeof variable.unit}: ${variable.unit}`);
          }
          throw new RecipeError(`Invalid scalar value for variable '${key}': expected a finite number, got ${variable.value}, with type ${typeof variable.value}`);
        }
        parsedVariables[key] = { type: RecipeVariableType.Scalar, value: variable.value };
        break;

      /** Data series parsing */
      case RecipeVariableType.DataSeries:
        if (lenientIsRawDataSeriesByLink(variable)) {
          // Warn about unexpected properties
          if ("value" in variable || "unit" in variable) {
            console.warn(`Variable '${key}' is a data series by link, but has 'value' or 'unit' properties. These will be ignored.`);
          }
          // If it has a link, try to use it
          // TODO: integrate with actual database, possibly batching all data series links as a single query
          if (!dataSeriesDB[variable.link]) {
            throw new RecipeError(`Data series with UUID '${variable.link}' for variable '${key}' does not exist in the database.`);
          }
          parsedVariables[key] = { type: RecipeVariableType.DataSeries, link: variable.link };
          break;
        } else if (isRawDataSeriesByValue(variable)) {
          // Map data series to known valid years
          const dataSeries: DataSeriesArray = {};
          for (const year of years) {
            const inputValue = variable.value[year];
            if (inputValue === undefined || inputValue === null) {
              dataSeries[year] = null; // Explicitly set to null for missing years
            } else if (Number.isFinite(inputValue)) {
              dataSeries[year] = inputValue; // Valid number
            } else {
              throw new RecipeError(`Invalid data series value for year '${year}' in variable '${key}': expected a finite number, got ${inputValue}`);
            }
          }

          // Write to "db" and link TODO - do this properly
          const uuid = randomUUID();
          dataSeriesDB[uuid] = {
            uuid,
            data: dataSeries,
            ...(variable.unit ? { unit: variable.unit } : {})
          };

          parsedVariables[key] = { type: RecipeVariableType.DataSeries, link: uuid };
          break;
        } else {
          if (!("link" in variable) && !("value" in variable)) {
            throw new RecipeError(`Data series variables must have either 'link' or 'value' property. Variable '${key}' is missing both.`);
          }
          if ("link" in variable && typeof variable.link !== "string") {
            throw new RecipeError(`Invalid 'link' property in data series variable '${key}': expected a string, got ${typeof variable.link}`);
          }
          if ("link" in variable && typeof variable.link === "string" && !uuidRegex.test(variable.link)) {
            throw new RecipeError(`Invalid 'link' property in data series variable '${key}': expected a valid UUID, got ${variable.link}`);
          }
          if ("value" in variable && !isStandardObject(variable.value)) {
            throw new RecipeError(`Invalid 'value' property in data series variable '${key}': expected an object, got ${typeof variable.value === "object" ? (Array.isArray(variable.value) ? "array" : "null") : typeof variable.value}`);
          }
          if ("value" in variable && isStandardObject(variable.value)) {
            const badDataEntries = Object.values(variable.value).filter(val => typeof val !== "number" && val !== null);
            if (badDataEntries.length > 0) {
              throw new RecipeError(`Invalid data series value for variable '${key}': expected an object with number or null values, got invalid types ${badDataEntries.map(val => typeof val).filter((type, i, entries) => entries.indexOf(type) == i).join(", ")}; values: ${JSON.stringify(variable.value)}`);
            }
            if (Object.values(variable.value).some(val => val !== null && !Number.isFinite(val))) {
              throw new RecipeError(`Invalid data series value for variable '${key}': expected finite numbers or null, series includes NaN or Infinity.`);
            }
          }
          if ("unit" in variable && typeof variable.unit !== "string") {
            throw new RecipeError(`Invalid 'unit' property in data series variable '${key}': expected a string or undefined, got ${variable.unit} with type ${typeof variable.unit}`);
          }
          const invalidKeys = Object.keys(variable).filter(k => !["type", "link", "value", "unit"].includes(k));
          if (invalidKeys.length !== 0) {
            throw new RecipeError(`Data series variable '${key}' has unexpected properties: ${invalidKeys.join(", ")}`);
          }
          throw new RecipeError(`Invalid data series variable '${key}': expected a RawDataSeriesByLink or RawDataSeriesByValue, got ${JSON.stringify(variable)}`);
        }
        break;

      /** Unhandled but allowed variable type */
      default:
        throw new RecipeError(`Unhandled but known variable type '${variable.type}' for variable '${key}'. Please report this as a bug.`);
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
  const keys = Object.keys(parsedVariables);
  const variableCount = keys.length;
  for (let i = 0; i < variableCount; i++) {
    const newName = getVariableName(i);

    // If it already exists, panic
    if (renamedVariables[newName]) {
      throw new RecipeError(`Variable name '${newName}' already exists. This should not happen.`);
    }

    const oldName = keys[i];
    const variable = parsedVariables[oldName];

    renamedVariables[newName] = variable;
    nameMapping[oldName] = newName;
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

export async function evaluateRecipe(recipe: Recipe, warnings: string[]): Promise<DataSeriesArray> {
  /** 
   * Early sanity checks
   */
  if (Object.keys(recipe.variables).length === 0) {
    throw new RecipeError("Recipe has no variables to evaluate.");
  }
  if (!recipe.eq) {
    throw new RecipeError("Recipe equation is not a valid string.");
  }

  /**
   * Extract variables 
   */
  const scalars: EvalTimeScalar[] = Object.entries(recipe.variables)
    .filter(([_, variable]) => variable.type === "scalar")
    .map(([name, variable]) => {
      const unit = (variable as RecipeVariableScalar).unit;
      const value = (variable as RecipeVariableScalar).value;
      return {
        name,
        value,
        ...(unit ? { unit } : {})
      };
    });

  const dataSeries: EvalTimeDataSeries[] = Object.entries(recipe.variables)
    .filter(([_, variable]) => variable.type === "dataSeries")
    .map(([name, variable]) => {
      const link = (variable as RecipeVariableDataSeries).link;
      if (!link || !dataSeriesDB[link]) {
        throw new RecipeError(`Data series link '${link}' for variable '${name}' does not exist in the database.`);
      }
      const dbEntry = dataSeriesDB[link];
      const unit = dbEntry.unit;
      return {
        name,
        link,
        data: dbEntry.data,
        ...(unit ? { unit } : {})
      };
    });

  /** 
   * Sanity checks on variables
   */
  sketchyScalars(scalars, warnings);
  sketchyDataSeries(dataSeries, warnings);

  /**
   * Resolve equation
   */
  let resolvedEquation = recipe.eq;
  for (const scalar of scalars) {
    resolvedEquation = resolvedEquation.replace(`\${${scalar.name}}`, scalar.value.toString());
  }
  for (const series of dataSeries) {
    // TODO - depending on if the db will give null for unused years or omit them this might need to be adjusted
    const lastYear = Object.entries(series.data).findLast(([year, value]) => year && value)?.[0];
    if (!lastYear) {
      throw new RecipeError(`Data series '${series.name}' has no valid years.`);
    }

    // Try casting strings to numbers and throw when they are not valid or simply not numbers
    for (const [year, value] of Object.entries(series.data)) {
      if (value == null) {
        // If the value is null or undefined, we skip it
        continue;
      }
      if (typeof value === "number" && Number.isFinite(value)) {
        // Valid number, do nothing
        continue
      }
      if (typeof value === "string" && (value as string).trim() !== "") {
        // Try to parse it as a number
        const parsedValue = parseFloat(value as string);
        if (isNaN(parsedValue) || !Number.isFinite(parsedValue)) {
          throw new RecipeError(`Invalid value '${value}' for year '${year}' in data series '${series.name}': expected a finite number.`);
        }
        warnings.push(`Value '${value}' for year '${year}' in data series '${series.name}' was parsed as ${parsedValue}.`);
        series.data[year as keyof DataSeriesArray] = parsedValue; // Update the value to the parsed number
      }
      else {
        throw new RecipeError(`Invalid value '${value}' for year '${year}' in data series '${series.name}': expected a finite number or a valid string representation of a number.`);
      }
    }

    // Pad start with zeros if needed up until the last given year
    const paddedData: number[] = [];
    for (const year of years) {
      // Use data if it exists, otherwise use 0 up to the last year
      if (year <= lastYear) {
        paddedData.push(series.data[year] ?? 0);
      }
    }

    // Replace the variable in the equation
    resolvedEquation = resolvedEquation.replace(`\${${series.name}}`, `[${paddedData.join(",")}]`);
  }

  let result: number | math.Matrix | number[];
  try {
    result = mathjs.evaluate(resolvedEquation);
    result = JSON.parse(result.toString())
  }
  catch (error) {
    throw new MathjsError(`Failed to evaluate recipe equation: ${error instanceof Error ? error.message : String(error)}`);
  }

  // TODO - transform the result into a DataSeriesArray
  // Arrays are easily mapped from the start year to the end year unless they're too long then take the first 31 years and warn. This will be where interpolation options will come in later.
  // Scalars are mapped to every year as well with a warning.
  // Matrices throw.
  // anything else throws.
  if (Array.isArray(result)) {
    if (result.length > years.length) {
      warnings.push(`Resulting array is longer than the number of years (${years.length}). Only the first ${years.length} years will be used.`);
      result = result.slice(0, years.length);
    }
    const dataSeriesArray: DataSeriesArray = {};
    for (let i = 0; i < years.length; i++) {
      const year = years[i];
      const value = result[i];
      if (value == null || value === undefined) {
        dataSeriesArray[year] = null; // Explicitly set to null for missing years
      }
      else if (typeof value === "number" && Number.isFinite(value)) {
        dataSeriesArray[year] = value; // Valid number
      }
      else {
        throw new RecipeError(`Invalid value '${value}' for year '${year}': expected a finite number.`);
      }
    }
    return dataSeriesArray;
  }
  if (typeof result === "number" && Number.isFinite(result)) {
    // If the result is a scalar, map it to all years
    const dataSeriesArray: DataSeriesArray = {};
    for (const year of years) {
      dataSeriesArray[year] = result; // Use the scalar value for all years
    }
    return dataSeriesArray;
  }
  if (typeof result === "string") {
    // If the result is a string, try to parse it as a number
    const parsedResult = parseFloat(result);
    if (isNaN(parsedResult) || !Number.isFinite(parsedResult)) {
      throw new RecipeError(`Invalid result from equation: expected a finite number, got '${result}'`);
    }
    const dataSeriesArray: DataSeriesArray = {};
    for (const year of years) {
      dataSeriesArray[year] = parsedResult; // Use the parsed number for all years
    }
    return dataSeriesArray;
  }
  // If the result is anything else, throw an error
  throw new RecipeError(`Invalid result from equation: expected an array or a finite number, got '${typeof result}'`);
}