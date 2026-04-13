import type { DataSeries, DateValuesWithUnit, JSONValue, Mask } from "@/types";
import { isISOIshDate } from "@/types";
import mathjs from "@/math";
import type { Unit } from "mathjs";
import type { RecipeExtractionOutput, RecipeVariable, SerializedRecipe, SerializedRecipeShape } from "@/functions/recipe";
import { isEvalTimeVariable, isRecipe, MathjsError, RecipeError, parseDateValuesFromVector, transformDateValuesToVector, ANDMasks, extractDataSeries, extractExternalDatasets, extractScalars, } from "@/functions/recipe";
import { sanityCheckDataSeries, sanityCheckExternalDatasets, sanityCheckScalars } from "@/functions/recipe/sanityChecks";

export class Recipe {
  public name: string | null | undefined; // String if given, null if removed, undefined if not specified
  public equation: string;
  public variables: RecipeVariable[];

  public constructor({
    name,
    equation,
    variables,
  }: {
    name: string | null | undefined;
    equation: string;
    variables: RecipeVariable[];
  }) {
    this.name = name;
    this.equation = equation;
    this.variables = variables;
  }

  public get variableMap(): Record<string, RecipeVariable> {
    return Object.fromEntries(this.variables.map(variable => [variable.id, variable]));
  }

  public isTemplate(): boolean {
    return Object.values(this.variables).some(v => v.template);
  }

  /** 
   * Runs evaluator on recipe and catch anything wrong
   */
  public async checkValidity(): Promise<{ good: boolean, error: string | undefined, warnings: string[] | undefined }> {
    if (this.isTemplate()) {
      console.info("Recipe contains template variables, skipping validity check.");
      return { good: true, error: undefined, warnings: undefined, };
    }

    const warnings: string[] = [];
    try {
      const _ = await this.evaluate(warnings);
      if (warnings.length) {
        console.warn("Warnings encountered during recipe validity check:", warnings);
      }
      return {
        good: true,
        error: undefined,
        warnings: warnings.length ? warnings : undefined
      };
    }
    catch (e) {
      if (warnings.length) {
        console.warn("Warnings encountered during recipe validity check:", warnings);
      }

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
  public async evaluate(warnings: string[] = [], options?: { dataSeriesGetter: (dataSeriesId: string) => Promise<DataSeries | null> }): Promise<DateValuesWithUnit | null> {
    const serialized = this.serialize();
    const asObject = JSON.parse(serialized) as JSONValue;
    if (!isRecipe(asObject)) {
      throw new RecipeError("Invalid recipe format");
    }

    const scalarVars = extractScalars(this.variables, warnings);
    const [dataSeriesVars, externalVars] = await Promise.all([
      extractDataSeries(this.variables, warnings, options?.dataSeriesGetter),
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
        id: ds.id,
        displayName: ds.displayName,
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

    const nameNormalizer = (name: string) => {
      const collapsedWhitespace = name.trim().replace(/\s+/g, "_");
      const identifierSafe = collapsedWhitespace.replace(/[^A-Za-z0-9_]/g, "_");
      return /^[A-Za-z_]/.test(identifierSafe) ? identifierSafe : `v_${identifierSafe}`;
    };
    const inlineEqEscapeFormat = (name: string) => `\${${name}}`;
    const displayNameCounts = this.variables.reduce((counts, variable) => {
      counts[variable.name] = (counts[variable.name] ?? 0) + 1;
      return counts;
    }, {} as Record<string, number>);
    const usedScopeNames = new Set<string>();
    const loggedLegacyDisplayNameInfo = new Set<string>();

    for (const variable of evalTimeVars) {
      if (!variable.value) {
        throw new RecipeError(`Variable "${variable.displayName}" (id: "${variable.id}") has no values.`);
      }

      const variableId = variable.id;
      const recipeVariable = this.variableMap[variableId];
      const legacyDisplayNamePlaceholder = recipeVariable
        ? inlineEqEscapeFormat(recipeVariable.name)
        : null;
      const hasLegacyDisplayNamePlaceholder = !!legacyDisplayNamePlaceholder && equation.includes(legacyDisplayNamePlaceholder);

      const newNameBase = nameNormalizer(variableId);
      let newName = newNameBase;
      let suffix = 1;
      while (usedScopeNames.has(newName)) {
        newName = `${newNameBase}_${suffix}`;
        suffix += 1;
      }
      usedScopeNames.add(newName);

      // Normalize equation variable IDs.
      equation = equation.replaceAll(inlineEqEscapeFormat(variableId), newName);

      // Backward compatibility for legacy formulas that still reference display names.
      if (recipeVariable && displayNameCounts[recipeVariable.name] === 1) {
        if (hasLegacyDisplayNamePlaceholder && !loggedLegacyDisplayNameInfo.has(recipeVariable.name)) {
          console.info(`Recipe.evaluate: replacing deprecated display-name placeholder "${legacyDisplayNamePlaceholder}" with id-based placeholder for variable id "${variableId}".`);
          loggedLegacyDisplayNameInfo.add(recipeVariable.name);
        }
        equation = equation.replaceAll(inlineEqEscapeFormat(recipeVariable.name), newName);
      }
      else if (recipeVariable && hasLegacyDisplayNamePlaceholder && !loggedLegacyDisplayNameInfo.has(recipeVariable.name)) {
        console.info(`Recipe.evaluate: found deprecated display-name placeholder "${legacyDisplayNamePlaceholder}" but skipped auto-replacement because display name "${recipeVariable.name}" is ambiguous.`);
        loggedLegacyDisplayNameInfo.add(recipeVariable.name);
      }

      scope[newName] = variable.value;
    }

    let result: Unit | Unit[];
    try {
      const rawResult: unknown = mathjs.evaluate(equation, scope);

      const toUnit = (value: unknown): Unit => {
        if (mathjs.isUnit(value)) {
          return value;
        }
        if (typeof value === "number") {
          return mathjs.unit(value);
        }

        console.error("Result contains unsupported value type.", { value, type: typeof value });
        throw new RecipeError(`Result contains unsupported value types. {value: ${String(value)}, type: ${typeof value}}`);
      };

      const normalizeResult = (value: unknown): Unit | Unit[] => {
        // Handle 1d matrix
        if (
          typeof value === "object"
          && value !== null
          && "toArray" in value
          && typeof (value as { toArray: unknown }).toArray === "function"
        ) {
          return normalizeResult((value as { toArray: () => unknown }).toArray());
        }

        // Handle (Unit | number)[]
        if (Array.isArray(value)) {
          if (!value.every(item => mathjs.isUnit(item) || typeof item === "number")) {
            console.error("Result array contains unsupported value types.", { value, type: typeof value });
            throw new RecipeError("Result array contains unsupported value types.");
          }
          return value.map(toUnit);
        }

        // Handle single number | Unit
        return toUnit(value);
      };

      result = normalizeResult(rawResult);
    }
    catch (e) {
      throw new MathjsError("Error evaluating recipe equation: " + (e as Error).message);
    }

    if (result instanceof mathjs.Unit) {
      warnings.push("Equation returned a scalar, applying to all fields.");
      result = Array(maxTimeSpan).fill(result.clone()) as Unit[];
    }

    const outputMask: Mask = masks.length > 0
      ? ANDMasks(masks)
      : (() => {
        const generatedMask: Mask = {};
        const vectorLength = Array.isArray(result) ? result.length : 1;

        for (let i = 0; i < vectorLength; i++) {
          const currentYear = commonStartDate.getUTCFullYear() + i;
          const isoYearString = new Date(`${currentYear}-01-01T00:00:00Z`).toISOString();
          if (!isISOIshDate(isoYearString)) {
            throw new RecipeError(`Generated invalid ISOIshDate string: "${isoYearString}"`);
          }
          generatedMask[isoYearString] = false;
        }

        return generatedMask;
      })();

    return parseDateValuesFromVector(
      {
        vector: result,
        mask: outputMask,
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
      variables: [],
    });
  }

  /** 
   * Selective compare if two variables are the same
   */
  public static isVariableEqual(var1: RecipeVariable, var2: RecipeVariable): boolean {
    const ignoredFields: (keyof RecipeVariable)[] = ["template"];
    const var1Stripped = Object.fromEntries(Object.entries(var1).filter(([key]) => !ignoredFields.includes(key as keyof RecipeVariable)));
    const var2Stripped = Object.fromEntries(Object.entries(var2).filter(([key]) => !ignoredFields.includes(key as keyof RecipeVariable)));
    return JSON.stringify(var1Stripped) === JSON.stringify(var2Stripped);
  }
  /** 
   * Selective compare if two variable sets are the same
   */
  public static isVariablesEqual(vars1: Recipe["variables"], vars2: Recipe["variables"]): boolean {
    if (vars1.length !== vars2.length) {
      return false;
    }

    // TODO: Should this be order sensitive or not? Right now it is.
    const length = vars1.length;
    for (let i = 0; i < length; i++) {
      if (!Recipe.isVariableEqual(vars1[i], vars2[i])) {
        return false;
      }
    }

    return true;
  }
}