/**
 * Number formatting for the graphs: a rough, locale-aware format for values
 * (the numbers we plot are estimates), and a y-axis tick variant that keeps
 * adjacent ticks apart on narrow ranges.
 */

/**
 * A somewhat inaccurate formatter for numbers in the graph, since the numbers
 * we work with should be rough estimates rather than exact values.
 */
export function graphNumberFormatter(value: number) {
  if (value < 100) {
    return value?.toLocaleString('sv-SE', { maximumSignificantDigits: 3 });
  } else {
    return value?.toLocaleString('sv-SE', { maximumFractionDigits: 0 });
  }
}

const MaxTickFractionDigits = 10;

/** The fraction digits that write `step` exactly, if at most {@link MaxTickFractionDigits} do */
function exactFractionDigits(step: number): number | undefined {
  for (let digits = 0; digits <= MaxTickFractionDigits; digits++) {
    const scaled = step * 10 ** digits;
    if (Math.abs(scaled - Math.round(scaled)) < 1e-6) return digits;
  }
  return undefined;
}

/**
 * How many fraction digits the labels of a y axis need so that adjacent ticks
 * read differently, or `undefined` when {@link graphNumberFormatter} already
 * tells every tick apart (the ordinary case, which keeps its format).
 *
 * The rough formatter rounds to 3 significant digits, so a narrow axis such as
 * 1.199–1.201 labels every tick "1,2"; ApexCharts then blanks the duplicates.
 * The digits follow the tick step: enough to write the step exactly when it is
 * a short decimal (0.0005 → 4), otherwise two significant digits of the step.
 */
export function tickFractionDigits(ticks: Iterable<number>): number | undefined {
  const sorted = Array.from(ticks).filter((tick) => Number.isFinite(tick)).sort((a, b) => a - b);
  if (sorted.length < 2) return undefined;

  const labels = new Set(sorted.map(graphNumberFormatter));
  if (labels.size === sorted.length) return undefined;

  let step = Infinity;
  for (let i = 1; i < sorted.length; i++) {
    const difference = sorted[i] - sorted[i - 1];
    if (difference > 0 && difference < step) step = difference;
  }
  if (!Number.isFinite(step)) return undefined; // every tick the same; nothing can tell them apart

  const digits = exactFractionDigits(step) ?? Math.ceil(-Math.log10(step)) + 1;
  return Math.min(Math.max(digits, 0), MaxTickFractionDigits);
}

/** Format one tick of an axis with the given ticks; see {@link tickFractionDigits} */
export function formatTick(value: number, ticks: Iterable<number>): string {
  const digits = tickFractionDigits(ticks);
  if (digits === undefined) return graphNumberFormatter(value);
  return value.toLocaleString('sv-SE', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** The parts of ApexCharts' chart context the tick formatter reads */
type ApexScale = { result?: number[] };
type ApexScaleContext = { globals?: { yAxisScale?: Array<ApexScale | undefined> } };

/**
 * `yaxis.labels.formatter` for ApexCharts: ticks are formatted with
 * {@link formatTick} against the axis' own tick values, which Apex has already
 * decided (`w.globals.yAxisScale`), and everything else Apex routes through the
 * axis formatter (tooltips, data labels) with {@link graphNumberFormatter}.
 *
 * Apex calls the axis formatter with `(value, tickIndex, w)` when drawing the
 * labels and with `(value, { seriesIndex: axisIndex, dataPointIndex: -1, w })`
 * when measuring their width; tooltips pass a real data point index.
 */
export function graphTickFormatter(value: number, context?: unknown, w?: unknown): string {
  const ticks = axisTicks(value, context, w);
  return ticks ? formatTick(value, ticks) : graphNumberFormatter(value);
}

function axisTicks(value: number, context: unknown, w: unknown): number[] | undefined {
  if (typeof context === "number") {
    const scales = scalesOf(w);
    if (!scales) return undefined;
    return (
      scales.find((scale) => scale?.result?.[context] === value)?.result
      ?? scales.find((scale) => scale?.result?.includes(value))?.result
    );
  }

  if (typeof context === "object" && context !== null) {
    const { seriesIndex, dataPointIndex, w: contextW } = context as { seriesIndex?: unknown; dataPointIndex?: unknown; w?: unknown };
    if (dataPointIndex !== -1 || typeof seriesIndex !== "number") return undefined;
    const result = scalesOf(contextW)?.[seriesIndex]?.result;
    return result?.includes(value) ? result : undefined;
  }

  return undefined;
}

function scalesOf(w: unknown): Array<ApexScale | undefined> | undefined {
  const scales = (w as ApexScaleContext | undefined)?.globals?.yAxisScale;
  return Array.isArray(scales) ? scales : undefined;
}
