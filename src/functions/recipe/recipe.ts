import type { DataSeries, DateValuesWithUnit, JSONValue, Mask, UnitString } from "@/types";
import { isISOIshDate } from "@/types";
import mathjs from "@/math";
import type { Unit } from "mathjs";
import type { ApiTableContent } from "@/lib/api/apiTypes";
import type { ExternalSelection, ExternalVariable, RecipeExtractionOutput, RecipeVariable, SerializedRecipe, RecipeShape, DataSeriesVariable } from "@/functions/recipe";
import { isEvalTimeVariable, isRecipe, MathjsError, RecipeError, parseDateValuesFromVector, transformDateValuesToVector, ANDMasks, extractDataSeries, extractExternalDatasets, extractScalars, isEvalTimeSeries, RecipeDataTypes, VectorIndexPickerOptions } from "@/functions/recipe";
import type { DatasetKeys } from "@/lib/api/utility";
import { sanityCheckDataSeries, sanityCheckExternalDatasets, sanityCheckScalars } from "@/functions/recipe/sanityChecks";

/**
 * Deterministic JSON serialization: object keys are sorted recursively so that
 * two structurally-equal values produce identical strings regardless of key
 * insertion order. Array order is preserved (it is significant).
 */
function canonicalStringify(value: unknown): string {
  return JSON.stringify(value, (_key, val: unknown) => {
    if (val && typeof val === "object" && !Array.isArray(val)) {
      return Object.fromEntries(
        Object.entries(val as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)),
      );
    }
    return val;
  });
}

export class Recipe {
  public name: string;
  public equation: string;
  public variables: RecipeVariable[];
  private meta?: RecipeShape["meta"];

  public constructor({
    name,
    equation,
    variables,
    meta,
  }: {
    name: string;
    equation: string;
    variables: RecipeVariable[];
    meta?: RecipeShape["meta"];
  }) {
    this.name = name;
    this.equation = equation;
    this.variables = variables;
    this.meta = meta;
  }

  public get variableMap(): Record<string, RecipeVariable> {
    return Object.fromEntries(this.variables.map(variable => [variable.id, variable]));
  }

  public isTemplate(): boolean {
    return Object.values(this.variables).some(v => v.template);
  }

  public isSuggestedRecipe(): boolean {
    return this.meta?.isSuggestedRecipe ?? false;
  }

  /**
   * Whether this recipe just wraps a single hand-entered ("manual"/"static")
   * data series. Such recipes are produced by {@link Recipe.fromManualDateValues}
   * and let forms tell a manual entry apart from a real, composed recipe.
   */
  public isManual(): boolean {
    return this.meta?.isManual ?? false;
  }

  /** 
   * Runs evaluator on recipe and catch anything wrong
   */
  public async checkValidity(options?: Parameters<Recipe["evaluate"]>[1]): Promise<{ good: boolean, error: string | undefined, warnings: string[] | undefined }> {
    if (this.isTemplate()) {
      console.info("Recipe contains template variables, skipping validity check.");
      return { good: true, error: undefined, warnings: undefined };
    }

    const warnings: string[] = [];
    try {
      const _ = await this.evaluate(warnings, options);
      if (warnings.length) {
        console.warn("Warnings encountered during recipe validity check:", warnings);
      }
      return {
        good: true,
        error: undefined,
        warnings: warnings.length ? warnings : undefined,
      };
    }
    catch (err) {
      if (warnings.length) {
        console.warn("Warnings encountered during recipe validity check:", warnings);
      }

      const errorAliases = {
        "Unexpected type of argument in function addScalar (expected: Unit, actual: number, index: 1)":
          "Cannot add a unitless number to a unit.",
        "Unexpected type of argument in function addScalar (expected: number or bigint or string or boolean or BigNumber or Complex or Fraction, actual: Unit, index: 1)":
          "Cannot add a unit to a unitless number.",
      };

      const errorMessage = err instanceof Error ? err.message : String(err);
      const friendlyMessage = errorAliases[errorMessage as keyof typeof errorAliases] ?? errorMessage;

      return {
        good: false,
        error: friendlyMessage,
        warnings: warnings.length ? warnings : undefined,
      };
    }
  }
  /** 
   * Runs evaluator and simply returns a bool if it ran through or not
   */
  public async isValid(options?: Parameters<Recipe["evaluate"]>[1]): Promise<boolean> {
    return (await this.checkValidity(options)).good;
  }

  /** 
   * Evaluate the recipe.
   * 
   * @param warnings **Side effect only**. Array will be mutated in place to include any warnings encountered during evaluation. 
   */
  public async evaluate(
    warnings: string[] = [],
    options?: {
      dataSeriesGetter?: (dataSeriesId: string) => Promise<DataSeries | null>;
      externalTableContentGetter?: (tableId: string, dataset: string, selection: { variableCode: string, valueCodes: string[] }[]) => Promise<ApiTableContent | null>;
    },
  ): Promise<DateValuesWithUnit | null> {
    const serialized = this.serialize();
    const asObject = JSON.parse(serialized) as JSONValue;
    if (!isRecipe(asObject)) {
      throw new RecipeError("Invalid recipe format");
    }

    if (this.equation.trim() === "") {
      throw new RecipeError("Equation is empty, no evaluation performed.");
    }

    const scalarVars = extractScalars(this.variables, warnings);
    const [dataSeriesVars, externalVars] = await Promise.all([
      extractDataSeries(this.variables, warnings, options?.dataSeriesGetter),
      extractExternalDatasets(this.variables, warnings, options?.externalTableContentGetter, options?.dataSeriesGetter),
    ]);
    const allVars: RecipeExtractionOutput = [
      ...scalarVars,
      ...dataSeriesVars,
      ...externalVars,
    ];

    const evalTimeVars = allVars.filter(v => isEvalTimeVariable(v, { silent: true }));
    const seriesVariables = allVars.filter(v => isEvalTimeSeries(v, { silent: true }));

    const [commonStartDate, commonEndDate] = seriesVariables.length > 0
      ? (() => {
        const startYears = seriesVariables.map(v => {
          const dates = Object.keys(v.series.dateValues).sort();
          return new Date(dates[0]).getUTCFullYear();
        });
        const endYears = seriesVariables.map(v => {
          const dates = Object.keys(v.series.dateValues).sort();
          return new Date(dates[dates.length - 1]).getUTCFullYear();
        });
        const commonStartYear = Math.max(...startYears);
        const commonEndYear = Math.min(...endYears);
        return [
          new Date(`${commonStartYear}-01-01T00:00:00.000Z`),
          new Date(`${commonEndYear}-01-01T00:00:00.000Z`),
        ];
      })()
      : [
        new Date(`2020-01-01T00:00:00.000Z`),
        new Date(`2050-01-01T00:00:00.000Z`),
      ];
    // +1 since the diff would miss one fence post year
    const maxTimeSpan = commonEndDate.getUTCFullYear() - commonStartDate.getUTCFullYear() + 1;

    if (maxTimeSpan <= 0) {
      throw new RecipeError("The selected data series have no overlapping years; cannot evaluate. Adjust their date ranges or picks.");
    }

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

    // Build the variable map once; the getter rebuilds it on every access.
    const variableMap = this.variableMap;

    for (const variable of evalTimeVars) {
      if (!variable.value) {
        throw new RecipeError(`Variable "${variable.displayName}" (id: "${variable.id}") has no values.`);
      }

      const variableId = variable.id;
      const recipeVariable = variableMap[variableId];

      const newNameBase = nameNormalizer(variableId);
      let newName = newNameBase;
      for (let suffix = 1; suffix < 1000; suffix++) {
        if (!usedScopeNames.has(newName)) break;
        newName = `${newNameBase}_${suffix}`;
        if (suffix >= 999) {
          throw new RecipeError(`Too many variables with colliding names derived from variable id "${variableId}". Consider renaming the variable to have a more unique name.`);
        }
      }
      usedScopeNames.add(newName);

      // Normalize equation variable IDs.
      equation = equation.replaceAll(inlineEqEscapeFormat(variableId), newName);

      // Backward compatibility for legacy formulas that still reference display names.
      if (recipeVariable && displayNameCounts[recipeVariable.name] === 1) {
        equation = equation.replaceAll(inlineEqEscapeFormat(recipeVariable.name), newName);
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
    catch (err) {
      throw new MathjsError("Error evaluating recipe equation: " + (err as Error).message);
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
      },
    );
  }

  /**
   * Returns a copy of this recipe with any externally-derived data series
   * variables rehydrated back into `External` variables for editing.
   *
   * Stored recipes never contain `External` variables (they are materialized
   * into `DataSeries` on save), but the recipe editor works with `External`
   * variables. This reverses that conversion using the `externalSource` meta so
   * the editor and the rest of the recipe machinery stay unchanged.
   */
  public withEditableExternals(): Recipe {
    const copy = this.copy();
    copy.variables = copy.variables.map(variable => {
      if (variable.type !== RecipeDataTypes.DataSeries || !variable.externalSource) return variable;
      const editable: ExternalVariable = {
        id: variable.id,
        name: variable.name,
        type: RecipeDataTypes.External,
        unit: variable.unit,
        template: variable.template,
        pick: variable.pick,
        // Keep the materialized series as canon for the editor; only cleared when
        // the selection is explicitly changed.
        dataSeriesId: variable.dataSeriesId,
        dataset: variable.externalSource.dataset,
        tableId: variable.externalSource.tableId,
        selection: variable.externalSource.selection,
      };
      return editable;
    });
    return copy;
  }

  /**
   * Clones this instance of Recipe.
   */
  public copy(): Recipe {
    return Recipe.deserialize(this.serialize());
  }

  /** 
   * @deprecated
   * 
   * ## Notice
   * ### This is not the serialization method!
   * 
   * Uses JSON or {@linkcode Recipe.toPrettyString} to format the recipe in a readable way.
   */
  public toString(): string {
    console.warn("Recipe.toString() is not meant for serialization, but for human-readable formatting. For serialization, use Recipe.serialize().");
    return JSON.stringify(JSON.parse(this.serialize()), null, 2);
  }

  /**
   * Matches a `${token}` placeholder in an equation, capturing the inner token.
   * The token is usually a variable id, but legacy/suggested recipes reference
   * the variable's display name instead (see {@link Recipe.evaluate}).
   */
  private static readonly placeholderRegex = /\$\{([^}]+)\}/g;

  /**
   * Resolves a placeholder token (variable id or display name) to its variable.
   */
  private resolveVariableToken(token: string): RecipeVariable | undefined {
    return this.variableMap[token] ?? this.variables.find(v => v.name === token);
  }

  /**
   * The equation with every `${token}` placeholder replaced by the matching
   * variable's display name. Tokens that don't resolve are left as bare text.
   * For human-readable display only — not for evaluation or serialization.
   */
  public displayEquation(): string {
    return this.equation.replace(
      Recipe.placeholderRegex,
      (_match, token: string) => this.resolveVariableToken(token)?.name ?? token,
    );
  }

  /**
   * A one-line, human-readable summary of a single variable's source.
   */
  private static prettyVariableSummary(variable: RecipeVariable): string {
    switch (variable.type) {
      case RecipeDataTypes.Scalar: {
        return variable.unit ? `${variable.value} ${variable.unit}` : `${variable.value}`;
      }
      case RecipeDataTypes.DataSeries: {
        const source = variable.externalSource
          ? `${variable.externalSource.dataset ?? "external"}/${variable.externalSource.tableId ?? "?"}`
          : "data series";
        return `${source} · pick: ${String(variable.pick)}`;
      }
      case RecipeDataTypes.External: {
        const source = `${variable.dataset ?? "external"}/${variable.tableId ?? "?"}`;
        return `${source} · pick: ${String(variable.pick)}`;
      }
      default: {
        return (variable as RecipeVariable).type;
      }
    }
  }

  /**
   * ## Notice
   * ### This is not the serialization method!
   *
   * Builds a readable, multi-line summary of the recipe: its name, the equation
   * with placeholders unwrapped to variable names, and a line per variable
   * describing where it comes from. For display/logging only.
   */
  public toPrettyString(): string {
    const lines: string[] = [this.name];

    if (this.equation.trim() !== "") {
      lines.push(this.displayEquation());
    }

    if (this.variables.length > 0) {
      lines.push("");
      for (const variable of this.variables) {
        lines.push(`${variable.name} — ${Recipe.prettyVariableSummary(variable)}`);
      }
    }

    return lines.join("\n");
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
        isSuggestedRecipe: this.meta?.isSuggestedRecipe ?? false,
        isManual: this.meta?.isManual ?? false,
      },
    } satisfies RecipeShape) as SerializedRecipe;
  }

  /**
   * Universal Recipe factory. Normalizes any supported input to a validated
   * recipe instance.
   *
   * Accepts:
   *
   * ### 1. Serialized recipe string:
   * ```ts
   * "{ ... }"
   * ```
   *
   * ### 2. Existing Recipe instance (returns a clone)
   *
   * ### 3. Plain recipe object:
   * ```ts
   * {
   *   name: string;
   *   equation: string;
   *   ...
   * }
   * ```
   *
   * ### 4. DB-shaped object (serialized or deserialized `recipe` field):
   * ```ts
   * { id: string, recipe: string }
   * { id: string, recipe: { name: string, equation: string, ... } }
   * ```
   */
  public static from(input: string | Recipe | JSONValue): Recipe {
    if (input instanceof Recipe) return input.copy();

    const obj: JSONValue = typeof input === "string" ? Recipe.parseJson(input) : input;
    return Recipe.fromObject(obj);
  }

  /**
   * Typed entry point for serialized recipes. Equivalent to {@link Recipe.from}.
   */
  public static deserialize(serializedRecipe: string): Recipe {
    return Recipe.from(serializedRecipe);
  }

  /**
   * Parses a serialized recipe string into its object form.
   */
  private static parseJson(serialized: string): JSONValue {
    try {
      return JSON.parse(serialized) as JSONValue;
    }
    catch {
      throw new RecipeError("Invalid serialized recipe format, not a valid JSON string");
    }
  }

  /**
   * Recipe factory, takes a plain or DB-shaped recipe object and returns a new
   * recipe instance if valid. Use {@link Recipe.from} for the polymorphic entry.
   */
  private static fromObject(obj: JSONValue): Recipe {
    const normalized = Recipe.normalizeRecipeObject(obj);

    if (!isRecipe(normalized)) {
      throw new RecipeError("Invalid object format for recipe, object does not conform to Recipe type");
    }

    return new Recipe({
      name: normalized.name,
      equation: normalized.equation,
      variables: normalized.variables,
      meta: normalized.meta,
    });
  }

  /**
   * Normalizes supported input shapes to the actual recipe object payload.
   */
  private static normalizeRecipeObject(obj: JSONValue): JSONValue {
    if (typeof obj !== "object" || obj === null) {
      throw new RecipeError("Invalid object format for recipe, expected an object");
    }
    // If it's DB shaped it will have {id:string, recipe: JSONValue}
    if ("recipe" in obj) {
      const recipeField = obj.recipe;

      if (typeof recipeField !== "object" && typeof recipeField !== "string") {
        throw new RecipeError("Invalid object format for recipe, 'recipe' field is not an object or string");
      }

      if (typeof recipeField === "string") {
        try {
          return JSON.parse(recipeField) as JSONValue;
        }
        catch {
          throw new RecipeError("Invalid object format for recipe, 'recipe' field is a string but not a valid JSON string");
        }
      }

      return recipeField;
    }

    return obj;
  }

  /**
   * Recipe factory, returns an empty recipe instance.
   */
  public static getEmpty(): Recipe {
    return new Recipe({
      name: "Empty Recipe", // TODO: i18n
      equation: "",
      variables: [],
    });
  }

  /**
   * Recipe factory for a hand-entered ("manual"/"static") data series: a recipe
   * whose single inline `DataSeries` variable holds the entered values, with an
   * equation that just reads that variable. Evaluating it returns those values
   * unchanged, so a manual entry flows through the recipe context exactly like
   * any other data series input (see the manual data series input).
   *
   * Pass `variableId` to keep the variable id stable across edits; otherwise a
   * fresh id is generated. The recipe is tagged `meta.isManual` so forms can tell
   * it apart from a real, composed recipe (see {@link Recipe.isManual}).
   */
  public static fromManualDateValues(
    dateValues: DateValuesWithUnit,
    variableId: string = crypto.randomUUID(),
  ): Recipe {
    const inlineVariable: DataSeriesVariable = {
      id: variableId,
      name: "Manual data series", // TODO: i18n
      type: RecipeDataTypes.DataSeries,
      pick: VectorIndexPickerOptions.Default,
      unit: dateValues.unit ?? undefined,
      dataSeriesId: null,
      value: dateValues.dateValues,
    };
    return new Recipe({
      name: "Manual data series", // TODO: i18n
      equation: `\${${variableId}}`,
      variables: [inlineVariable],
      meta: { isManual: true },
    });
  }

  /**
   * Recipe factory for an external API data source: a recipe whose single
   * `External` variable holds the upstream API selection, with an equation that
   * just reads that variable. On save the server fetches it into a `DataSeries`
   * (e.g. a goal's `historical` series via `/api/goal/historical`).
   *
   * Pass `variableId` (the existing source's variable id) when editing so the
   * equation stays stable across edits; otherwise a fresh id is generated.
   */
  public static fromExternalSource({
    name,
    dataset,
    tableId,
    selection,
    variableId = crypto.randomUUID(),
  }: {
    name: string;
    dataset: DatasetKeys | null;
    tableId: string | null;
    selection: ExternalSelection;
    variableId?: string;
  }): Recipe {
    const externalVariable: ExternalVariable = {
      id: variableId,
      name,
      type: RecipeDataTypes.External,
      pick: VectorIndexPickerOptions.Default,
      unit: undefined,
      dataset,
      tableId,
      selection,
    };
    return new Recipe({
      name,
      equation: `\${${variableId}}`,
      variables: [externalVariable],
    });
  }

  /** 
   * Recipe factory for a data series: a recipe whose single `DataSeries` variable.
   */
  public static fromDataSeries({
    recipeName,
    dataSeriesName,
    unit = undefined,
  }: {
    recipeName: string;
    dataSeriesName: string;
    unit: UnitString;
  }): Recipe {
    const dataSeriesVariable: DataSeriesVariable = {
      id: crypto.randomUUID(),
      name: dataSeriesName,
      type: RecipeDataTypes.DataSeries,
      pick: VectorIndexPickerOptions.Default,
      unit,
      dataSeriesId: null,
      value: null,
    };
    return new Recipe({
      name: recipeName,
      equation: `\${${dataSeriesVariable.name}}`,
      variables: [dataSeriesVariable],
    });
  }

  /** 
   * To query whether a recipe has practically been touched, not a perfect metric, but a simple heuristic to check if the recipe is essentially empty or not.
   */
  public isEmpty(): boolean {
    if (this.equation.trim() !== "") {
      return false;
    }

    if (this.variables.length > 0) {
      return false;
    }

    return true;
  }

  /** 
   * Selective compare if two variables are the same
   */
  public static isVariableEqual(var1: RecipeVariable, var2: RecipeVariable): boolean {
    const ignoredFields: (keyof RecipeVariable)[] = ["template"];
    const var1Stripped = Object.fromEntries(Object.entries(var1).filter(([key]) => !ignoredFields.includes(key as keyof RecipeVariable)));
    const var2Stripped = Object.fromEntries(Object.entries(var2).filter(([key]) => !ignoredFields.includes(key as keyof RecipeVariable)));
    // Canonical (key-order-insensitive) compare so reordered fields aren't treated as changes.
    return canonicalStringify(var1Stripped) === canonicalStringify(var2Stripped);
  }
  /** 
   * Selective compare if two variable sets are the same
   */
  public static areVariablesEqual(vars1: Recipe["variables"], vars2: Recipe["variables"]): boolean {
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

  public static areRecipesEqual(recipe1: Recipe, recipe2: Recipe): boolean {
    if (recipe1.name !== recipe2.name) {
      return false;
    }

    if (recipe1.equation !== recipe2.equation) {
      return false;
    }

    if (!Recipe.areVariablesEqual(recipe1.variables, recipe2.variables)) {
      return false;
    }

    return true;
  }
}