import { getVariableName } from "./recipe-parser/helpers";
import type { DataSeriesArray, EvalTimeDataSeries, EvalTimeScalar, RawRecipe, Recipe, RecipeVariableDataSeries, RecipeVariables, RecipeVariableScalar } from "./recipe-parser/types";
import { RecipeVariableType, isRawDataSeriesByValue, lenientIsRawDataSeriesByLink, isRecipeVariableScalar, MathjsError, RecipeError, isExternalDatasetVariable } from "./recipe-parser/types";
import { sketchyDataSeries, sketchyScalars } from "./recipe-parser/sanityChecks";
import mathjs from "@/math";
import { dataSeriesDataFieldNames, isStandardObject, uuidRegex } from "@/types";
import { Unit } from "mathjs";
import { ApiTableContent } from "@/lib/api/apiTypes";

const years = dataSeriesDataFieldNames

type DataSeriesDbEntry = {
  uuid: string;
  unit?: string;
  data: Partial<DataSeriesArray>;
};
const dataSeriesDB: Record<string, DataSeriesDbEntry> = {};

export function unsafeIsRawRecipe(recipe: unknown): recipe is RawRecipe {
  return (
    // Should be a regular object
    isStandardObject(recipe) &&
    // Name is optional, but if it exists, it must be a string
    (
      !("name" in recipe) ||
      typeof recipe.name === "string" ||
      recipe.name === undefined
    ) &&
    // Should have equation string
    "eq" in recipe &&
    typeof recipe.eq === "string" &&
    // Should have variables object
    "variables" in recipe &&
    isStandardObject(recipe.variables) &&
    Object.entries(recipe.variables).every(([key, value]: [string, unknown]) => (
      // Each variable should have a string key and a value object
      typeof key === "string" &&
      // Each variable should match a RawRecipeVariables type
      (
        // Scalar
        isRecipeVariableScalar(value) ||
        // Linked data series
        lenientIsRawDataSeriesByLink(value) ||
        // New data series with values
        isRawDataSeriesByValue(value) ||
        // Data from external dataset
        isExternalDatasetVariable(value)
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

  return { eq: recipe.eq, variables: recipe.variables, ...(recipe.name ? { name: recipe.name } : {}) };
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
        parsedVariables[key] = { type: RecipeVariableType.Scalar, value: variable.value, ...(variable.unit && { unit: variable.unit }) };
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
          const uuid = crypto.randomUUID();
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

      /** External data parsing */
      case RecipeVariableType.External:
        if (!isExternalDatasetVariable(variable)) {
          throw new RecipeError(`Something went wrong when reading your reference to an external API: expected a valid ExternalDataset object, got ${JSON.stringify(variable)}`);
        }
        parsedVariables[key] = {
          type: RecipeVariableType.External,
          dataset: variable.dataset,
          tableId: variable.tableId,
          selection: variable.selection
        };
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

export async function evaluateRecipe(recipe: Recipe, warnings: string[]): Promise<DataSeriesArray & { unit?: string }> {
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
    .filter(([, variable]) => variable.type === "scalar")
    .map(([name, variable]) => {
      const { value, unit } = variable as RecipeVariableScalar;
      return { name, value, unit };
    });

  const dataSeries: EvalTimeDataSeries[] = Object.entries(recipe.variables)
    .filter(([, variable]) => variable.type === "dataSeries")
    .map(([name, variable]) => {
      const { link } = variable as RecipeVariableDataSeries;
      if (!link || !dataSeriesDB[link]) {
        throw new RecipeError(`Data series link '${link}' for variable '${name}' does not exist in the database.`);
      }
      const { data, unit } = dataSeriesDB[link];
      return { name, link, data, unit };
    });

  const externalData: (ApiTableContent & { name: string, type?: "matrix" | "scalar" })[] = Object.entries(recipe.variables)
    .filter(([, variable]) => variable.type === "external")
    .map(([name, variable]) => {
      // Do magic here
      return {
        name: name,
        id: "",
        columns: [],
        data: [],
        metadata: [],
      }
    })

  /**
   * Sanity checks on variables
   */
  sketchyScalars(scalars, warnings);
  sketchyDataSeries(dataSeries, warnings);

  /**
   * Resolve equation and build scope for mathjs
   */
  const scope: Record<string, unknown> = {};
  let equation = recipe.eq;

  // Add scalars to scope
  for (const scalar of scalars) {
    const varName = scalar.name.replace(/\s+/g, "_");
    scope[varName] = scalar.unit ? mathjs.unit(scalar.value, scalar.unit) : scalar.value;
    equation = equation.replace(`\${${scalar.name}}`, varName);
  }

  // Add data series to scope as matrices
  for (const series of dataSeries) {
    const varName = series.name.replace(/\s+/g, "_");
    const lastYearWithData = (Object.keys(series.data) as Array<keyof DataSeriesArray>)
      .filter(year => series.data[year] != null)
      .pop();

    if (!lastYearWithData) {
      throw new RecipeError(`Data series '${series.name}' contains no data and cannot be evaluated.`);
    }

    const seriesValues = [];
    for (const year of years) {
      const canPad = parseInt(year.replace("val", "")) <= parseInt(lastYearWithData.replace("val", ""));
      const value = series.data[year];

      if (!canPad) break;

      let valueToPush: number | Unit = 0;
      if (canPad && !value) {
        valueToPush = 0;
      }
      else if (value) {
        valueToPush = value;
      }

      if (series.unit) {
        seriesValues.push(mathjs.unit(valueToPush as number, series.unit));
      } else {
        seriesValues.push(valueToPush);
      }
    }

    scope[varName] = mathjs.matrix(seriesValues);
    equation = equation.replace(`\${${series.name}}`, varName);
  }

  // Add external data to scope, as either a matrix or a scalar
  for (const data of externalData) {
    const varName = data.name.replace(/\s+/g, "_");
    if (data.data.length === 0) {
      throw new RecipeError(`External data '${data.name}' contains no data and cannot be evaluated.`);
    }

    switch (data.type) {
      case "matrix":
        // TODO: implement this
        break;
      // Default case is to handle as a scalar
      case "scalar":
      default:
        // If the data is a scalar, we can just take the last value
        const dataColumn = data.columns.findIndex(col => col.type !== "t")
        if (dataColumn === -1) {
          throw new RecipeError(`External data '${data.name}' has no valid columns to evaluate as a scalar.`);
        }
        const lastValue = data.data[dataColumn].values.filter(item => item != null && item != "" && item != "-").slice(-1)[0];
        if (lastValue) {
          let value = parseFloat(lastValue);
          if (Number.isFinite(value)) {
            scope[varName] = value;
          }
        } else {
          throw new RecipeError(`Failed to find a valid value in external data '${data.name}'.`);
        }
        break;
    }
  }

  /**
   * Try to evaluate the equation using mathjs
   */
  let result: unknown;
  try {
    result = mathjs.evaluate(equation, scope);
  } catch (error) {
    throw new MathjsError(`Failed to evaluate recipe equation: ${error instanceof Error ? error.message : String(error)}`);
  }

  /**
   * Transform mathjs result into a DataSeriesArray
   */
  const output: DataSeriesArray & { unit?: string } = {};
  let resultArray: unknown[] = [];

  // Coerce result into a 1D array
  if (mathjs.isMatrix(result)) {
    if (result.size().filter((d: number) => d > 1).length > 1) {
      throw new RecipeError(`Resulting matrix has more than one dimension (${result.size().join("x")}), which is not supported.`);
    }
    resultArray = result.toArray().flat();
  }
  else if (Array.isArray(result)) {
    resultArray = result;
  }
  else if (mathjs.isCollection(result) && 'toArray' in result && typeof result.toArray === 'function') {
    resultArray = result.toArray();
  }
  else if (["number", "BigNumber", "Complex", "Unit"].includes(mathjs.typeOf(result))) {
    resultArray = years.map(() => result);
    if (mathjs.typeOf(result) === "number") {
      warnings.push(`Resulting scalar value ${result} will be applied to all years. This may not be intended.`);
    }
  }
  else {
    throw new RecipeError(`Unsupported result type: ${mathjs.typeOf(result)}. Expected a number, array, or matrix.`);
  }

  if (resultArray.length > years.length) {
    warnings.push(`Resulting array has more values than years (${resultArray.length} vs ${years.length}). The trailing ${resultArray.length - years.length} values will be discarded.`);
  }

  // Process the result array into the output format
  let commonUnit: string | undefined;
  for (let i = 0; i < Math.min(resultArray.length, years.length); i++) {
    const year = years[i];
    let value = resultArray[i];

    if (value === null || value === undefined) {
      output[year] = null;
      continue;
    }

    // Handle complex numbers
    if (mathjs.isComplex(value)) {
      if (value.im !== 0) {
        throw new RecipeError(`Result for year ${year} is a complex number with a non-zero imaginary part: ${value.toString()}`);
      }
      value = value.re;
    }

    // Handle units
    if (mathjs.isUnit(value)) {
      const unitString = value.formatUnits();
      if (!commonUnit) {
        commonUnit = unitString;
      } else if (commonUnit !== unitString) {
        warnings.push(`Inconsistent units in result for year ${year}. Expected '${commonUnit}', got '${unitString}'.`);
      }
      value = value.toNumber();
    }

    // Handle BigNumbers
    if (mathjs.isBigNumber(value)) {
      value = value.toNumber();
    }

    // Final check for a valid number
    if (typeof value === "number" && Number.isFinite(value)) {
      output[year] = value;
    } else {
      throw new RecipeError(`Invalid value for year '${year}': expected a finite number, but got ${mathjs.typeOf(resultArray[i])}`);
    }
  }

  // Set the unit if it was resolved
  if (commonUnit) {
    output.unit = commonUnit;
  }

  return output;
}