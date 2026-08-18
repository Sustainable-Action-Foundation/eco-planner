"use client";

import WrappedChart, { graphNumberFormatter } from "@/lib/chartWrapper";
import { isISOIshDate } from "@/types/typeguards";
import type { DateValues } from "@/types";
import type { ApexOptions } from "apexcharts";

export default function CuratedHistoricalGraph({
  name,
  unit,
  dateValues,
}: {
  name: string,
  unit: string | null,
  dateValues: DateValues,
}) {
  const chartSeries = [
    {
      name,
      data: Object.entries(dateValues)
        .filter(([key]) => isISOIshDate(key))
        .map(([key, value]) => ({ x: new Date(key).getTime(), y: value }))
        .sort((a, b) => a.x - b.x),
    },
  ];

  const chartOptions: ApexOptions = {
    chart: {
      animations: { enabled: false },
      type: "line",
      zoom: { enabled: false },
      toolbar: { show: false },
    },
    stroke: { width: 2 },
    xaxis: {
      type: 'datetime',
      labels: { format: 'yyyy' },
      tooltip: { enabled: false },
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
      x: { format: 'yyyy' },
    },
  };

  return (
    <WrappedChart options={chartOptions} series={chartSeries} type="line" height={200} />
  );
}
