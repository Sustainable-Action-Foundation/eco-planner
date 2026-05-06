"use client";

import WrappedChart, { graphNumberFormatter } from "@/lib/chartWrapper";
import type { Goal, Roadmap } from "@/types";
import { useTranslation } from "react-i18next";
import { color_palette, stroke, marker } from "../../../config";
import type { ApexAxisChartSeries } from "apexcharts";

export default function MainRelativeGraph({
  goal,
  secondaryGoal,
  parentGoal,
  parentGoalRoadmap,
}: {
  goal: Goal,
  secondaryGoal: Goal | null,
  parentGoal: Goal | null,
  parentGoalRoadmap: Roadmap | null,
}) {
  const { t } = useTranslation("graphs");

  if (!goal.dataSeries || ["procent", "percent", "andel", "ratio", "fraction"].includes(goal.dataSeries.unit?.toLowerCase() ?? "")) {
    return null;
  }

  const chart: ApexAxisChartSeries = [];
  const colors: Array<string> = [color_palette.data.color];
  const opacities: Array<number> = [color_palette.data.fillOpacity];

  // Local goal
  const mainSeries = [];
  const mainBaseValue: number = goal.dataSeries.values.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())[0]?.value ?? NaN;
  for (const point of goal.dataSeries.values) {
    mainSeries.push({
      x: new Date(point.timestamp).getTime(),
      y: Number.isFinite(mainBaseValue) && mainBaseValue !== 0 ? (point.value / mainBaseValue) * 100 : null,
    });
  }
  chart.push({
    name: (goal.name || goal.indicatorParameter).split('\\').at(-1),
    data: mainSeries,
    type: 'line',
  });

  // Secondary goal
  if (secondaryGoal?.dataSeries) {
    const secondarySeries = [];
    const secondaryBaseValue: number = secondaryGoal.dataSeries.values.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())[0]?.value ?? NaN;
    for (const point of secondaryGoal.dataSeries.values) {
      secondarySeries.push({
        x: new Date(point.timestamp).getTime(),
        y: Number.isFinite(secondaryBaseValue) && secondaryBaseValue !== 0 ? (point.value / secondaryBaseValue) * 100 : null,
      });
    }
    chart.push({
      name: secondaryGoal.name || secondaryGoal.indicatorParameter,
      data: secondarySeries,
      type: 'line',
    })
    colors.push(color_palette.secondaryGoal.color);
    opacities.push(color_palette.secondaryGoal.fillOpacity)
  }

  // National goal
  if (parentGoal?.dataSeries) {
    const nationalSeries = [];
    const parentBaseValue: number = parentGoal.dataSeries.values.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())[0]?.value ?? NaN;
    for (const point of parentGoal.dataSeries.values) {
      nationalSeries.push({
        x: new Date(point.timestamp).getTime(),
        y: Number.isFinite(parentBaseValue) && parentBaseValue !== 0 ? (point.value / parentBaseValue) * 100 : null,
      });
    }
    chart.push({
      name: t("graphs:common.parent_counterpart", { parent: parentGoalRoadmap?.metaRoadmap.name || "" }),
      data: nationalSeries,
      type: 'line',
    });

    colors.push(color_palette.parentGoal.color);
    opacities.push(color_palette.parentGoal.fillOpacity)
  }

  const chartOptions: ApexCharts.ApexOptions = {
    chart: {
      type: 'line',
      animations: { enabled: false, dynamicAnimation: { enabled: false } },
      zoom: { allowMouseWheelZoom: false },
    },
    colors: colors,
    fill: {
      type: 'solid',
      colors: colors,
      opacity: opacities,
    },
    stroke: { curve: stroke.curve, width: stroke.width },
    markers: { size: marker.size },
    xaxis: {
      type: 'datetime',
      labels: { format: 'yyyy' },
      tooltip: { enabled: false },
      min: new Date("2020-01-01T00:00:00Z").getTime(),
      max: new Date("2050-01-01T00:00:00Z").getTime(),
    },
    yaxis: {
      title: { text: t("graphs:main_relative_graph.percent_relative_to_base_year") },
      labels: { formatter: graphNumberFormatter },
    },
    tooltip: {
      x: { format: 'yyyy' },
    },
  }

  return (
    <WrappedChart
      options={chartOptions}
      series={chart}
      type="line"
      width="100%"
      height="100%"
    />
  )
}