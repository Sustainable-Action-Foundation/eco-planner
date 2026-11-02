/**
 * Which end of a y axis to pin at zero, if any, so the plotted values keep a
 * visible reference. ApexCharts scales the axis to the data by itself, but a
 * flat series (every value the same, e.g. the annual change of a linear goal)
 * makes it draw a ±1 band around the value: a steady change of 200 000 a year
 * becomes a line through the middle of a 199 999–200 001 axis, and a change
 * of 0.03 TWh a year hides on a −1–1 axis that looks like the goal's own.
 * Pinning the zero end and leaving the other end to Apex's nice scaling shows
 * the value at its actual size instead.
 *
 * With `anchorZero` the zero end is pinned whenever the values lie on one side
 * of zero, flat or not; the annual change asks for that since zero (no change)
 * is its reference. Values on both sides of zero already include it.
 */
export function yAxisBounds(
  values: Iterable<number>,
  { anchorZero = false }: { anchorZero?: boolean } = {},
): { min?: number; max?: number } {
  let lowest = Infinity;
  let highest = -Infinity;
  for (const value of values) {
    if (!Number.isFinite(value)) continue;
    if (value < lowest) lowest = value;
    if (value > highest) highest = value;
  }
  if (lowest === Infinity) return {};

  // Flat down to floating point noise (a linear series' differences rarely come out identical)
  const flat = highest - lowest <= Math.max(Math.abs(lowest), Math.abs(highest)) * 1e-9;
  if (!anchorZero && !flat) return {};

  if (lowest > 0) return { min: 0 };
  if (highest < 0) return { max: 0 };
  return {};
}
