import type { EvalTimeVariable, RecipeExtractionOutput } from "./types";
import { isEvalTimeVariable } from "./types/typeguards";
import mathjs from "@/math";

const HUGE_THRESHOLD = 1e12;
const NEAR_ZERO_THRESHOLD = 1e-12;
const LONG_SERIES_THRESHOLD = 50;

type SeriesVariable = Extract<RecipeExtractionOutput[number], { series: unknown }>;
type NumericScalar = Pick<EvalTimeVariable, "displayName"> & { value: number };
type NumericSeries = Pick<EvalTimeVariable, "displayName"> & { values: number[] };

function isSeriesVariable(variable: RecipeExtractionOutput[number]): variable is SeriesVariable {
  return "series" in variable;
}

function toNumber(value: EvalTimeVariable["value"]): number | null {
  if (Array.isArray(value)) return null;
  if (typeof value === "number") return value;

  try {
    return value.toNumber();
  }
  catch {
    return null;
  }
}

function isNumericScalar(variable: Pick<EvalTimeVariable, "displayName"> & { value: number | null }): variable is NumericScalar {
  return variable.value !== null;
}

function warnForNumericScalars(prefix: string, scalars: NumericScalar[], warnings: string[]) {
  if (scalars.length === 0) return;

  const huge = scalars.filter(variable => Math.abs(variable.value) > HUGE_THRESHOLD && Number.isFinite(variable.value));
  if (huge.length > 0) {
    warnings.push(`${prefix} contains huge scalar values: ${huge.map(s => s.displayName).join(", ")}, which may lead to performance issues or overflow errors.`);
  }

  const nearZero = scalars.filter(variable => Math.abs(variable.value) < NEAR_ZERO_THRESHOLD && variable.value !== 0);
  if (nearZero.length > 0) {
    warnings.push(`${prefix} contains scalar values close to zero: ${nearZero.map(s => s.displayName).join(", ")}, which may lead to precision issues during evaluation.`);
  }

  const negative = scalars.filter(variable => variable.value < 0);
  if (negative.length > 0) {
    warnings.push(`${prefix} contains negative scalar values: ${negative.map(s => s.displayName).join(", ")}, which may lead to unexpected results in calculations.`);
  }

  const zero = scalars.filter(variable => variable.value === 0);
  if (zero.length > 0) {
    warnings.push(`${prefix} contains scalar values that are zero: ${zero.map(s => s.displayName).join(", ")}, which may lead to division by zero errors during evaluation or zeroing of other values in multiplication.`);
  }
}

function warnForSeries(prefix: string, series: NumericSeries[], warnings: string[]) {
  if (series.length === 0) return;

  const hugeValues = series.filter(variable =>
    variable.values.some(v => Number.isFinite(v) && Math.abs(v) > HUGE_THRESHOLD)
  );
  if (hugeValues.length > 0) {
    warnings.push(`${prefix} contains data series with huge values: ${hugeValues.map(ds => ds.displayName).join(", ")}, which may lead to performance issues or overflow errors.`);
  }

  const longSeries = series.filter(variable => variable.values.length > LONG_SERIES_THRESHOLD);
  if (longSeries.length > 0) {
    warnings.push(`${prefix} contains very long data series: ${longSeries.map(ds => ds.displayName).join(", ")}, which may lead to performance issues or unexpected results in calculations.`);
  }

  const shortSeries = series.filter(variable => variable.values.length < 2);
  if (shortSeries.length > 0) {
    warnings.push(`${prefix} contains very short data series: ${shortSeries.map(ds => ds.displayName).join(", ")}, which may lead to unexpected results in calculations.`);
  }
}

export function sanityCheckScalars(allVariables: EvalTimeVariable[], warnings: string[]) {
  const cleanScalars = allVariables
    .filter(variable => !Array.isArray(variable.value) && (typeof variable.value === "number" || mathjs.typeOf(variable.value) === "Unit"))
    .map(variable => ({
      displayName: variable.displayName,
      value: toNumber(variable.value),
    }))
    .filter(isNumericScalar);

  if (cleanScalars.length === 0) return;

  warnForNumericScalars("Recipe", cleanScalars, warnings);
}

export function sanityCheckDataSeries(variables: RecipeExtractionOutput, warnings: string[]) {
  const scalarValues = variables
    .filter(v => isEvalTimeVariable(v, { silent: true }))
    .map(variable => ({
      displayName: variable.displayName,
      value: toNumber(variable.value),
    }))
    .filter(isNumericScalar);

  warnForNumericScalars("Data series extraction", scalarValues, warnings);

  const cleanDataSeries = variables
    .filter(isSeriesVariable)
    .map(variable => ({
      displayName: variable.displayName,
      values: Object.values(variable.series.dateValues)
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value)),
    }));

  warnForSeries("Data series extraction", cleanDataSeries, warnings);
}

export function sanityCheckExternalDatasets(variables: RecipeExtractionOutput, warnings: string[]) {
  const scalarValues = variables
    .filter((variable): variable is EvalTimeVariable => isEvalTimeVariable(variable, { silent: true }))
    .map(variable => ({
      displayName: variable.displayName,
      value: toNumber(variable.value),
    }))
    .filter(isNumericScalar);

  warnForNumericScalars("External dataset extraction", scalarValues, warnings);

  const cleanDataSeries = variables
    .filter(isSeriesVariable)
    .map(variable => ({
      displayName: variable.displayName,
      values: Object.values(variable.series.dateValues)
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value)),
    }));

  warnForSeries("External dataset extraction", cleanDataSeries, warnings);
}
