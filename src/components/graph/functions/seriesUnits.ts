// No "use client" or `server-only` marker: pure, shared by the interactive graphs and the static one.
import { isMathjsUnit } from "@/functions/recipe/vectorAndMaskUtils";
import mathjs from "@/math";
import type { Unit } from "@/types";

/**
 * How two series' units relate when drawn on one axis: `convertible` when
 * both are real units of the same quantity (or equal), `same` when neither
 * is a real unit, and `mismatch` when they can't be reconciled (different
 * quantities, or a real unit against a unitless/missing one).
 */
export function unitRelation(a: Unit, b: Unit): "convertible" | "same" | "mismatch" {
  const aReal = isMathjsUnit(a);
  const bReal = isMathjsUnit(b);
  if (aReal && bReal) {
    if (a === b) return "convertible";
    try { return mathjs.unit(1, a).equalBase(mathjs.unit(1, b)) ? "convertible" : "mismatch"; }
    catch { return "mismatch"; }
  }
  if (!aReal && !bReal) return "same";
  return "mismatch";
}

/**
 * Converts values in `sourceUnit` to `targetUnit` when both are real, compatible and
 * different units (e.g. MW → GW); the identity otherwise, which leaves the values as they are.
 */
export function unitConverter(sourceUnit: Unit, targetUnit: Unit | undefined): (value: number) => number {
  return targetUnit !== undefined && unitRelation(sourceUnit, targetUnit) === "convertible" && sourceUnit !== targetUnit
    ? (value: number) => mathjs.unit(value, sourceUnit).toNumber(targetUnit)
    : (value: number) => value;
}
