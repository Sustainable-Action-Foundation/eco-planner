import { isRecipe, MathjsError, Recipe, RecipeError, RecipeVariable } from "./recipe-parser/types";
import { DataSeriesValueFields, JSONValue, Years } from "@/types";
import { convertVectorToYearValuePair, extractDataSeries, extractExternalDatasets, extractScalars } from "./recipe-parser/extractors";
import { Unit } from "mathjs";
import mathjs from "@/math";
import { sanityCheckDataSeries, sanityCheckScalars } from "./recipe-parser/sanityChecks";

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
  if (!isRecipe(recipe)) {
    throw new RecipeError("Invalid recipe format");
  }

  const scalars = extractScalars(recipe.variables);
  const dataSeries = await extractDataSeries(recipe.variables);
  const externalDatasets = await extractExternalDatasets(recipe.variables);

  const allVars = [...scalars, ...dataSeries, ...externalDatasets];

  sanityCheckScalars(scalars, warnings);
  sanityCheckDataSeries(dataSeries, warnings);
  // sanityCheckExternalDatasets(externalDatasets, warnings); // TODO implement

  const scope: Record<string, number | number[] | Unit | Unit[]> = {};
  let equation = recipe.eq;

  if (equation.trim() === "") {
    // throw new RecipeError("Equation is empty.");
    return null;
  }

  const nameNormalizer = (name: string) => name.replace(/\s+/g, "_");
  const inlineEqEscapeFormat = (name: string) => `\${${name}}`;

  for (const variable of allVars) {
    if (!variable.value) {
      throw new RecipeError(`Variable "${variable.name}" has no values.`);
    }

    const newName = nameNormalizer(variable.name);

    // Normalize equation variable names
    equation = equation.replaceAll(inlineEqEscapeFormat(variable.name), newName);
    scope[newName] = variable.value;
  }

  let result;
  try {
    const rawResult: unknown = mathjs.evaluate(equation, scope);
    console.log(rawResult);
    // We expect result to be a Unit or Unit[]
    if (mathjs.typeOf(rawResult) === "Unit" || (Array.isArray(rawResult) && rawResult.every(item => mathjs.typeOf(item) === "Unit"))) {
      result = rawResult as Unit | Unit[];
    }
    else {
      throw new RecipeError("Result is not a Unit or array of Units.");
    }
  }
  catch (e) {
    throw new MathjsError("Error evaluating recipe equation: " + (e as Error).message);
  }

  if (mathjs.typeOf(result) === "Unit") {
    console.warn("Equation returned a scalar, applying to all fields.");
    result = Array(Years.length).fill(result);
  }
  result = result as Unit[]; // TODO type check in a dynamic way

  const resultingDataSeriesWithUnit = convertVectorToYearValuePair(result);
  const { unit, ...dataSeriesWithoutUnit } = resultingDataSeriesWithUnit;

  return {
    dataSeries: dataSeriesWithoutUnit,
    unit,
  };
}