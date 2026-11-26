import { formatTick } from "@/components/graph/functions/tickLabels";
import { niceScale, yearTicks } from "@/components/graph/functions/staticScale";
import { color_palette } from "@/components/graph/config";

/** Which of a goal's series a line is; decides its colour and stroke */
export const StaticSeriesKind = {
  Main: "MAIN",
  Baseline: "BASELINE",
  Historical: "HISTORICAL",
  PredictedOutcome: "PREDICTED_OUTCOME",
} as const;
export type StaticSeriesKind = (typeof StaticSeriesKind)[keyof typeof StaticSeriesKind];

export type StaticSeries = {
  kind: StaticSeriesKind,
  /** The legend entry */
  name: string,
  /** `[year, value]` pairs */
  points: [year: number, value: number][],
};

/**
 * The goal graphs' colours, plus a stroke pattern per series so the lines can still be
 * told apart on a black-and-white printout.
 */
const seriesStyles: Record<StaticSeriesKind, { color: string, dash?: string, width: number, area?: number }> = {
  [StaticSeriesKind.Main]: { color: color_palette.main.color, width: 2 },
  [StaticSeriesKind.Baseline]: { color: color_palette.baseline.color, width: 1.5, dash: "6 3" },
  [StaticSeriesKind.Historical]: { color: color_palette.historical.color, width: 1.5, area: color_palette.historical.fillOpacity },
  [StaticSeriesKind.PredictedOutcome]: { color: color_palette.predictedOutcome.color, width: 1.5, dash: "2 2.5" },
};

/** Drawn back to front: the goal's own line ends up on top */
const drawOrder: StaticSeriesKind[] = [StaticSeriesKind.Historical, StaticSeriesKind.Baseline, StaticSeriesKind.PredictedOutcome, StaticSeriesKind.Main];

const viewWidth = 400;
const viewHeight = 150;
const plot = { left: 46, right: 386, top: 16, bottom: 132 };

/**
 * A goal's series as a plain SVG line chart, drawn on the server: nothing to hydrate and
 * nothing to wait for, which is what a document that prints hundreds of goals needs
 * (the interactive graphs mount a chart instance each). Same series, colours and number
 * format as the goal page's main graph; no interaction. Renders nothing without values.
 * No hooks, so it works in server and client components alike.
 */
export default function StaticGoalGraph({ series, unitLabel, label, className }: {
  series: StaticSeries[],
  /** Printed above the y axis */
  unitLabel: string,
  /** What the graph shows, for assistive technology */
  label: string,
  className?: string,
}) {
  const drawn = drawOrder
    .flatMap(kind => series.filter(candidate => candidate.kind === kind))
    .map(candidate => ({
      ...candidate,
      points: candidate.points.filter(([year, value]) => Number.isFinite(year) && Number.isFinite(value)).sort((a, b) => a[0] - b[0]),
    }))
    .filter(candidate => candidate.points.length > 0);
  if (drawn.length === 0) return null;

  const years = drawn.flatMap(candidate => candidate.points.map(([year]) => year));
  const firstYear = Math.min(...years);
  const lastYear = Math.max(...years);
  const scale = niceScale(drawn.flatMap(candidate => candidate.points.map(([, value]) => value)));

  // A single year sits in the middle of the plot
  const x = (year: number) => lastYear === firstYear
    ? (plot.left + plot.right) / 2
    : plot.left + ((year - firstYear) / (lastYear - firstYear)) * (plot.right - plot.left);
  const y = (value: number) => plot.bottom - ((value - scale.min) / (scale.max - scale.min)) * (plot.bottom - plot.top);
  const round = (coordinate: number) => Math.round(coordinate * 10) / 10;

  return (
    <figure className={className} style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${viewWidth} ${viewHeight}`} width="100%" role="img" aria-label={label} style={{ display: 'block', fontSize: '9px' }}>
        <text x={plot.left} y={9} fill="#444">{unitLabel}</text>

        {scale.ticks.map(tick => (
          <g key={tick}>
            <line x1={plot.left} x2={plot.right} y1={round(y(tick))} y2={round(y(tick))} stroke={tick === 0 && scale.min < 0 ? "#888" : "#ddd"} strokeWidth={1} />
            <text x={plot.left - 4} y={round(y(tick)) + 3} textAnchor="end" fill="#444">{formatTick(tick, scale.ticks)}</text>
          </g>
        ))}
        <line x1={plot.left} x2={plot.right} y1={plot.bottom} y2={plot.bottom} stroke="#888" strokeWidth={1} />
        {yearTicks(firstYear, lastYear).map(year => (
          <g key={year}>
            <line x1={round(x(year))} x2={round(x(year))} y1={plot.bottom} y2={plot.bottom + 3} stroke="#888" strokeWidth={1} />
            <text x={round(x(year))} y={plot.bottom + 13} textAnchor="middle" fill="#444">{year}</text>
          </g>
        ))}

        {drawn.map(candidate => {
          const style = seriesStyles[candidate.kind];
          const line = candidate.points.map(([year, value], index) => `${index === 0 ? "M" : "L"}${round(x(year))} ${round(y(value))}`).join("");
          const first = candidate.points[0];
          const last = candidate.points[candidate.points.length - 1];
          return (
            <g key={candidate.kind} data-series={candidate.kind}>
              {style.area && candidate.points.length > 1 ?
                <path d={`${line}L${round(x(last[0]))} ${plot.bottom}L${round(x(first[0]))} ${plot.bottom}Z`} fill={style.color} fillOpacity={style.area} />
                : null}
              {candidate.points.length > 1
                ? <path d={line} fill="none" stroke={style.color} strokeWidth={style.width} strokeDasharray={style.dash} strokeLinejoin="round" />
                : <circle cx={round(x(first[0]))} cy={round(y(first[1]))} r={2.5} fill={style.color} />}
            </g>
          );
        })}
      </svg>

      <figcaption style={{ display: 'flex', flexWrap: 'wrap', gap: '0 .75rem', paddingLeft: `${(plot.left / viewWidth) * 100}%`, fontSize: '11px', lineHeight: 1.4 }}>
        {series.filter(candidate => drawn.some(line => line.kind === candidate.kind)).map(candidate => {
          const style = seriesStyles[candidate.kind];
          return (
            <span key={candidate.kind} style={{ display: 'inline-flex', alignItems: 'center', gap: '.25rem' }}>
              <svg viewBox="0 0 18 6" width={18} height={6} aria-hidden="true">
                <line x1={0} x2={18} y1={3} y2={3} stroke={style.color} strokeWidth={style.width} strokeDasharray={style.dash} />
              </svg>
              {candidate.name}
            </span>
          );
        })}
      </figcaption>
    </figure>
  );
}
