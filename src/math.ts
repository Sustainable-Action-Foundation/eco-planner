import type { UnitDefinition } from 'mathjs';
import { create, all, Unit as MathJSUnit } from 'mathjs';

const mathjs = create(all);

/**
 * Units beyond what mathjs ships with. Three kinds:
 * - new base dimensions (people, money, counts), each with several spellings so
 *   `t CO2e/capita * 1000 person` cancels;
 * - compound units given as a `definition` (never a new `baseName`), so
 *   `pkm / person → km` and `person * km → personkm` work;
 * - Swedish names as reported by SCB/STEM and as users type them, defined in
 *   terms of the mathjs unit so they convert (`1 hektar → 10000 m2`).
 *
 * Only ASCII names can be parsed: the mathjs tokenizer stops at "å", so
 * "invånare" is spelled `invanare`. Never alias `inv` (matrix inverse function).
 *
 * Deliberately left out: "mil" (already a thousandth of an inch in mathjs) and
 * "%" (not a valid unit token). "ton" is redefined below.
 */
const customUnits: Record<string, UnitDefinition> = {
  // Heated floor area. Its own dimension, so it does not cancel against plain m2.
  "Atemp": {
    prefixes: 'none',
    baseName: 'area',
  },
  "CO2e": {
    prefixes: 'none',
    aliases: ['co2e', 'Co2e', 'CO2', 'co2', 'Co2'],
  },

  /* People, money, counts */
  "person": {
    prefixes: 'none',
    baseName: 'PERSON',
    aliases: ['persons', 'personer', 'capita', 'cap', 'pers', 'invanare'],
  },
  "SEK": {
    prefixes: 'short', // kSEK, MSEK, Mkr
    baseName: 'CURRENCY',
    aliases: ['kr', 'kronor'],
  },
  "st": {
    prefixes: 'none',
    baseName: 'COUNT',
    aliases: ['antal', 'styck', 'stycken', 'pcs', 'fordon'],
  },

  /* Transport work */
  "personkm": {
    definition: '1 person km',
    prefixes: 'short', // Mpkm
    aliases: ['pkm', 'personkilometer'],
  },
  "tonkm": {
    definition: '1 tonne km',
    prefixes: 'short',
    aliases: ['tkm', 'tonkilometer'],
  },
  "fordonskm": {
    definition: '1 st km',
    prefixes: 'short',
    aliases: ['fordonskilometer'],
  },

  /* Swedish spellings of mathjs units */
  // "år" after diacritics are stripped by parseUnit, e.g. "kWh/år"
  "ar": {
    definition: '1 year',
    prefixes: 'none',
  },
  "kvadratkilometer": {
    definition: '1 km2',
    prefixes: 'none',
  },
  "kvadratmeter": {
    definition: '1 m2',
    prefixes: 'none',
  },
  "hektar": {
    definition: '1 hectare',
    prefixes: 'none',
  },
  "kubikmeter": {
    definition: '1 m3',
    prefixes: 'none',
  },
  "wattimme": {
    definition: '1 Wh',
    prefixes: 'long', // kilowattimme, megawattimmar, gigawattimmar
    aliases: ['wattimmar'],
  },
  // mathjs has no percent unit of its own; a dimensionless hundredth
  "procent": {
    definition: '0.01',
    prefixes: 'none',
    aliases: ['percent'],
  },
};

mathjs.createUnit(customUnits);

// mathjs ships "ton" as the US short ton (907 kg). In Swedish data "ton" is
// always the metric tonne, so redefine it; "kton"/"Mton" follow from the prefixes.
mathjs.createUnit("ton", { definition: "1 tonne", prefixes: "short" }, { override: true });

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

  /**
   * A straight line through `start` in `startYear` and `target` in `endYear`,
   * one value per entry of `years` (the evaluator's `year` axis): NaN before
   * the start year (those years are left out of the result), and the same
   * slope continued past the end year. `start` keeps its unit; a bare number
   * as `target` is read in that unit, so "reach 50" over a series in MW means
   * 50 MW.
   */
  reachBy(years: unknown, start: unknown, target: unknown, startYear: unknown, endYear: unknown): unknown {
    const axis: unknown = mathjs.isMatrix(years) ? years.toArray() : years;
    if (!Array.isArray(axis) || !axis.every(year => typeof year === "number")) {
      throw new Error("reachBy expects the year axis as its first argument.");
    }
    const toNumber = (value: unknown, what: string): number => {
      if (mathjs.isUnit(value)) return value.toNumber();
      if (typeof value === "number") return value;
      throw new Error(`reachBy expects a number for ${what}.`);
    };
    const from = toNumber(startYear, "the start year");
    const to = toNumber(endYear, "the end year");
    if (to <= from) throw new Error("reachBy expects the end year to come after the start year.");

    // Arithmetic on plain numbers in the start's unit: mathjs turns a unitless
    // Unit times a number into a bare number, which the vector must not hold
    const startUnit = mathjs.isUnit(start) ? start : mathjs.unit(toNumber(start, "the start value"));
    const unit = startUnit.units.length > 0 ? startUnit.formatUnits() : null;
    const startValue = startUnit.toNumber();
    const targetValue = mathjs.isUnit(target) && target.units.length > 0 && unit
      ? target.toNumber(unit)
      : toNumber(target, "the target value");
    const withUnit = (value: number) => unit ? mathjs.unit(value, unit) : mathjs.unit(value);

    return axis.map(year => {
      if (year < from) return withUnit(NaN);
      const fraction = (year - from) / (to - from);
      return withUnit(startValue + (targetValue - startValue) * fraction);
    });
  },
};

mathjs.import(customFunctions);

export default mathjs;

export const allOurUnits: string[] = [
  ...Object.keys(MathJSUnit.UNITS),
  ...Object.keys(customUnits),
  // Aliases too, so the autocomplete offers e.g. "capita" and "pkm", not only "person" and "personkm"
  ...Object.values(customUnits).flatMap(unit => unit.aliases ?? []),
];