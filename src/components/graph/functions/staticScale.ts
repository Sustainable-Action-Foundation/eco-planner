// No "use client" or `server-only` marker: pure, and unit tested.

/** An axis from `min` to `max` with evenly spaced round ticks, both ends included */
export type AxisScale = { min: number, max: number, ticks: number[] };

/**
 * A y axis with round tick values that holds every value. A flat series (every value the
 * same) gets zero as its other end, so the value shows at its size instead of on a
 * made-up band around it (the reasoning of `yAxisBounds`, which does this for ApexCharts).
 * @param targetTicks Roughly how many intervals to aim for
 */
export function niceScale(values: Iterable<number>, targetTicks = 4): AxisScale {
  let lowest = Infinity;
  let highest = -Infinity;
  for (const value of values) {
    if (!Number.isFinite(value)) continue;
    if (value < lowest) lowest = value;
    if (value > highest) highest = value;
  }
  if (lowest === Infinity) return { min: 0, max: 1, ticks: [0, 1] };

  // Flat down to floating point noise
  if (highest - lowest <= Math.max(Math.abs(lowest), Math.abs(highest)) * 1e-9) {
    if (lowest > 0) lowest = 0;
    else if (highest < 0) highest = 0;
    else highest = 1;
  }

  const rawStep = (highest - lowest) / Math.max(1, targetTicks);
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  const step = (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10) * magnitude;

  const first = Math.floor(lowest / step + 1e-9);
  const last = Math.ceil(highest / step - 1e-9);
  // Multiply rather than add up, and round away the floating point tail (0.1 * 3)
  const decimals = Math.max(0, -Math.floor(Math.log10(step)) + 1);
  const ticks: number[] = [];
  for (let index = first; index <= last; index++) ticks.push(Number((index * step).toFixed(Math.min(decimals, 20))));

  return { min: ticks[0], max: ticks[ticks.length - 1], ticks };
}

/**
 * The years to label on an x axis from `first` to `last`: every year while they are few,
 * otherwise the round ones (every 2nd, 5th, 10th, ...) so at most `limit` labels are drawn.
 */
export function yearTicks(first: number, last: number, limit = 7): number[] {
  if (!Number.isFinite(first) || !Number.isFinite(last) || last < first) return [];
  for (const step of [1, 2, 5, 10, 20, 25, 50, 100, 200, 500, 1000]) {
    const ticks: number[] = [];
    for (let year = Math.ceil(first / step) * step; year <= last; year += step) ticks.push(year);
    if (ticks.length <= limit) return ticks.length > 0 ? ticks : [first];
  }
  return [first, last];
}
