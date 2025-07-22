import { randomUUID } from "node:crypto";
import { getVariableName } from "./recipe-parser/helpers";
import { vectorToDataSeries, years } from "./recipe-parser/transformations";
import { DataSeriesArray, EvalTimeDataSeries, EvalTimeScalar, RawDataSeriesByLink, RawDataSeriesByValue, RawRecipe, Recipe, RecipeError, RecipeVariableDataSeries, RecipeVariables, RecipeVariableScalar } from "./recipe-parser/types";
import { sketchyDataSeries, sketchyScalars } from "./recipe-parser/sanityChecks";

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
        // Vector
        (
          "type" in value &&
          value.type === "vector" &&
          "value" in value &&
          Array.isArray(value.value) &&
          value.value.every((v: unknown) => typeof v === "number" || typeof v === "string" || v === null || v === undefined) &&
          (!("unit" in value) || typeof value.unit === "string")
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

// TODO - Implement
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
    

  return {};
}