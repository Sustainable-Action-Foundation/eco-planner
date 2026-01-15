import { isRecipe, MathjsError, Recipe, RecipeError, RecipeVariable } from "@/functions/recipe/types";
import { DateValuesWithUnit, JSONValue, Years } from "@/types";
import { convertVectorToYearValuePair, extractDataSeries, extractExternalDatasets, extractScalars } from "@/functions/recipe/extractors";
import mathjs from "@/math";
import { Unit } from "mathjs";


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
  public hash: string | undefined = undefined;

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
      return {
        good: false,
        error: (e as Error).message,
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

    const scalars = extractScalars(this.variables);
    const dataSeries = await extractDataSeries(this.variables);
    const externalDatasets = await extractExternalDatasets(this.variables);

    const allVars = [...scalars, ...dataSeries, ...externalDatasets];

    // TODO - reimplement these
    warnings.push("Sanity checks are not yet implemented for SmartRecipe.");
    // sanityCheckScalars(scalars, warnings);
    // sanityCheckDataSeries(dataSeries, warnings);
    // sanityCheckExternalDatasets(externalDatasets, warnings);

    const scope: Record<string, number | number[] | Unit | Unit[]> = {};
    let equation = this.equation;

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

    return convertVectorToYearValuePair(result);
  }

  /** 
   * Stringify SmartRecipe to a state that can be reversed for storage purposes.
   */
  public toSerialized(): string {
    return JSON.stringify({
      name: this.name,
      eq: this.equation,
      variables: this.variables,
    });
  }

  /** 
   * Get converted SmartRecipe as a plain Recipe object.
   */
  public toRecipe(): Recipe {
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

  public async generateHash(): Promise<string> {
    // Hash with subtle crypto from browser
    const serialized = this.toSerialized();
    const hashArray = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(serialized));
    const hashHex = Array.from(new Uint8Array(hashArray)).map(b => b.toString(16).padStart(2, '0')).join('');
    this.hash = hashHex;
    return this.hash;
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