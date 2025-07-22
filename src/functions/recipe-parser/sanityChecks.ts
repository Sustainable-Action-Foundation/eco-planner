import { isNull } from "mathjs";
import type { EvalTimeDataSeries, EvalTimeScalar } from "./types";

export function sketchyScalars(scalars: EvalTimeScalar[], warnings: string[]) {
  const hugeScalar = scalars.filter(variable => Math.abs(variable.value) > 1e12);
  if (hugeScalar.length > 0) {
    warnings.push(`Recipe contains huge scalar values: ${hugeScalar.map(s => s.name).join(", ")}, which may lead to performance issues or overflow errors.`);
  }

  const nearZeroScalar = scalars.filter(variable => Math.abs(variable.value) < 1e-12 && variable.value !== 0);
  if (nearZeroScalar.length > 0) {
    warnings.push(`Recipe contains scalar values close to zero: ${nearZeroScalar.map(s => s.name).join(", ")}, which may lead to precision issues during evaluation.`);
  }

  const negativeScalar = scalars.filter(variable => variable.value < 0);
  if (negativeScalar.length > 0) {
    warnings.push(`Recipe contains negative scalar values: ${negativeScalar.map(s => s.name).join(", ")}, which may lead to unexpected results in calculations.`);
  }

  const divideByZero = scalars.filter(variable => variable.value === 0);
  if (divideByZero.length > 0) {
    warnings.push(`Recipe contains scalar values that are zero: ${divideByZero.map(s => s.name).join(", ")}, which may lead to division by zero errors during evaluation or zeroing of other values in multiplication.`);
  }
}

export function sketchyDataSeries(dataSeries: EvalTimeDataSeries[], warnings: string[]) {
  const hugeValuesInDataSeries = dataSeries.filter(variable =>
    Object.values(variable.data).some(v => !isNull(v) && v !== null && Math.abs(v) > 1e12)
  );
  if (hugeValuesInDataSeries.length > 0) {
    warnings.push(`Recipe contains huge data series values, which may lead to performance issues or overflow errors. Found in: ${hugeValuesInDataSeries.map(ds => ds.name).join(", ")}`);
  }

  const longDataSeries = dataSeries.filter(variable => Object.keys(variable.data).length > 50);
  if (longDataSeries.length > 0) {
    warnings.push(`Recipe contains very long data series: ${longDataSeries.map(ds => ds.name).join(", ")}, which may lead to performance issues or unexpected results in calculations.`);
  }

  const shortDataSeries = dataSeries.filter(variable => Object.keys(variable.data).length < 2);
  if (shortDataSeries.length > 0) {
    warnings.push(`Recipe contains very short data series: ${shortDataSeries.map(ds => ds.name).join(", ")}, which may lead to unexpected results in calculations.`);
  }
}
