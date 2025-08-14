import type { DataSeriesArray, EvalTimeDataSeries, EvalTimeScalar, RecipeExternalDataset, Recipe, Recipe, RecipeVariableDataSeries, RecipeVariables, RecipeScalar, EvalTimeExternalDataset } from "./recipe-parser/types";
import { RecipeDataTypes, isRecipeDataSeries, isRecipeScalar, MathjsError, RecipeError, isRecipeExternalDataset, RecipeDataTypesMap } from "./recipe-parser/types";
import { sketchyDataSeries, sketchyScalars } from "./recipe-parser/sanityChecks";
import mathjs from "@/math";
import { Years, isStandardObject, uuidRegex, } from "@/types";
import getTableContent from "@/lib/api/getTableContent";
import clientSafeGetOneDataSeries from "@/fetchers/clientSafeGetOneDataSeries";

export function unsafeIsRawRecipe(recipe: unknown): recipe is Recipe {
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
        isRecipeScalar(value) ||
        // Linked data series
        isRecipeDataSeries(value) ||
        // New data series with values
        isRawDataSeriesByValue(value) ||
        // Data from external dataset
        isRecipeExternalDataset(value)
      )
    ))
  );
}

export function recipeFromUnknown(recipe: unknown): Recipe {
  if (typeof recipe === "string") {
    try {
      recipe = JSON.parse(recipe);
    } catch (error) {
      throw new RecipeError(`Failed to parse recipe from string: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  const rawRecipe: Recipe = recipe as Recipe;
  if (!rawRecipe || !rawRecipe.eq || !rawRecipe.variables) {
    throw new RecipeError("Invalid recipe format. Expected a RawRecipe JSON string or object.");
  }
  // if (!unsafeIsRawRecipe(recipe)) {
  //   throw new RecipeError("Invalid recipe format. Expected a RawRecipe JSON string or object.");
  // }

  // return { eq: recipe.eq, variables: recipe.variables, ...(recipe.name ? { name: recipe.name } : {}) };
  return { eq: rawRecipe.eq, variables: rawRecipe.variables, ...(rawRecipe.name ? { name: rawRecipe.name } : {}) };
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

    if (!RecipeDataTypesMap[variable.type as RecipeDataTypes]) {
      throw new RecipeError(`Unknown variable type '${variable.type}' in variable '${key}'.`);
    }

    switch (variable.type) {
      /** Scalar parsing */
      case RecipeDataTypes.Scalar:
        if (!isRecipeScalar(variable)) {
          if (!("value" in variable)) {
            throw new RecipeError(`Missing 'value' property in scalar variable '${key}'.`);
          }
          if ("unit" in variable && typeof variable.unit !== "string") {
            throw new RecipeError(`Invalid 'unit' property in scalar variable '${key}': expected a string or undefined, got ${typeof variable.unit}: ${String(variable.unit)}`);
          }
          throw new RecipeError(`Invalid scalar value for variable '${key}': expected a finite number, got ${String(variable.value)}, with type ${typeof variable.value}`);
        }
        parsedVariables[key] = { type: RecipeDataTypes.Scalar, value: variable.value, ...(variable.unit && { unit: variable.unit }) };
        break;

      /** Data series parsing */
      case RecipeDataTypes.DataSeries:
        if (isRecipeDataSeries(variable)) {
          // Warn about unexpected properties
          if ("value" in variable || "unit" in variable) {
            console.warn(`Variable '${key}' is a data series by link, but has 'value' or 'unit' properties. These will be ignored.`);
          }

          if (!variable.link) {
            throw new RecipeError(`Data series variable '${key}' is missing 'link' property. Probably just haven't made the selection yet.`);
          }

          const dataSeriesInDB = await clientSafeGetOneDataSeries(variable.link);

          if (!dataSeriesInDB) {
            throw new RecipeError(`Data series with UUID '${variable.link}' for variable '${key}' does not exist in the database.`);
          }
          parsedVariables[key] = { type: RecipeDataTypes.DataSeries, link: variable.link };
          break;
        } else if (isRawDataSeriesByValue(variable)) {
          // Map data series to known valid years
          const dataSeries: DataSeriesArray = {};
          for (const year of Years) {
            const inputValue = variable.value[year];
            if (inputValue === undefined || inputValue === null) {
              dataSeries[year] = null; // Explicitly set to null for missing years
            } else if (Number.isFinite(inputValue)) {
              dataSeries[year] = inputValue; // Valid number
            } else {
              throw new RecipeError(`Invalid data series value for year '${year}' in variable '${key}': expected a finite number, got ${inputValue}`);
            }
          }

          // Write to db
          const { uuid } = await (await fetch("/api/dataSeries", {
            body: JSON.stringify({
              data: dataSeries,
              unit: variable.unit
            }), method: "POST"
          })).json() as { uuid: string };

          parsedVariables[key] = { type: RecipeDataTypes.DataSeries, link: uuid };
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
            throw new RecipeError(`Invalid 'unit' property in data series variable '${key}': expected a string or undefined, got ${String(variable.unit)} with type ${typeof variable.unit}`);
          }
          const invalidKeys = Object.keys(variable).filter(k => !["type", "link", "value", "unit"].includes(k));
          if (invalidKeys.length !== 0) {
            throw new RecipeError(`Data series variable '${key}' has unexpected properties: ${invalidKeys.join(", ")}`);
          }
          throw new RecipeError(`Invalid data series variable '${key}': expected a RawDataSeriesByLink or RawDataSeriesByValue, got ${JSON.stringify(variable)}`);
        }
        break;

      /** External data parsing */
      case RecipeDataTypes.External:
        if (!isRecipeExternalDataset(variable)) {
          throw new RecipeError(`Something went wrong when reading your reference to an external API: expected a valid ExternalDataset object, got ${JSON.stringify(variable)}`);
        }
        parsedVariables[key] = {
          type: RecipeDataTypes.External,
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
   * Return the parsed recipe
   */
  parsedRecipe.eq = rawRecipe.eq.trim();
  parsedRecipe.variables = parsedVariables;
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
    .filter(([, variable]) => variable.type === RecipeDataTypes.Scalar)
    .filter(([, variable]) => isRecipeScalar(variable))
    .map(([name, variable]) => {
      const { value, unit } = variable as RecipeScalar;
      return { name, value, unit };
    });

  const dataSeries: EvalTimeDataSeries[] = await Promise.all(Object.entries(recipe.variables)
    .filter(([, variable]) => variable.type === RecipeDataTypes.DataSeries)
    .filter(([, variable]) => isRawDataSeriesByValue(variable) || isRecipeDataSeries(variable))
    .map(async ([name, variable]) => {
      const { link } = variable as RecipeVariableDataSeries;

      if (!link) {
        throw new RecipeError(`Data series link '${link}' for variable '${name}' does not exist in the database.`);
      }

      const dbDataSeries = await clientSafeGetOneDataSeries(link);

      if (!dbDataSeries) {
        throw new RecipeError(`Data series with UUID '${link}' for variable '${name}' does not exist in the database.`);
      }

      const data: DataSeriesArray = {};
      for (const year of Years) {
        data[year] = dbDataSeries[year];
      }

      return { name, link, data, unit: dbDataSeries.unit };
    }));

  const externalData: EvalTimeExternalDataset[] = (await Promise.all(Object.entries(recipe.variables)
    .filter(([, variable]) => variable.type === RecipeDataTypes.External)
    .filter(([, variable]) => isRecipeExternalDataset(variable))
    .map(([name, variable]) => {
      variable = variable as RecipeExternalDataset;

      const { dataset, tableId, selection } = variable;
      if (!dataset || !tableId) {
        throw new RecipeError(`External dataset variable '${name}' is missing 'dataset' or 'tableId' property.`);
      }

      return (async () => ({
        name,
        data: await getTableContent(tableId, dataset, selection, undefined),
      }))();
    })))
    .map(({ name, data }) => {
      if (!data) {
        throw new RecipeError(`External dataset variable '${name}' has no data.`);
      }

      // If vector
      if (data.values.length > 0) {
        // Pad the vector to match the years
        const lastYear = data.values[data.values.length - 1].period;
        const length = Years.findIndex(year => year === `val${lastYear}`);
        if (length === -1) {
          throw new RecipeError(`External dataset variable '${name}' has invalid period '${lastYear}'. Expected one of ${Years.join(", ")}.`);
        }

        const paddedVectorForm: number[] = new Array(length).fill(0);
        for (const { period, value } of data.values) {
          const yearIndex = Years.findIndex(year => year === `val${period}`);
          if (yearIndex === -1) {
            throw new RecipeError(`External dataset variable '${name}' has invalid period '${period}'. Expected one of ${Years.join(", ")}.`);
          }
          const numericValue = parseFloat(value);
          if (isNaN(numericValue) || !Number.isFinite(numericValue)) {
            throw new RecipeError(`External dataset variable '${name}' has invalid value '${value}' for period '${period}': expected a finite number, got ${value}`);
          }
          paddedVectorForm[yearIndex] = numericValue;
        }

        return {
          name,
          vector: paddedVectorForm,
        } as EvalTimeExternalDataset;
      }

      // If scalar (comes as a single value in an array)
      if (data.values.length === 0) {
        const value = data.values[0];

        if (!value || !value.period || !value.value) {
          throw new RecipeError(`External dataset variable '${name}' has no valid values. Expected an array of values with 'period' and 'value' properties.`);
        }
        const numericValue = parseFloat(value.value);
        if (isNaN(numericValue) || !Number.isFinite(numericValue)) {
          throw new RecipeError(`External dataset variable '${name}' has invalid value '${value.value}' for period '${value.period}': expected a finite number, got ${value.value}`);
        }

        if (!Years.includes(`val${value.period}` as typeof Years[number])) {
          throw new RecipeError(`External dataset variable '${name}' has invalid period '${value.period}'. Expected one of ${Years.join(", ")}.`);
        }

        return {
          name,
          scalar: numericValue,
        }
      }

      // Else
      throw new RecipeError(`External dataset variable '${name}' has no valid values. Expected an array of values with 'period' and 'value' properties.`);
    });

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
    equation = equation.replaceAll(`\${${scalar.name}}`, varName);

    scope[varName] = scalar.unit ? mathjs.unit(scalar.value, scalar.unit) : scalar.value;
  }

  // Add data series to scope as matrices
  for (const series of dataSeries) {
    const varName = series.name.replace(/\s+/g, "_");
    equation = equation.replace(`\${${series.name}}`, varName);

    const lastYearWithData = (Object.keys(series.matrix) as Array<keyof DataSeriesArray>)
      .filter(year => series.matrix[year] != null)
      .pop();

    if (!lastYearWithData) {
      throw new RecipeError(`Data series '${series.name}' contains no data and cannot be evaluated.`);
    }

    const seriesValues = [];
    for (const year of Years) {
      const isBeforeLastDefinedYear = parseInt(year.replace("val", "")) <= parseInt(lastYearWithData.replace("val", ""));
      if (!isBeforeLastDefinedYear) break;

      let value = series.matrix[year];
      if (value === undefined || value === null) {
        // If the value is not defined, we can either pad with 0 or skip
        value = 0; // Default to 0 for missing values
      }

      if (typeof value === "string") {
        value = parseFloat(value);
      }

      if (Number.isNaN(value)) {
        throw new RecipeError(`Data series '${series.name}' has NaN value for year '${year}'. This is not allowed.`);
      }

      if (!Number.isFinite(value)) {
        warnings.push(`Data series '${series.name}' has non-finite value for year '${year}'. This will be treated as 0.`);
      }

      if (series.unit) {
        seriesValues.push(mathjs.unit(value as number, series.unit));
      } else {
        seriesValues.push(value);
      }
    }

    scope[varName] = mathjs.matrix(seriesValues);
  }

  // Add external data to scope, as either a matrix or a scalar
  for (const externalVar of externalData) {
    const varName = externalVar.name.replace(/\s+/g, "_");
    equation = equation.replace(`\${${externalVar.name}}`, varName);

    if (externalVar.vector) {
      // If it's a vector, we can treat it as a matrix
      const vectorValues = externalVar.vector.map(value => {
        if (typeof value === "string") {
          value = parseFloat(value);
        }
        if (Number.isNaN(value)) {
          throw new RecipeError(`External dataset '${externalVar.name}' has NaN value in vector.`);
        }
        return value;
      });
      scope[varName] = mathjs.matrix(vectorValues);
    }
    else if (externalVar.scalar !== undefined) {
      // If it's a scalar, just add it directly
      scope[varName] = externalVar.scalar;
    } else {
      throw new RecipeError(`External dataset variable '${externalVar.name}' is missing both 'vector' and 'scalar' properties.`);
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
  const output: DataSeriesArray = {};
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
    resultArray = Years.map(() => result);
    if (mathjs.typeOf(result) === "number") {
      warnings.push(`Resulting scalar value ${result as number} will be applied to all years. This may not be intended.`);
    }
  }
  else {
    throw new RecipeError(`Unsupported result type: ${mathjs.typeOf(result)}. Expected a number, array, or matrix.`);
  }

  if (resultArray.length > Years.length) {
    warnings.push(`Resulting array has more values than years (${resultArray.length} vs ${Years.length}). The trailing ${resultArray.length - Years.length} values will be discarded.`);
  }

  // Process the result array into the output format
  let commonUnit: string | undefined;
  for (let i = 0; i < Math.min(resultArray.length, Years.length); i++) {
    const year = Years[i];
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