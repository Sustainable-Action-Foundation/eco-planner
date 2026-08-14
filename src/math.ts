import type { UnitDefinition } from 'mathjs';
import { create, all, Unit as MathJSUnit } from 'mathjs';

const mathjs = create(all);

const customUnits: Record<string, UnitDefinition> = {
  "Atemp": {
    prefixes: 'none',
    baseName: 'area',
  },
  "capita": {
    prefixes: 'none',
  },
  "CO2e": {
    prefixes: 'none',
    aliases: ['co2e', 'Co2e', 'CO2', 'co2', 'Co2'],
  },
};

mathjs.createUnit(customUnits);

/**
 * Custom functions available in recipe equations through the mathjs parser.
 */
const customFunctions = {
  /**
   * First element of a vector whose value is non-zero, falling back to the
   * first element when every value is zero. Mathjs has no built-in for this;
   * used by derived-baseline recipe equations (`firstNonZero(${...})`).
   */
  firstNonZero(input: unknown): unknown {
    const values: unknown = mathjs.isMatrix(input) ? input.toArray() : input;
    if (!Array.isArray(values) || values.length === 0) {
      throw new Error("firstNonZero expects a non-empty vector.");
    }
    const flat = values.flat(Infinity) as unknown[];
    const found = flat.find(value => mathjs.isUnit(value)
      ? value.toNumber() !== 0
      : typeof value === "number" && value !== 0,
    );
    return found ?? flat[0];
  },
};

mathjs.import(customFunctions);

export default mathjs;

export const allOurUnits: string[] = [
  ...Object.keys(MathJSUnit.UNITS),
  ...Object.keys(customUnits), // This adds the custom units to the list without adding all the aliases
];