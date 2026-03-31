import type { DateValuesWithUnit, JSONValue, Mask } from "@/types";
import mathjs from "@/math";
import type { Unit } from "mathjs";
import type { RecipeExtractionOutput, RecipeVariable, SerializedRecipe, SerializedRecipeShape } from "@/functions/recipe";
import { isEvalTimeVariable, isRecipe, MathjsError, RecipeError, parseDateValuesFromVector, transformDateValuesToVector, ANDMasks, extractDataSeries, extractExternalDatasets, extractScalars, } from "@/functions/recipe";
import { sanityCheckDataSeries, sanityCheckExternalDatasets, sanityCheckScalars } from "@/functions/recipe/sanityChecks";

export class Recipe {
  public name: string | null | undefined; // String if given, null if removed, undefined if not specified
  public equation: string;
  public variables: Record<string, RecipeVariable>;

  public constructor({
    name,
    equation,
    variables,
  }: {
    name: string | null | undefined;
    equation: string;
    variables: Record<string, RecipeVariable>;
  }) {
    this.name = name;
    this.equation = equation;
    this.variables = variables;
  }

  /** 
   * Runs evaluator on recipe and catch anything wrong
   */
  public async checkValidity(): Promise<{ good: boolean, error: string | undefined, warnings: string[] | undefined }> {
    if (Object.values(this.variables).some(v => v.template)) {
      console.info("Recipe contains template variables, skipping validity check.");
      return { good: true, error: undefined, warnings: undefined, };
    }

    const warnings: string[] = [];
    try {
      const _ = await this.evaluate(warnings);
      if (warnings.length) console.warn(warnings);
      return {
        good: true,
        error: undefined,
        warnings: warnings.length ? warnings : undefined
      };
    }
    catch (e) {
      if (warnings.length) console.warn(warnings);

      const errorAliases = {
        "Unexpected type of argument in function addScalar (expected: Unit, actual: number, index: 1)":
          "Cannot add a unitless number to a unit.",
        "Unexpected type of argument in function addScalar (expected: number or bigint or string or boolean or BigNumber or Complex or Fraction, actual: Unit, index: 1)":
          "Cannot add a unit to a unitless number.",
      };

      const errorMessage = e instanceof Error ? e.message : String(e);
      const friendlyMessage = errorAliases[errorMessage as keyof typeof errorAliases] ?? errorMessage;

      return {
        good: false,
        error: friendlyMessage,
        warnings: warnings.length ? warnings : undefined
      };
    }
  }
  /** 
   * Runs evaluator and simply returns a bool if it ran through or not
   */
  public async isValid(): Promise<boolean> {
    return (await this.checkValidity()).good;
  }

  /** 
   * Evaluate the recipe.
   * 
   * @param warnings **Side effect only**. Array will be mutated in place to include any warnings encountered during evaluation. 
   */
  public async evaluate(warnings: string[] = []): Promise<DateValuesWithUnit | null> {
    const serialized = this.serialize();
    const asObject = JSON.parse(serialized) as JSONValue;
    if (!isRecipe(asObject)) {
      throw new RecipeError("Invalid recipe format");
    }

    const scalarVars = extractScalars(this.variables, warnings);
    const [dataSeriesVars, externalVars] = await Promise.all([
      extractDataSeries(this.variables, warnings),
      extractExternalDatasets(this.variables, warnings),
    ]);
    const allVars: RecipeExtractionOutput = [
      ...scalarVars,
      ...dataSeriesVars,
      ...externalVars,
    ];

    // TODO: type guard better and no magic strings
    const evalTimeVars = allVars.filter(isEvalTimeVariable);
    const seriesVariables = allVars.filter(v => "series" in v);

    const [commonStartDate, commonEndDate] = seriesVariables.length > 0
      ? (() => {
        const startDates = seriesVariables.map(v => {
          const dates = Object.keys(v.series.dateValues).sort();
          return new Date(dates[0]).getUTCFullYear();
        });
        const endDates = seriesVariables.map(v => {
          const dates = Object.keys(v.series.dateValues).sort();
          return new Date(dates[dates.length - 1]).getUTCFullYear();
        });
        return [
          new Date(Math.max(...startDates)),
          new Date(Math.min(...endDates)),
        ];
      })()
      : [
        new Date(`2020-01-01T00:00:00.000Z`),
        new Date(`2050-01-01T00:00:00.000Z`),
      ];
    const maxTimeSpan = commonEndDate.getUTCFullYear() - commonStartDate.getUTCFullYear();

    const masks: Mask[] = [];
    for (const ds of seriesVariables) {
      const { mask, vector } = transformDateValuesToVector(
        ds.series,
        commonStartDate,
        maxTimeSpan,
      );
      masks.push(mask);
      evalTimeVars.push({
        name: ds.name,
        value: vector,
      });
    }

    sanityCheckScalars(scalarVars, warnings);
    sanityCheckDataSeries(dataSeriesVars, warnings);
    sanityCheckExternalDatasets(externalVars, warnings);

    const scope: Record<string, number | number[] | Unit | Unit[]> = {};
    let equation = this.equation;

    if (equation.trim() === "") {
      console.info("Equation is empty. Early return.");
      return null;
    }

    const nameNormalizer = (name: string) => name.replace(/\s+/g, "_");
    const inlineEqEscapeFormat = (name: string) => `\${${name}}`;

    for (const variable of evalTimeVars) {
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

    if (result instanceof mathjs.Unit) {
      console.warn("Equation returned a scalar, applying to all fields.");
      result = Array(maxTimeSpan).fill(result.clone()) as Unit[];
    }

    return parseDateValuesFromVector(
      {
        vector: result,
        mask: ANDMasks(masks),
      }
    );
  }

  /** 
   * Clones this instance of Recipe.
   */
  public copy(): Recipe {
    return Recipe.deserialize(this.serialize());
  }

  /** 
   * ## Notice
   * ### This is not the serialization method!
   * 
   * Uses JSON to format the recipe in a readable way.
   */
  public toString(): string {
    return JSON.stringify(JSON.parse(this.serialize()), null, 2);
  }

  /** 
   * Stringify Recipe to a state that can be reversed for storage purposes.
   */
  public serialize(): SerializedRecipe {
    return JSON.stringify({
      name: this.name,
      equation: this.equation,
      variables: this.variables,
      meta: {
        v: 1,
      },
    } satisfies SerializedRecipeShape);
  }

  /** 
   * Recipe factory, takes serialized recipe and returns a new recipe instance.
   */
  public static deserialize(serializedRecipe: SerializedRecipe): Recipe {
    let objectForm: JSONValue;

    try {
      objectForm = JSON.parse(serializedRecipe) as JSONValue;
    }
    catch {
      throw new RecipeError("Invalid serialized recipe format, not a valid JSON string");
    }

    if (!isRecipe(objectForm)) {
      throw new RecipeError("Invalid serialized recipe format, not a valid Recipe object");
    }

    return Recipe.fromObject(objectForm);
  }

  /** 
   * Recipe factory, takes either a serialized recipe, a plain object recipe or an existing Recipe and returns a new recipe instance.
   */
  public static from(input: string | Recipe | JSONValue): Recipe {
    if (typeof input === "string") {
      return Recipe.deserialize(input);
    }
    else if (input instanceof Recipe) {
      return Recipe.deserialize(input.serialize());
    }
    else {
      return Recipe.fromObject(input);
    }
  }

  /** 
   * Recipe factory, takes recipe object and returns a new recipe instance if valid.
   */
  private static fromObject(obj: JSONValue): Recipe {
    if (typeof obj === "string") {
      console.info("Parsing recipe from string input, attempting to parse as serialized recipe.");
      return Recipe.deserialize(obj);
    }

    const normalized = Recipe.normalizeRecipeObject(obj);

    if (!isRecipe(normalized)) {
      throw new RecipeError("Invalid object format for recipe, object does not conform to Recipe type");
    }

    return new Recipe({
      name: normalized.name,
      equation: normalized.equation,
      variables: normalized.variables,
    });
  }

  /**
   * Normalizes supported input shapes to the actual recipe object payload.
   */
  private static normalizeRecipeObject(obj: JSONValue): JSONValue {
    if (typeof obj !== "object" || obj === null) {
      throw new RecipeError("Invalid object format for recipe, expected an object");
    }

    if ("recipe" in obj) {
      if (typeof obj.recipe !== "object" || obj.recipe === null) {
        throw new RecipeError("Invalid object format for recipe, 'recipe' field is not an object");
      }
      return obj.recipe as JSONValue;
    }

    return obj;
  }

  /** 
   * Recipe factory, returns an empty recipe instance.
   */
  public static getEmpty(): Recipe {
    return new Recipe({
      name: undefined,
      equation: "",
      variables: {},
    });
  }
}