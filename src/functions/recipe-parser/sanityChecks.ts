import { isNull, Unit } from "mathjs";
import type { EvalTimeVariable } from "./types";
import mathjs from "@/math";

export function sanityCheckScalars(allVariables: EvalTimeVariable[], warnings: string[]) {
  const cleanScalars = allVariables
    .filter(variable => mathjs.isUnit(variable) || typeof variable.value === "number")
    .map(variable => ({
      name: variable.name,
      value: typeof variable.value === "number"
        ? variable.value
        : (variable.value as Unit).toNumber(),
    })) as { name: string; value: number }[];

  if (cleanScalars.length === 0) return;

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

export function sanityCheckDataSeries(allVariables: EvalTimeVariable[], warnings: string[]) {
  const cleanDataSeries = allVariables
    .filter(variable => Array.isArray(variable.value))
    .map(v => v as Omit<EvalTimeVariable, "value"> & { value: Unit[] | number[] }) // TODO better type checking
    .map(variable => ({
      name: variable.name,
      value: variable.value
        .map(v => typeof v === "number" ? v : v.toNumber()),
    }));

  if (cleanDataSeries.length === 0) return;

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
