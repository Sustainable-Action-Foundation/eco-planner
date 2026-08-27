"use client";

import WrappedChart, { graphNumberFormatter } from "@/lib/chartWrapper";
import { isISOIshDate } from "@/types/typeguards";
import type { DateValues } from "@/types";
import type { ApexOptions } from "apexcharts";

export default function CuratedHistoricalGraph({
  series,
  unit,
}: {
  series: { name: string, dateValues: DateValues }[],
  unit: string | null,
}) {
  const chartSeries = series.map(({ name, dateValues }) => ({
    name,
    data: Object.entries(dateValues)
      .filter(([key]) => isISOIshDate(key))
      .map(([key, value]) => ({ x: new Date(key).getTime(), y: value }))
      .sort((a, b) => a.x - b.x),
  }));

  const longestSeries = Math.max(1, ...chartSeries.map(series => series.data.length));
  const isMultiSeries = chartSeries.length > 1;

  const chartOptions: ApexOptions = {
    chart: {
      animations: { enabled: false },
      type: "line",
      zoom: { enabled: false },
      toolbar: { show: false },
    },
    stroke: { width: 2 },
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
    yaxis: {
      labels: {
        formatter: graphNumberFormatter,
      },
      // An explicit `title: undefined` key breaks ApexCharts' option merging
      // (the chart silently renders empty), so only add the key when set
      ...(unit ? { title: { text: unit } } : {}),
    },
    tooltip: {
      shared: isMultiSeries,
      x: { format: 'yyyy' },
    },
  };

  // Multi-series charts need room for the legend below the plot
  return (
    <WrappedChart options={chartOptions} series={chartSeries} type="line" height={isMultiSeries ? 260 : 200} />
  );
}
