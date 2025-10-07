"use client"
 
import { useRecipe } from "../../contextProvider"; 
import { ApexOptions } from "apexcharts";
import Chart from "react-apexcharts"

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
      animations: {enabled: false},
      type: "line",
    },
    xaxis: {
      categories: years,
    },
  };

  return (
    <Chart options={chartOptions} series={chartSeries} type="line" />
  );
}