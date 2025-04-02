"use client";

import WrappedChart, { floatSmoother } from "@/lib/chartWrapper";
import { dataSeriesDataFieldNames } from "@/types";
import { Goal, DataSeries } from "@prisma/client";
import { useTranslation } from "react-i18next";

export default function MainRelativeGraph({
  goal,
  secondaryGoal,
  nationalGoal,
}: {
  goal: Goal & { dataSeries: DataSeries | null },
  secondaryGoal: Goal & { dataSeries: DataSeries | null } | null,
  nationalGoal: Goal & { dataSeries: DataSeries | null } | null,
}) {
  const { t } = useTranslation();

  if (!goal.dataSeries || ["procent", "percent", "andel", "ratio", "fraction"].includes(goal.dataSeries.unit.toLowerCase())) {
    return null;
  }

  const chart: ApexAxisChartSeries = [];

  // Local goal
  const mainSeries = [];
  const mainFirstNonNullOrZero = dataSeriesDataFieldNames.find(i => goal.dataSeries && Number.isFinite(goal.dataSeries[i]) && goal.dataSeries[i] !== 0);
  let mainBaseValue: number = NaN;
  if (mainFirstNonNullOrZero) {
    mainBaseValue = goal.dataSeries[mainFirstNonNullOrZero] as number;
  }
  for (const i of dataSeriesDataFieldNames) {
    const value = ((goal.dataSeries[i] ?? NaN) / mainBaseValue) * 100;
    mainSeries.push({
      x: new Date(i.replace('val', '')).getTime(),
      y: Number.isFinite(value) ? value : null,
    });
  }
  chart.push({
    name: (goal.name || goal.indicatorParameter).split('\\').slice(-1)[0],
    data: mainSeries,
    type: 'line',
  });

  // Secondary goal
  if (secondaryGoal?.dataSeries) {
    const secondarySeries = [];
    const firstNonNullOrZero = dataSeriesDataFieldNames.find(i => secondaryGoal.dataSeries && Number.isFinite(secondaryGoal.dataSeries[i]) && secondaryGoal.dataSeries[i] !== 0);
    let baseValue: number = NaN;
    if (firstNonNullOrZero) {
      baseValue = secondaryGoal.dataSeries[firstNonNullOrZero] as number;
    }
    for (const i of dataSeriesDataFieldNames) {
      const value = ((secondaryGoal.dataSeries[i] ?? NaN) / baseValue) * 100;
      secondarySeries.push({
        x: new Date(i.replace('val', '')).getTime(),
        y: Number.isFinite(value) ? value : null,
      })
    }
    chart.push({
      name: secondaryGoal.name || secondaryGoal.indicatorParameter,
      data: secondarySeries,
      type: 'line',
    })
  }

  // National goal
  if (nationalGoal?.dataSeries) {
    const nationalSeries = [];
    const firstNonNullOrZero = dataSeriesDataFieldNames.find(i => nationalGoal.dataSeries && Number.isFinite(nationalGoal.dataSeries[i]) && nationalGoal.dataSeries[i] !== 0);
    let baseValue: number = NaN;
    if (firstNonNullOrZero) {
      baseValue = nationalGoal.dataSeries[firstNonNullOrZero] as number;
    }
    for (const i of dataSeriesDataFieldNames) {
      const value = ((nationalGoal.dataSeries[i] ?? NaN) / baseValue) * 100;
      nationalSeries.push({
        x: new Date(i.replace('val', '')).getTime(),
        y: Number.isFinite(value) ? value : null,
      });
    }
    chart.push({
      name: t("graphs:main_relative_graph.national_counterpart"),
      data: nationalSeries,
      type: 'line',
    });
  }

  const chartOptions: ApexCharts.ApexOptions = {
    chart: {
      type: 'line',
      animations: { enabled: false, dynamicAnimation: { enabled: false } },
      zoom: { allowMouseWheelZoom: false },
    },
    stroke: { curve: 'straight' },
    markers: { size: 5 },
    xaxis: {
      type: 'datetime',
      labels: { format: 'yyyy' },
      tooltip: { enabled: false },
      min: new Date(dataSeriesDataFieldNames[0].replace('val', '')).getTime(),
      max: new Date(dataSeriesDataFieldNames[dataSeriesDataFieldNames.length - 1].replace('val', '')).getTime()
    },
    yaxis: {
      title: { text: t("graphs:main_relative_graph.percent_relative_to_base_year") },
      labels: { formatter: floatSmoother },
    },
    tooltip: {
      x: { format: 'yyyy' },
    },
  }

  return (
    <>
      <WrappedChart
        options={chartOptions}
        series={chart}
        type="line"
        width="100%"
        height="100%"
      />
    </>
  )
}