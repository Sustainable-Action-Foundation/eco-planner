"use client";

import WrappedChart, { graphNumberFormatter } from "@/lib/chartWrapper";
import { isISOIshDate } from "@/types/typeguards";
import type { DateValues } from "@/types";
import type { ApexOptions, ApexYAxis } from "apexcharts";

export type CuratedGraphSeries = { name: string, dateValues: DateValues, /** Drawn dashed, e.g. a projection */ dashed?: boolean };

export default function CuratedHistoricalGraph({
  series,
  unit,
  secondary,
  height,
}: {
  series: CuratedGraphSeries[],
  unit: string | null,
  /** Series in another unit (or magnitude), drawn against a second y axis on the right */
  secondary?: { series: CuratedGraphSeries[], unit: string | null },
  /** Overrides the card-sized default */
  height?: number,
}) {
  const allSeries = [...series, ...(secondary?.series ?? [])];
  const chartSeries = allSeries.map(({ name, dateValues }) => ({
    name,
    data: Object.entries(dateValues)
      .filter(([key]) => isISOIshDate(key))
      .map(([key, value]) => ({ x: new Date(key).getTime(), y: value }))
      .sort((a, b) => a.x - b.x),
  }));

  const longestSeries = Math.max(1, ...chartSeries.map(series => series.data.length));
  const isMultiSeries = chartSeries.length > 1;

  // An explicit `title: undefined` key breaks ApexCharts' option merging (the
  // chart silently renders empty), so only add the key when set
  const axis = (unit: string | null, names: string[], opposite: boolean): ApexYAxis => ({
    seriesName: names,
    opposite,
    labels: { formatter: graphNumberFormatter },
    ...(unit ? { title: { text: unit } } : {}),
  });

  const chartOptions: ApexOptions = {
    chart: {
      animations: { enabled: false },
      type: "line",
      zoom: { enabled: false },
      toolbar: { show: false },
    },
    stroke: { width: 2, dashArray: allSeries.map(series => series.dashed ? 5 : 0) },
    legend: {
      show: isMultiSeries,
      position: "bottom",
    },
    xaxis: {
      type: 'datetime',
      labels: { format: 'yyyy' },
      tooltip: { enabled: false },
      // Cap ticks at the data points so short series don't repeat the same
      // year label across sub-year ticks
      tickAmount: Math.max(1, Math.min(longestSeries - 1, 8)),
    },
    yaxis: secondary
      ? [
        axis(unit, series.map(series => series.name), false),
        axis(secondary.unit, secondary.series.map(series => series.name), true),
      ]
      : axis(unit, series.map(series => series.name), false),
    tooltip: {
      shared: isMultiSeries,
      x: { format: 'yyyy' },
    },
  };

  // Multi-series charts need room for the legend below the plot
  return (
    <WrappedChart options={chartOptions} series={chartSeries} type="line" height={height ?? (isMultiSeries ? 260 : 200)} />
  );
}
