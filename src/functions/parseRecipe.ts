import { randomUUID } from "node:crypto";
import { getVariableName } from "./recipe-parser/helpers";
import { vectorToDataSeries, years } from "./recipe-parser/transformations";

type DataSeriesDbEntry = {
  uuid: string;
  unit?: string;
  data: DataSeriesArray;
};
const dataSeriesDB: Record<string, DataSeriesDbEntry> = {};


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

export type RawDataSeriesByLink = {
  type: "dataSeries";
  link: string; // uuid of data series in the database
}
export type RawDataSeriesByValue = {
  type: "dataSeries";
  value: Partial<DataSeriesArray>;
  unit?: string;
}
/** A data series might be defined in the inheritance form or it might be imported and it might have a unit */
export type RecipeVariableRawDataSeries = RawDataSeriesByLink | RawDataSeriesByValue;
export type RecipeVariableDataSeries = {
  type: "dataSeries";
  link: string; // uuid of data series in the database
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

// TODO - Implement
export function evaluateRecipe(recipe: Recipe): Partial<DataSeriesArray> {
  return {};
}