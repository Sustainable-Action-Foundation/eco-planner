import mathjs from "@/math.ts";
import "../scripts/lib/console.ts";
import crypto from "crypto";
import { isNull } from "mathjs";

/** Truncates a message to fit within the terminal width, adding ellipses and excess length information if necessary. */
export function trunc(message: string) {
  const maxLength = process.stdout.columns || 80; // Default to 80 if columns is not defined
  if (message.length > maxLength) {
    const ellipses = "... "
    const excessLength = message.length - maxLength;
    const excessMarker = `(${excessLength}) `
    return message.slice(0, maxLength - ellipses.length - excessMarker.length) + ellipses + excessMarker;
  }
  return message;
}

/** Used when saving recipes into the database */
function hashRecipe(input: string) {
  const hashObject = crypto.createHash("sha256");
  hashObject.update(JSON.stringify(input));
  return hashObject.digest("hex");
}

/** Predefined variable names for normalization. */
const normalizedVariableNames = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "AA", "AB", "AC", "AD", "AE", "AF", "AG", "AH", "AI", "AJ", "AK", "AL", "AM", "AN", "AO", "AP", "AQ", "AR", "AS", "AT", "AU", "AV", "AW", "AX", "AY", "AZ", "BA", "BB", "BC", "BD", "BE", "BF", "BG", "BH", "BI", "BJ", "BK", "BL", "BM", "BN", "BO", "BP", "BQ", "BR", "BS", "BT", "BU", "BV", "BW", "BX", "BY", "BZ", "CA", "CB", "CC", "CD", "CE", "CF", "CG", "CH", "CI", "CJ", "CK", "CL", "CM", "CN", "CO", "CP", "CQ", "CR", "CS", "CT", "CU", "CV"];
function getVariableName(index: number): string {
  // Try to get a normalized variable name from the predefined list
  if (normalizedVariableNames[index]) {
    return normalizedVariableNames[index];
  }

  const maxTries = 1000; // Limit to prevent infinite loop
  let tries = 0;

  // Fallback to calculating a name based on the index
  index = normalizedVariableNames.length + index; // Start from the end of the predefined list  

  // Convert index to a letter (e.g., 0 -> 'A', 1 -> 'B', ..., 25 -> 'Z', 26 -> 'AA', etc.)
  let name = "";
  let i = index;
  do {
    if (tries++ > maxTries) {
      throw new Error("Too many tries to generate a variable name, something is wrong.");
    }

    name = String.fromCharCode((i % 26) + 65) + name; // 65 is ASCII code for 'A'
    i = Math.floor(i / 26) - 1; // Adjust for zero-based index
  } while (i >= 0);
  return name;
}

export class RecipeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}
export class RecipeInvalidFormatError extends RecipeError { }
export class RecipeEquationError extends RecipeError { }
export class RecipeVariablesError extends RecipeError { }

export class VectorTransformError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export type DataSeries = {
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
}

export type RecipeVariableScalar = {
  type: "scalar";
  value: number;
}
/** Should maybe be transformed into a @type {DataSeries} for better compatibility with other data sources? TODO */
export type RecipeVariableVector = {
  type: "vector";
  value: (number | string | null | undefined)[];
}
export type RecipeVariableDataSeries = {
  type: "dataSeries";
  value: DataSeries;
}
/** This should not be saved in the recipe on the db. It should be transformed into @type {RecipeVariableExternalDataset} */
export type RecipeVariableUrl = {
  type: "url";
  value: string;
}
export type RecipeVariableExternalDataset = {
  type: "externalDataset";
  value: {
    dataset: string; // e.g. "SCB", "Trafa"
    tableId: string; // e.g. "AM0101"
    variableId: string; // e.g. "Inkomst"
  }
}

export type UnparsedRecipeVariables = Record<string, RecipeVariableScalar | RecipeVariableVector | RecipeVariableDataSeries | RecipeVariableUrl | RecipeVariableExternalDataset>;
export type ParsedRecipeVariables = Record<string, RecipeVariableScalar | RecipeVariableDataSeries | RecipeVariableExternalDataset>;

/** Some variables are fine to take as input but need to be transformed to fit in the backend so that's why there are two types */
export type UnparsedRecipe = {
  eq: string;
  variables: UnparsedRecipeVariables;
};
/** Some variables will need to be transformed to fit this normalized recipe */
export type ParsedRecipe = {
  eq: string;
  variables: ParsedRecipeVariables;
};

/** 
 * TODO - add descriptions for all interpolation methods
 */
export type RecipeParserOptions = {
  interpolationMethod: "interpolate_missing" | "only_overlapping" | "zero_fill" | "none";
  log: boolean; // Whether to log the parsing process
};
export const defaultRecipeParserOptions: RecipeParserOptions = {
  interpolationMethod: "interpolate_missing",
  log: false, // Default to not logging the parsing process
};
export type VectorTransformationOptions = {
  interpolationMethod: "naive_index_map" | "even_distribution" | "require_length_match";
  fillMethod: "zero_fill" | "null_fill";
};
export const defaultVectorTransformationOptions: Partial<VectorTransformationOptions> = {
  interpolationMethod: "naive_index_map",
  fillMethod: "null_fill",
};

function vectorToDataSeries(vector: (number | string | undefined | null)[], options = defaultVectorTransformationOptions) {
  options = { ...defaultVectorTransformationOptions, ...options };

  const vec: (number | null)[] = [];

  for (const val of vector) {
    if (typeof val === "string") {
      const parsedNumber = parseFloat(val);
      if (!Number.isFinite(parsedNumber) && !Number.isNaN(parsedNumber)) throw new VectorTransformError(`Tried converting string (${val}) into a number but the result is not finite or NaN.`)
      vec.push(parsedNumber)
    }
    else if (typeof val === "number") {
      const number = val;
      if (!Number.isFinite(number) && !Number.isNaN(number)) throw new VectorTransformError(`Tried converting number (${number}) into a number but the result is not finite or NaN.`)
      vec.push(number);
    }
    else if (typeof val === "undefined" || val === null) {
      // Explicit undefined and empty values are treated as null for the sake of data base ease
      vec.push(null);
    }
    else {
      throw new VectorTransformError(`Vector to data series function received vector containing unknown type (${typeof val})`);
    }
  }

  const dataSeries = {} as DataSeries;
  const years: (keyof DataSeries)[] = new Array(31).fill(2020).map((y, i) => (y + i).toString()) as (keyof DataSeries)[];

  switch (options.interpolationMethod) {
    case "naive_index_map":
      years.forEach((year, i) => {
        dataSeries[year] = vec[i] ?? (options.fillMethod === "zero_fill" ? 0 : null);
      });
      break;
    case "even_distribution":
      const vectorLength = vec.length;
      const yearCount = years.length;
      const step = yearCount / vectorLength;
      const indices = Array.from({ length: yearCount }, (_, i) => Math.floor(i * step));
      for (let i = 0; i < yearCount; i++) {
        if (indices.includes(i)) {
          const index = indices.indexOf(i);
          dataSeries[years[i]] = vec[index] ?? (options.fillMethod === "zero_fill" ? 0 : null);
        }
        else {
          // Fill
          dataSeries[years[i]] = (options.fillMethod === "zero_fill" ? 0 : null);
        }
      }
      break;
    case "require_length_match":
      if (vec.length !== years.length) {
        throw new VectorTransformError(`Vector length (${vec.length}) does not match the number of years (${years.length}). Use a different interpolation method or adjust the vector length.`);
      }
      years.forEach((year, i) => {
        dataSeries[year] = vec[i] ?? (options.fillMethod === "zero_fill" ? 0 : null);
      });
      break;
    default:
      throw new VectorTransformError(`Unknown interpolation method: ${options.interpolationMethod}`);
  }

  return dataSeries;
}

function validateRecipeType(recipe: UnparsedRecipe | string): UnparsedRecipe {
  // Validate JSON
  if (typeof recipe === "string") {
    try {
      recipe = JSON.parse(recipe);
    }
    catch (error) {
      throw new Error("Invalid JSON format for recipe");
    }
  }

  // At this point reading it as a Recipe type should be safe even thought it might not contain all the properties
  const r = recipe as UnparsedRecipe;

  // Validate Recipe type
  if (!r) {
    throw new RecipeInvalidFormatError("Recipe is undefined or null.");
  }
  // Has props
  if (typeof r !== "object" || !r.eq || !r.variables) {
    throw new RecipeInvalidFormatError("Invalid recipe format. Expected an object with 'eq' and 'variables' properties.");
  }
  // Non-empty equation
  if (typeof r.eq !== "string" || r.eq.trim() === "") {
    throw new RecipeEquationError(`Invalid equation format. Expected a non-empty string. (${r.eq})`);
  }
  // At least one variable in the equation
  if (r.eq.match(/\$\{([\w-]+)\}/g) === null) {
    throw new RecipeEquationError(`Invalid equation format. Expected at least one variable in the form \${variable}. (${r.eq})`);
  }
  // Variables should be a non-empty object
  if (typeof r.variables !== "object" || Array.isArray(r.variables) || Object.keys(r.variables).length === 0) {
    throw new RecipeVariablesError(`Invalid variables format. Expected a non-empty object where keys are variable names and values are objects, see type definitions. ${JSON.stringify(r.variables, null, 2)}`);
  }
  // Variable types should be valid
  for (const key in r.variables) {
    const variable = r.variables[key];
    if (!variable || typeof variable !== "object") {
      throw new RecipeVariablesError(`Invalid variable for '${key}'. Expected an object.`);
    }
    if (!("type" in variable) || !("value" in variable)) {
      throw new RecipeVariablesError(`Invalid variable for '${key}'. Expected 'type' and 'value' properties.`);
    }
    switch (variable.type) {
      case "scalar":
        if (typeof variable.value !== "number" || !isFinite(variable.value)) {
          throw new RecipeVariablesError(`Invalid scalar value for '${key}'. Expected a finite number.`);
        }
        break;
      case "vector":
        if (!Array.isArray(variable.value) || !variable.value.every(v => v === null || v === undefined || (typeof v === "number" && isFinite(v)) || (typeof v === "string" && isFinite(parseFloat(v))))) {
          throw new RecipeVariablesError(`Invalid vector value for '${key}'. Expected an array of finite numbers, nulls, or numeric strings.`);
        }
        break;
      case "url":
        if (typeof variable.value !== "string" || variable.value.trim() === "" || !URL.canParse(variable.value)) {
          throw new RecipeVariablesError(`Invalid URL value for '${key}'. Expected a valid URL string.`);
        }
        break;
      case "dataSeries":
        if (typeof variable.value !== "object" || Array.isArray(variable.value) || Object.keys(variable.value).length === 0 || !Object.values(variable.value).every(v => typeof v === "number" && isFinite(v) || v === null)) {
          throw new RecipeVariablesError(`Invalid data series value for '${key}'. Expected an object with year keys and finite number values or null.`);
        }
        break;
      case "externalDataset":
        if (typeof variable.value !== "object" || !("dataset" in variable.value) || !("tableId" in variable.value) || !("variableId" in variable.value) ||
          typeof variable.value.dataset !== "string" || typeof variable.value.tableId !== "string" || typeof variable.value.variableId !== "string") {
          throw new RecipeVariablesError(`Invalid external dataset value for '${key}'. Expected an object with 'dataset', 'tableId', and 'variableId' properties.`);
        }
        break;
      default:
        throw new RecipeVariablesError(`Invalid variable type for '${key}'. Expected 'scalar', 'vector', or 'url'.`);
    }
  }

  return r;
}

function normalizeRecipeVariableNames(recipe: UnparsedRecipe | string, warnings: string[] = []): UnparsedRecipe {
  recipe = validateRecipeType(recipe);

  // Normalize variable names
  const renameMap: Record<string, string> = Object.fromEntries(Object.keys(recipe.variables).map((key, index) => [`${key}`, getVariableName(index)]));
  recipe.eq = recipe.eq.replace(/\$\{([\w-]+)\}/g, (_, varName) => {
    if (renameMap[varName]) {
      return `\${${renameMap[varName]}}`;
    }
    throw new RecipeEquationError(`Variable "${varName}" is used in the equation but not defined in variables.`);
  });
  recipe.variables = Object.fromEntries(Object.entries(recipe.variables).map(([key, variable]) => {
    if (!renameMap[key]) throw new RecipeEquationError(`Variable "${key}" does not exist.`);
    const normalizedKey = renameMap[key] || key; // Use the normalized name or fallback
    return [normalizedKey, variable];
  }));

  return recipe;
}

function sketchyScalars(scalars: [string, RecipeVariableScalar][], warnings: string[]) {
  const hugeScalar = scalars.filter(([, variable]) => Math.abs(variable.value) > 1e12);
  if (hugeScalar.length > 0) {
    warnings.push(`Recipe contains huge scalar values: ${hugeScalar.map(s => s.at(0)).join(", ")}, which may lead to performance issues or overflow errors.`);
  }

  const nearZeroScalar = scalars.filter(([, variable]) => Math.abs(variable.value) < 1e-12 && variable.value !== 0);
  if (nearZeroScalar.length > 0) {
    warnings.push(`Recipe contains scalar values close to zero: ${nearZeroScalar.map(s => s.at(0)).join(", ")}, which may lead to precision issues during evaluation.`);
  }

  const negativeScalar = scalars.filter(([, variable]) => variable.value < 0);
  if (negativeScalar.length > 0) {
    warnings.push(`Recipe contains negative scalar values: ${negativeScalar.map(s => s.at(0)).join(", ")}, which may lead to unexpected results in calculations.`);
  }

  const divideByZero = scalars.filter(([, variable]) => variable.value === 0);
  if (divideByZero.length > 0) {
    warnings.push("Recipe contains scalar values that are zero, which may lead to division by zero errors during evaluation or zeroing of other values in multiplication.");
  }
}

function sketchyVectors(vectors: [string, RecipeVariableVector][], warnings: string[]) {
  const hugeValuesInVector = vectors.filter(([, variable]) => variable.value.some(v => (typeof v === "number" || typeof v === "string") && Math.abs(parseFloat(v.toString())) > 1e12));
  if (hugeValuesInVector.length > 0) {
    warnings.push(`Recipe contains huge vector values: ${hugeValuesInVector.map(v => v.at(0)).join(", ")}, which may lead to performance issues or overflow errors.`);
  }

  const longVector = vectors.filter(([, variable]) => variable.value.length > 50);
  if (longVector.length > 0) {
    warnings.push(`Recipe contains very long vectors: ${longVector.map(v => v.at(0)).join(", ")}, which may lead to performance issues or unexpected results in calculations.`);
  }

  const shortVector = vectors.filter(([, variable]) => variable.value.length < 2);
  if (shortVector.length > 0) {
    warnings.push(`Recipe contains very short vectors: ${shortVector.map(v => v.at(0)).join(", ")}, which may lead to unexpected results in calculations.`);
  }
}

function sketchyUrls(urls: [string, RecipeVariableUrl][], warnings: string[]) {
  // TODO - implement
}

function sketchyDataSeries(dataSeries: [string, RecipeVariableDataSeries][], warnings: string[]) {
  const hugeValuesInDataSeries = dataSeries.filter(([, variable]) => Object.values(variable.value).some(v => !isNull(v) && Math.abs(v) > 1e12));
  if (hugeValuesInDataSeries.length > 0) {
    warnings.push(`Recipe contains huge data series values: ${hugeValuesInDataSeries.map(ds => ds.at(0)).join(", ")}, which may lead to performance issues or overflow errors.`);
  }

  const longDataSeries = dataSeries.filter(([, variable]) => Object.keys(variable.value).length > 50);
  if (longDataSeries.length > 0) {
    warnings.push(`Recipe contains very long data series: ${longDataSeries.map(ds => ds.at(0)).join(", ")}, which may lead to performance issues or unexpected results in calculations.`);
  }

  const shortDataSeries = dataSeries.filter(([, variable]) => Object.keys(variable.value).length < 2);
  if (shortDataSeries.length > 0) {
    warnings.push(`Recipe contains very short data series: ${shortDataSeries.map(ds => ds.at(0)).join(", ")}, which may lead to unexpected results in calculations.`);
  }
}

function sketchyExternalDatasets(externalDatasets: [string, RecipeVariableExternalDataset][], warnings: string[]) {
  // TODO - implement
}

export function parseRecipe(recipe: UnparsedRecipe | string, options: RecipeParserOptions = defaultRecipeParserOptions): { recipe: ParsedRecipe, result: DataSeries, warnings: string[] } {
  options = { ...defaultRecipeParserOptions, ...options };

  const warnings: string[] = [];
  const normalizedNamesRecipe = normalizeRecipeVariableNames(recipe, warnings);

  if (options.log) console.log(trunc(`Parsing recipe... ${normalizedNamesRecipe.eq}`));

  // Extract variables from the equation
  const variables = normalizedNamesRecipe.eq.match(/\$\{([\w-]+)\}/g);

  // No variables
  if (!variables) {
    // This should be caught by validateRecipeType, but as a safeguard:
    throw new RecipeEquationError("No variables found in the equation");
  }

  const definedVariables = Object.keys(normalizedNamesRecipe.variables);

  // Missing variable definitions
  const missingVariables = variables.map(v => v.replace(/\$\{|\}/g, "")).filter(v => !definedVariables.includes(v));
  if (missingVariables.length > 0) {
    throw new RecipeVariablesError(`Missing variables in the equation: ${missingVariables.join(", ")}`);
  }

  // Excess variable definitions
  const extraVariables = definedVariables.filter(v => !variables.includes(`\${${v}}`));
  if (extraVariables.length > 0) {
    warnings.push(`Extra variables defined but not used in the equation: ${extraVariables.join(", ")}`);
  }


  // Variable type sanity checks
  const vectors: [string, RecipeVariableVector][] = [];
  const scalars: [string, RecipeVariableScalar][] = [];
  const urls: [string, RecipeVariableUrl][] = [];
  const dataSeries: [string, RecipeVariableDataSeries][] = [];
  const externalDatasets: [string, RecipeVariableExternalDataset][] = [];
  Object.entries(normalizedNamesRecipe.variables).forEach(([key, variable]) => {
    switch (variable.type) {
      case "scalar":
        scalars.push([key, variable]);
        break;
      case "vector":
        vectors.push([key, variable]);
        break;
      case "url":
        urls.push([key, variable]);
        break;
      case "dataSeries":
        dataSeries.push([key, variable]);
        break;
      case "externalDataset":
        externalDatasets.push([key, variable]);
        break;
      default:
        // @ts-expect-error - In case of extreme type mismanagement
        throw new RecipeVariablesError(`Unknown variable type for '${key}': ${variable.type}`);
    }
  });

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
        if (options.log) console.warn(`Ignoring URL variable '${key}' for now. TODO - implement URL handling.`);
        break;
      case "externalDataset":
        // Ignore for now. TODO - implement external dataset handling
        if (options.log) console.warn(`Ignoring external dataset variable '${key}' for now. TODO - implement external dataset handling.`);
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
          return `{${Object.entries(variable.value).map(([year, value]) => value ?? "0").join(", ")}}`; // Convert data series to a string representation
        default:
          throw new RecipeVariablesError(`Unknown variable type for '${varName}': ${variable.type}`);
      }
    }
    else {
      throw new RecipeVariablesError(`Variable '${varName}' not found in the recipe variables.`);
    }
  });

  if (options.log) console.log(trunc(`Resolved equation: ${resolvedEquation}`));

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