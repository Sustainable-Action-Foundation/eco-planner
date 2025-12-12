import { isNull, Unit } from "mathjs";
import type { EvalTimeVariable } from "./types";
import mathjs from "@/math";

export function sanityCheckScalars(scalars: EvalTimeVariable[], warnings: string[]) {
  // Are actually scalars, not vectors
  const nonScalar = scalars.filter(variable => !mathjs.isUnit(variable));
  if (nonScalar.length > 0) {
    warnings.push(`Recipe contains non-scalar variables where scalars are expected: ${nonScalar.map(s => s.name).join(", ")}.`);
  }
  const cleanScalars = scalars
    .filter(variable => mathjs.isUnit(variable))
    .map(variable => ({
      name: variable.name,
      value: (variable.value as Unit).toNumber(),
    })) as { name: string; value: number }[];

  const hugeScalar = cleanScalars.filter(variable => Math.abs(variable.value) > 1e12 && Number.isFinite(variable.value));
  if (hugeScalar.length > 0) {
    warnings.push(`Recipe contains huge scalar values: ${hugeScalar.map(s => s.name).join(", ")}, which may lead to performance issues or overflow errors.`);
  }

  const nearZeroScalar = cleanScalars.filter(variable => Math.abs(variable.value) < 1e-12 && variable.value !== 0);
  if (nearZeroScalar.length > 0) {
    warnings.push(`Recipe contains scalar values close to zero: ${nearZeroScalar.map(s => s.name).join(", ")}, which may lead to precision issues during evaluation.`);
  }

  const negativeScalar = cleanScalars.filter(variable => variable.value < 0);
  if (negativeScalar.length > 0) {
    warnings.push(`Recipe contains negative scalar values: ${negativeScalar.map(s => s.name).join(", ")}, which may lead to unexpected results in calculations.`);
  }

  const divideByZero = cleanScalars.filter(variable => variable.value === 0);
  if (divideByZero.length > 0) {
    warnings.push(`Recipe contains scalar values that are zero: ${divideByZero.map(s => s.name).join(", ")}, which may lead to division by zero errors during evaluation or zeroing of other values in multiplication.`);
  }
}

export function sanityCheckDataSeries(dataSeries: EvalTimeVariable[], warnings: string[]) {
  const nonDataSeries = dataSeries.filter(variable => !Array.isArray(variable.value));
  if (nonDataSeries.length > 0) {
    warnings.push(`Recipe contains non-data series variables where data series are expected: ${nonDataSeries.map(ds => ds.name).join(", ")}.`);
  }

  const cleanDataSeries = dataSeries
    .filter(variable => Array.isArray(variable.value))
    .map(variable => ({
      name: variable.name,
      value: variable.value as Unit[],
    })) as { name: string; value: Unit[] }[];

  const hugeValuesInDataSeries = cleanDataSeries.filter(variable => {
    if (typeof variable.value === "number") {
      return Math.abs(variable.value) > 1e12;
    } else if (Array.isArray(variable.value)) {
      return variable.value?.some(v => !isNull(v) && v !== null && Math.abs(Number(v)) > 1e12 && Number.isFinite(Number(v)));
    } else {
      return false;
    }
  });
  if (hugeValuesInDataSeries.length > 0) {
    warnings.push(`Recipe contains data series with huge values: ${hugeValuesInDataSeries.map(ds => ds.name).join(", ")}, which may lead to performance issues or overflow errors.`);
  }

  const longDataSeries = cleanDataSeries.filter(variable => Array.isArray(variable.value) && variable.value.length > 50);
  if (longDataSeries.length > 0) {
    warnings.push(`Recipe contains very long data series: ${longDataSeries.map(ds => ds.name).join(", ")}, which may lead to performance issues or unexpected results in calculations.`);
  }

  const shortDataSeries = cleanDataSeries.filter(variable => Array.isArray(variable.value) && variable.value.length < 2);
  if (shortDataSeries.length > 0) {
    warnings.push(`Recipe contains very short data series: ${shortDataSeries.map(ds => ds.name).join(", ")}, which may lead to unexpected results in calculations.`);
  }
}
