import { EvalTimeDataSeries, EvalTimeExternalDataset, EvalTimeScalar, isRecipe, isRecipeDataSeries, isRecipeExternalDataset, isRecipeExternalDatasetSelection, isRecipeScalar, MathjsError, Recipe, RecipeDataTypes, RecipeError, RecipeVariable, vectorIndexPickerFunctions } from "./recipe-parser/types";
import { sketchyDataSeries, sketchyScalars } from "./recipe-parser/sanityChecks";
import mathjs from "@/math";
import { DataSeriesValueFields, isFullDataSeriesValueFields, JSONValue, Years } from "@/types";
import getTableContent from "@/lib/api/getTableContent";
import clientSafeGetOneDataSeries from "@/fetchers/clientSafeGetOneDataSeries";

export function recipeFromUnknown(recipe: JSONValue): Recipe {
  if (typeof recipe === "string") {
    try {
      recipe = JSON.parse(recipe) as JSONValue;
    } catch (error) {
      throw new RecipeError(`Failed to parse recipe from string: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (!isRecipe(recipe)) {
    console.error(recipe);
    throw new RecipeError("Invalid recipe format. Expected an object following the Recipe type.");
  }

  return {
    name: recipe.name,
    eq: recipe.eq.trim(),
    variables: recipe.variables,
  };
}

/**
 * Cleans up a user made recipe from the form into a db friendly Recipe
 * Throws a somewhat user-friendly RecipeError if the recipe is invalid, so catching and displaying any errors is recommended.
 */
export function cleanRecipe(recipe: JSONValue): Recipe {
  if (!isRecipe(recipe)) {
    throw new RecipeError("Invalid recipe format. Did not match the Recipe type.");
  }

  const parsedRecipe: Recipe = {} as Recipe;

  /** 
   * Cast and clean variables
   */
  const parsedVariables: Record<string, RecipeVariable> = { ...recipe.variables };

  /** 
   * Return the parsed recipe
   */
  parsedRecipe.eq = recipe.eq.trim();
  parsedRecipe.variables = parsedVariables;
  return parsedRecipe;
}
/** 
 * Returning null means the evaluation was cancelled without errors.
 */
export async function evaluateRecipe(recipe: Recipe, warnings: string[]): Promise<{ dataSeries: DataSeriesValueFields, unit: string | null | undefined } | null> {

  /**
   * Early sanity checks
   */
  if (!recipe.eq || !recipe.eq.trim()) {
    return null;
  }

  /**
   * Extract variables
   */
  const definedScalars = Object.entries(recipe.variables).filter(([_n, v]) => v.type === RecipeDataTypes.Scalar);
  const scalars: EvalTimeScalar[] = definedScalars.length === 0 ? [] :
    definedScalars.map(([name, variable]) => {
      if (!isRecipeScalar(variable)) {
        throw new RecipeError(`Variable '${name}', typed as '${variable.type}' is not a valid RecipeScalar.`);
      }
      const { value, unit } = variable;
      return { name, value, unit };
    });

  const definedDataSeries = Object.entries(recipe.variables).filter(([_n, v]) => v.type === RecipeDataTypes.DataSeries);
  const dataSeries: EvalTimeDataSeries[] = definedDataSeries.length === 0 ? [] : await Promise.all(definedDataSeries
    .map(async ([name, variable]) => {
      if (!isRecipeDataSeries(variable)) {
        throw new RecipeError(`Variable '${name}', typed as '${variable.type}' is not a valid RecipeDataSeries.`);
      }

      const { link, pick, unit: unitOverride } = variable;

      if (!link) {
        throw new RecipeError(`Data series '${name}' does not have a 'link' defined yet.`);
      }

      const dbDataSeries = await clientSafeGetOneDataSeries(link);
      if (!dbDataSeries) {
        throw new RecipeError(`Data series with UUID '${link}' for variable '${name}' does not exist in the database.`);
      }

      // Unit handling
      // And override unit takes precedence over the one from the database and if an override is null, remove the unit, if undefined, use the one from the database
      let unit: string | null | undefined = undefined;
      if (
        (
          typeof unitOverride === "string" &&
          unitOverride.trim().length
        ) ||
        unitOverride === null
      ) {
        unit = unitOverride;
      }
      else (
        unit = dbDataSeries.unit
      )

      const valueFields: Partial<DataSeriesValueFields> = {};
      for (const year of Years) {
        if (!dbDataSeries[year]) {
          continue; // Skip years without data
        }
        valueFields[year] = dbDataSeries[year];
      }

      let value: number | number[] = Years.map(year => {
        const yearValue = valueFields[year] ?? Infinity;
        return yearValue;
      });
      // Consider pick if provided
      if (pick && vectorIndexPickerFunctions[pick]) {
        const result = vectorIndexPickerFunctions[pick](value);
        if (result === undefined || result === null) {
          throw new RecipeError(`Data series '${name}' with pick '${pick}' returned an invalid value.`);
        }
        value = result;
      }

      return {
        name,
        link,
        unit,
        value,
      } as EvalTimeDataSeries;
    }));

  const definedExternalData = Object.entries(recipe.variables).filter(([_n, v]) => v.type === RecipeDataTypes.External);
  const externalData: EvalTimeExternalDataset[] = definedExternalData.length === 0 ? [] : (await Promise.all(definedExternalData
    .map(([name, variable]) => {
      if (!isRecipeExternalDataset(variable)) {
        throw new RecipeError(`Variable '${name}', typed as '${variable.type}' is not a valid RecipeExternalDataset.`);
      }

      const { dataset, tableId, selection } = variable;
      if (!dataset || !tableId || !isRecipeExternalDatasetSelection(selection)) { // These props may all be null
        throw new RecipeError(`External dataset variable '${name}' is missing 'dataset', 'tableId' and/or 'selection' properties.`);
      }

      const fetcher = async () => {
        const data = await getTableContent(tableId, dataset, selection);
        if (!data) {
          throw new RecipeError(`External dataset variable '${name}' has no data for tableId '${tableId}' and dataset '${dataset}'.`);
        }
        return {
          name,
          data,
          variable
        };
      };

      return fetcher();
    })))
    .map(({ name, data, variable }) => {
      // Should be a redundant check
      if (!data) {
        throw new RecipeError(`External dataset variable '${name}' has no data.`);
      }

      // TODO - read periods properly

      if (data.values.length === 0) {
        throw new RecipeError(`External dataset variable '${name}' has no values. Expected an array of values with 'period' and 'value' properties.`);
      }

      const definedValues = Object.fromEntries(data.values.map(v => ["val" + v.period, parseFloat(v.value)]));

      let value: number | number[] = Years.map(y => {
        const definedValue = definedValues[y];
        if (definedValue && !Number.isFinite(definedValue)) {
          warnings.push(`External dataset variable '${name}' has no value defined for year '${y}'.`);
          return Infinity;
        }
        return definedValues[y] ?? Infinity;
      });

      // Consider pick if provided
      if (variable.pick && vectorIndexPickerFunctions[variable.pick]) {
        const result = vectorIndexPickerFunctions[variable.pick](value);
        if (result === undefined || result === null) {
          throw new RecipeError(`Data series '${name}' with pick '${variable.pick}' returned an invalid value.`);
        }
        value = result;
      }

      return {
        name: name,
        value,
        unit: undefined,
      };
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

    if (!series.value) {
      throw new RecipeError(`Data series '${series.name}' has no value defined. Please check the data series.`);
    }

    scope[varName] = Array.isArray(series.value) ? mathjs.matrix(series.value) : series.value;
  }

  // Add external data to scope, as either a matrix or a scalar
  for (const externalVar of externalData) {
    const varName = externalVar.name.replace(/\s+/g, "_");
    equation = equation.replace(`\${${externalVar.name}}`, varName);

    if (!externalVar.value) {
      throw new RecipeError(`External dataset variable '${externalVar.name}' has no value defined. Please check the data.`);
    }

    scope[varName] = Array.isArray(externalVar.value) ? mathjs.matrix(externalVar.value) : externalVar.value;
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
   * Transform mathjs result into a DataSeriesValueFields
   */
  const output: Partial<DataSeriesValueFields> = {};
  let resultArray: unknown[] = [];

  // Coerce result into a 1D array
  if (mathjs.isMatrix(result)) {
    if (result.size().filter((d: number) => d > 1).length > 1) {
      throw new RecipeError(`Resulting matrix has more than one dimension (${result.size().join("x")}), which is not supported.`);
    }
    resultArray = result.toArray().flat().map(v => Number.isFinite(v) ? v : null);
  }
  else if (Array.isArray(result)) {
    resultArray = result.map(v => Number.isFinite(v) ? v as number : null);
  }
  else if (mathjs.isCollection(result) && 'toArray' in result && typeof result.toArray === 'function') {
    resultArray = result.toArray().map(v => Number.isFinite(v) ? v : null);
  }
  else if (["number", "BigNumber", "Complex", "Unit"].includes(mathjs.typeOf(result)) && !isNaN(result as number)) {
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
  let commonUnit: string | undefined = undefined;
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
      }
      else if (commonUnit !== unitString) {
        warnings.push(`Inconsistent units in result for year ${year}. Expected '${commonUnit}', got '${unitString}'.`);
      }
      value = value.toNumber();
    }

    // Handle BigNumbers
    if (mathjs.isBigNumber(value)) {
      value = value.toNumber();
    }

    // Final check for a valid number
    if (typeof value === "number" && !isNaN(value)) {
      output[year] = value;
    }
    else {
      throw new RecipeError(`Invalid value for year '${year}': expected a finite number, but got ${mathjs.typeOf(resultArray[i])}`);
    }
  }

  // Make output into a full DataSeriesValueFields object
  for (const year of Years) {
    output[year] = output[year] ?? null;
  }
  if (!isFullDataSeriesValueFields(output)) {
    throw new RecipeError("Failed to construct a full DataSeriesValueFields object from the result.");
  }

  return {
    dataSeries: output,
    unit: commonUnit || null,
  };
}