import { isEvalTimeVariable, isRecipe, MathjsError, RecipeError } from "@/functions/recipe/types";
import type { Recipe, RecipeExtractionOutput, RecipeVariable } from "@/functions/recipe/types";
import type { DateValuesWithUnit, JSONValue, Mask } from "@/types";
import { parseDateValuesFromVector, transformDateValuesToVector, ANDMasks } from "@/functions/recipe/vectorAndMaskUtils";
import mathjs from "@/math";
import type { Unit } from "mathjs";
import { extractDataSeries, extractExternalDatasets, extractScalars } from "./extractors";


/** 
 * TODO / Ideas for this file
 * - Cache data series and external datasets
 * - Save last eval result so implementations can get that without re-evaluating
 * - Save warnings and errors from last evaluation
 */

export class SmartRecipe {
  public name: string | null | undefined; // String if given, null if removed, undefined if not specified
  public equation: string;
  public variables: Record<string, RecipeVariable>;

  public constructor({
    name,
    eq,
    variables,
  }: {
    name: string | null | undefined;
    eq: string;
    variables: Record<string, RecipeVariable>;
  }) {
    this.name = name;
    this.equation = eq;
    this.variables = variables;
  }

  /** 
   * Runs evaluator on recipe and catch anything wrong
   */
  public async checkValidity(): Promise<{ good: boolean, error: string | undefined, warnings: string[] | undefined }> {
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
    if (!isRecipe(this.recipe)) {
      throw new RecipeError("Invalid recipe format");
    }

    const [dataSeriesVars, externalVars] = await Promise.all([
      extractDataSeries(this.variables),
      extractExternalDatasets(this.variables),
    ]);
    const allVars: RecipeExtractionOutput = [
      ...extractScalars(this.variables),
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
        new Date(`2010-01-01T00:00:00.000Z`),
        new Date(`2100-01-01T00:00:00.000Z`),
      ];
    const commonLength = commonEndDate.getUTCFullYear() - commonStartDate.getUTCFullYear();

    const masks: Mask[] = [];
    for (const ds of seriesVariables) {
      const { mask, vector } = transformDateValuesToVector(
        ds.series,
        commonStartDate,
        commonLength,
      );
      masks.push(mask);
      evalTimeVars.push({
        name: ds.name,
        value: vector,
      });
    }

    // TODO - reimplement these
    warnings.push("Sanity checks are not yet implemented for SmartRecipe.");
    // sanityCheckScalars(scalars, warnings);
    // sanityCheckDataSeries(dataSeries, warnings);
    // sanityCheckExternalDatasets(externalDatasets, warnings);

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
      result = Array(commonLength).fill(result.clone()) as Unit[];
    }

    return parseDateValuesFromVector(
      {
        vector: result,
        mask: ANDMasks(masks),
      }
    );
  }

  /** 
   * Stringify SmartRecipe to a state that can be reversed for storage purposes.
   */
  public toSerialized(): string {
    return JSON.stringify({
      ...this.toRecipe(),
      smartMeta: { v: 1 },
    });
  }

  /** 
   * Get converted SmartRecipe as a plain Recipe object.
   */
  public toRecipe(): Recipe {
    // TODO: parse smart meta
    return {
      name: this.name,
      eq: this.equation,
      variables: this.variables,
    };
  }
  /** 
   * Get converted SmartRecipe as a plain Recipe object.
   */
  public get recipe(): Recipe { return this.toRecipe(); }

  /** 
   * Clones this instance of SmartRecipe.
   */
  public copy(): SmartRecipe {
    return SmartRecipe.fromObject(this.toRecipe());
  }

  /** 
   * SmartRecipe factory, takes serialized recipe and returns a new smart recipe instance.
   */
  public static fromSerialized(serializedRecipe: string): SmartRecipe {
    let objectForm: JSONValue;

    try {
      objectForm = JSON.parse(serializedRecipe) as JSONValue;
    } catch (_) {
      throw new RecipeError("Invalid serialized recipe format");
    }

    if (!isRecipe(objectForm)) {
      throw new RecipeError("Invalid serialized recipe format");
    }

    return SmartRecipe.fromObject(objectForm);
  }

  /** 
   * SmartRecipe factory, takes recipe object and returns a new smart recipe instance if valid.
   */
  public static fromObject(obj: JSONValue): SmartRecipe {
    if (typeof obj !== "object" || obj === null) {
      throw new RecipeError("Invalid object format for recipe");
    }

    if (!isRecipe(obj)) {
      throw new RecipeError("Invalid object format for recipe");
    }

    return new SmartRecipe({
      name: obj.name,
      eq: obj.eq,
      variables: obj.variables,
    });
  }
  public static fromRecipe(recipe: Recipe): SmartRecipe {
    return SmartRecipe.fromObject(recipe);
  }

  /** 
   * SmartRecipe factory, returns an empty smart recipe instance.
   */
  public static getEmpty(): SmartRecipe {
    return new SmartRecipe({
      name: undefined,
      eq: "",
      variables: {},
    });
  }

  /** 
   * Factory method to create a SmartRecipe from another SmartRecipe.
   */
  public static fromSmartRecipe(smartRecipe: SmartRecipe): SmartRecipe {
    return SmartRecipe.fromSerialized(smartRecipe.toSerialized());
  }
}