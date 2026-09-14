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

/** A unit's or number's value; NaN for anything else. */
function toNumber(value: unknown): number {
  if (mathjs.isUnit(value)) return value.toNumber();
  return typeof value === "number" ? value : NaN;
}

/** The evaluator's `year` axis as passed to a function's first argument. */
function toYearAxis(years: unknown, functionName: string): number[] {
  const axis: unknown = mathjs.isMatrix(years) ? years.toArray() : years;
  if (!Array.isArray(axis) || !axis.every(year => typeof year === "number")) {
    throw new Error(`${functionName} expects the year axis as its first argument.`);
  }
  return axis;
}

/**
 * Custom functions available in recipe equations through the mathjs parser.
 */
const customFunctions = {
  /**
   * First element of a vector whose value is non-zero, falling back to the
   * first element when every value is zero. Mathjs has no built-in for this;
   * used by derived-baseline recipe equations (`firstNonZero(${...})`). NaN
   * entries are years the series has no value for and are skipped.
   */
  firstNonZero(input: unknown): unknown {
    const values: unknown = mathjs.isMatrix(input) ? input.toArray() : input;
    if (!Array.isArray(values) || values.length === 0) {
      throw new Error("firstNonZero expects a non-empty vector.");
    }
    const flat = (values.flat(Infinity) as unknown[]).filter(value => !Number.isNaN(toNumber(value)));
    const found = flat.find(value => toNumber(value) !== 0);
    return found ?? flat[0];
  },

  /**
   * The straight line fitted (least squares) through a series' known years,
   * one value per entry of `years` (the evaluator's `year` axis): NaN before
   * the first known year and, when `untilYear` is given, after it; the line
   * continues over any gaps and past the last known year up to the axis end
   * otherwise. Needs the whole series (not a picked value) with at least two
   * known values. Keeps the series' unit.
   */
  trend(years: unknown, series: unknown, untilYear?: unknown): unknown {
    const axis = toYearAxis(years, "trend");
    const raw: unknown = mathjs.isMatrix(series) ? series.toArray() : series;
    if (!Array.isArray(raw) || raw.length !== axis.length) {
      throw new Error("trend expects the whole series as its second argument.");
    }
    const values: unknown[] = raw;
    const until = untilYear === undefined ? Infinity : toNumber(untilYear);
    if (Number.isNaN(until)) throw new Error("trend expects a number for the end year.");

    const points = axis.flatMap((year, i) => {
      const value = toNumber(values[i]);
      return Number.isNaN(value) ? [] : [{ year, value }];
    });
    if (points.length < 2) throw new Error("trend needs at least two known values to fit a line.");

    const meanYear = points.reduce((sum, p) => sum + p.year, 0) / points.length;
    const meanValue = points.reduce((sum, p) => sum + p.value, 0) / points.length;
    const slope = points.reduce((sum, p) => sum + (p.year - meanYear) * (p.value - meanValue), 0)
      / points.reduce((sum, p) => sum + (p.year - meanYear) ** 2, 0);
    const firstYear = points[0].year;

    const sample = values[axis.indexOf(firstYear)];
    const unit = mathjs.isUnit(sample) && sample.units.length > 0 ? sample.formatUnits() : null;
    const withUnit = (value: number) => unit ? mathjs.unit(value, unit) : mathjs.unit(value);

    return axis.map(year => year < firstYear || year > until
      ? withUnit(NaN)
      : withUnit(meanValue + slope * (year - meanYear)),
    );
  },

  /**
   * A straight line through `start` in `startYear` and `target` in `endYear`,
   * one value per entry of `years` (the evaluator's `year` axis): NaN before
   * the start year (those years are left out of the result), and the same
   * slope continued past the end year. `start` keeps its unit; a bare number
   * as `target` is read in that unit, so "reach 50" over a series in MW means
   * 50 MW.
   */
  /**
   * The series carried across the `years` axis: years before the first known
   * value take that value, every later unknown year (a gap, or the years after
   * the last value) takes the previous known one. Lets a statistic that ends
   * in 2024, or has a secrecy-suppressed year, serve as a per-year factor over
   * a goal's whole horizon. Keeps the series' unit.
   */
  extend(years: unknown, series: unknown): unknown {
    const axis = toYearAxis(years, "extend");
    const raw: unknown = mathjs.isMatrix(series) ? series.toArray() : series;
    if (!Array.isArray(raw) || raw.length !== axis.length) {
      throw new Error("extend expects the whole series as its second argument.");
    }
    const values: unknown[] = raw;
    const known = values.map((value, i) => ({ i, value: toNumber(value) })).filter(entry => !Number.isNaN(entry.value));
    if (known.length === 0) return values;

    const sample = values[known[0].i];
    const unit = mathjs.isUnit(sample) && sample.units.length > 0 ? sample.formatUnits() : null;
    const withUnit = (value: number) => unit ? mathjs.unit(value, unit) : mathjs.unit(value);
    let carried = known[0].value;
    return values.map(value => {
      const number = toNumber(value);
      if (!Number.isNaN(number)) { carried = number; return value; }
      return withUnit(carried);
    });
  },

  reachBy(years: unknown, start: unknown, target: unknown, startYear: unknown, endYear: unknown): unknown {
    const axis = toYearAxis(years, "reachBy");
    const numberFor = (value: unknown, what: string): number => {
      const number = toNumber(value);
      if (Number.isNaN(number)) throw new Error(`reachBy expects a number for ${what}.`);
      return number;
    };
    const from = numberFor(startYear, "the start year");
    const to = numberFor(endYear, "the end year");
    if (to <= from) throw new Error("reachBy expects the end year to come after the start year.");

    // Arithmetic on plain numbers in the start's unit: mathjs turns a unitless
    // Unit times a number into a bare number, which the vector must not hold
    const startUnit = mathjs.isUnit(start) ? start : mathjs.unit(numberFor(start, "the start value"));
    const unit = startUnit.units.length > 0 ? startUnit.formatUnits() : null;
    const startValue = startUnit.toNumber();
    const targetValue = mathjs.isUnit(target) && target.units.length > 0 && unit
      ? target.toNumber(unit)
      : numberFor(target, "the target value");
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