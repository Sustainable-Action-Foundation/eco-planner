import { randomUUID } from "node:crypto";
import { getVariableName } from "./recipe-parser/helpers";
import type { DataSeriesArray, EvalTimeDataSeries, EvalTimeScalar, RawDataSeriesByLink, RawDataSeriesByValue, RawRecipe, Recipe, RecipeVariableDataSeries, RecipeVariables, RecipeVariableScalar } from "./recipe-parser/types";
import { MathjsError, RecipeError } from "./recipe-parser/types";
import { sketchyDataSeries, sketchyScalars } from "./recipe-parser/sanityChecks";
import mathjs from "@/math";

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
          Object.entries(value.value).every(([year, val]: [string, unknown]) => (
            // Each year should be a string and value should be a number or null
            typeof year === "string" &&
            Number.isFinite(parseInt(year)) &&
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

/** Cleans up a user made recipe from the form into a db friendly @type {Recipe} */
export async function parseRecipe(rawRecipe: RawRecipe): Promise<Recipe> {
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

    /** Data series parsing */
    else if (variable.type === "dataSeries") {
      // If it has a link, use that
      const link = (variable as RawDataSeriesByLink).link;
      if (link) {
        if (typeof link !== "string" || !dataSeriesDB[link]) {
          throw new RecipeError(`Invalid data series link for variable '${key}': link '${link}' does not exist in the database.`);
        }

        // If link is valid, use it
        parsedVariables[key] = { type: "dataSeries", link };
      }
      else {
        const value = (variable as RawDataSeriesByValue).value;

        if (typeof value !== "object" || value === null || Array.isArray(value)) {
          throw new RecipeError(`Invalid data series value for variable '${key}': expected an object, got ${typeof value}`);
        }

        // Validate the data series structure and map to known valid years
        const dataSeries: DataSeriesArray = {};
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
        const unit = (variable as RawDataSeriesByValue).unit;
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