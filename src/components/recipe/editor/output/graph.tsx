"use client"

import WrappedChart, { graphNumberFormatter } from "@/lib/chartWrapper";
import { useRecipe } from "../../contextProvider";
import { ApexOptions } from "apexcharts";

// TODO: Does this take historical data into account? Do we need to account for it?
// TODO: We should have a visible title for our graph
export default function OutputGraph() {
  const { resultingDataSeries } = useRecipe();
  if (!resultingDataSeries) return null;

  const entries = Object.entries(resultingDataSeries)
    .filter(([key]) => key.startsWith("val"))
    .sort(([a], [b]) => a.localeCompare(b)); // Ensure chronological order

  const years = entries.map(([key]) => key.replace("val", ""));
  const values = entries.map(([, value]) => value);

  const chartSeries = [
    {
      name: "Data",
      data: values,
    },
  ];

  const chartOptions: ApexOptions = {
    chart: {
      animations: { enabled: false },
      type: "line",
      zoom: { enabled: false },
      toolbar: { show: false }
    },
    xaxis: {
      categories: years,
    },
    yaxis: {
      labels: {
        formatter: graphNumberFormatter
      }
    }
  };

  return (
    <WrappedChart options={chartOptions} series={chartSeries} type="line" />
  );
}