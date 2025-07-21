import { isNull } from "mathjs";
import { RecipeVariableDataSeries, RecipeVariableScalar, RecipeVariableVector } from "./types";

export function sketchyScalars(scalars: [string, RecipeVariableScalar][], warnings: string[]) {
  const hugeScalar = scalars.filter(([, variable]) => Math.abs(variable.value) > 1e12);
  if (hugeScalar.length > 0) {
    warnings.push(`Recipe contains huge scalar values: ${hugeScalar.map(s => s.at(0)).join(", ")}, which may lead to performance issues or overflow errors.`);
  }

  const nearZeroScalar = scalars.filter(([, variable]) => Math.abs(variable.value) < 1e-12 && variable.value !== 0);
  if (nearZeroScalar.length > 0) {
    warnings.push(`Recipe contains scalar values close to zero: ${nearZeroScalar.map(s => s.at(0)).join(", ")}, which may lead to precision issues during evaluation.`);
  }

  const negativeScalar = scalars.filter(([, variable]) => variable.value < 0);
  if (negativeScalar.length > 0) {
    warnings.push(`Recipe contains negative scalar values: ${negativeScalar.map(s => s.at(0)).join(", ")}, which may lead to unexpected results in calculations.`);
  }

  const divideByZero = scalars.filter(([, variable]) => variable.value === 0);
  if (divideByZero.length > 0) {
    warnings.push("Recipe contains scalar values that are zero, which may lead to division by zero errors during evaluation or zeroing of other values in multiplication.");
  }
}

export function sketchyVectors(vectors: [string, RecipeVariableVector][], warnings: string[]) {
  const hugeValuesInVector = vectors.filter(([, variable]) => variable.value.some((v: number | string | null | undefined) => (typeof v === "number" || typeof v === "string") && Math.abs(parseFloat(v.toString())) > 1e12));
  if (hugeValuesInVector.length > 0) {
    warnings.push(`Recipe contains huge vector values: ${hugeValuesInVector.map(v => v.at(0)).join(", ")}, which may lead to performance issues or overflow errors.`);
  }

  const longVector = vectors.filter(([, variable]) => variable.value.length > 50);
  if (longVector.length > 0) {
    warnings.push(`Recipe contains very long vectors: ${longVector.map(v => v.at(0)).join(", ")}, which may lead to performance issues or unexpected results in calculations.`);
  }

  const shortVector = vectors.filter(([, variable]) => variable.value.length < 2);
  if (shortVector.length > 0) {
    warnings.push(`Recipe contains very short vectors: ${shortVector.map(v => v.at(0)).join(", ")}, which may lead to unexpected results in calculations.`);
  }
}

export function sketchyUrls(urls: [string, unknown][], warnings:string[]) {
  // TODO - implement
}

export function sketchyDataSeries(dataSeries: [string, RecipeVariableDataSeries][], warnings: string[]) {
  const hugeValuesInDataSeries = dataSeries.filter(([, variable]) => Object.values(variable.value).some(v => !isNull(v) && v !== null && Math.abs(v) > 1e12));
  if (hugeValuesInDataSeries.length > 0) {
    warnings.push(`Recipe contains huge data series values: ${hugeValuesInDataSeries.map(ds => ds.at(0)).join(", ")}, which may lead to performance issues or overflow errors.`);
  }

  const longDataSeries = dataSeries.filter(([, variable]) => Object.keys(variable.value).length > 50);
  if (longDataSeries.length > 0) {
    warnings.push(`Recipe contains very long data series: ${longDataSeries.map(ds => ds.at(0)).join(", ")}, which may lead to performance issues or unexpected results in calculations.`);
  }

  const shortDataSeries = dataSeries.filter(([, variable]) => Object.keys(variable.value).length < 2);
  if (shortDataSeries.length > 0) {
    warnings.push(`Recipe contains very short data series: ${shortDataSeries.map(ds => ds.at(0)).join(", ")}, which may lead to unexpected results in calculations.`);
  }
}

export function sketchyExternalDatasets(externalDatasets: [string, unknown][], warnings: string[]) {
  // TODO - implement
}
