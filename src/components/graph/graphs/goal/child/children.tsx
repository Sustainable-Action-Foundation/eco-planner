"use client";

import { dataSeriesToDateValues } from "@/functions/recipe/vectorAndMaskUtils";
import WrappedChart, { graphNumberFormatter } from "@/lib/chartWrapper";
import { Goal, isISOIshDate } from "@/types";
import { useTranslation } from "react-i18next";
import { color_palette, stroke, marker } from "../../../config";

/**
 * A graph showing how all goals with the same unit and indicator parameter in roadmaps working towards the active goal's roadmap version stack up against it.
 */
export default function GoalChildGraph({
  goal,
  childGoals,
  isStacked,
}: {
  goal: Goal,
  childGoals: Goal[],
  isStacked: boolean,
}) {
  const { t } = useTranslation("graphs");

  // Early returns if there is no relevant data to compare
  if (!goal.dataSeries) {
    return null;
  }
  if (childGoals.filter(child => child.dataSeries != null).length < 1) {
    return null;
  }

  const dataPoints: ApexAxisChartSeries = [];

  // Data series for the main goal
  const mainSeries = [];
  const dataSeries = dataSeriesToDateValues(goal.dataSeries);
  const dates = Object.keys(dataSeries.dateValues).sort();
  if (!dates.every(isISOIshDate)) {
    throw new Error("Data series contains non-date keys");
  }

  for (const date of dates) {
    const value = dataSeries.dateValues[date];

    mainSeries.push({
      x: new Date(date).getTime(),
      y: Number.isFinite(value) ? value : null,
    });
  }
  dataPoints.push({
    name: (goal.name || goal.indicatorParameter.split('\\').at(-1)),
    data: mainSeries,
    // Main series is always a line
    type: 'line',
    zIndex: 999,
    color: color_palette.data.color,
  });

  for (const child of childGoals) {
    if (!child.dataSeries) {
      console.warn(`Child goal ${child.id} has no data series, skipping`);
      continue;
    }

    const childSeries = [];
    const childDataSeries = dataSeriesToDateValues(child.dataSeries);
    const dates = Object.keys(childDataSeries.dateValues).sort();
    if (!dates.every(isISOIshDate)) {
      throw new Error("Data series contains non-date keys");
    }

    for (const date of dates) {
      const value = childDataSeries.dateValues[date];

      childSeries.push({
        x: new Date(date).getTime(),
        // Specifically in the combined graph, when stacked, default to 0 rather than null if the value is not a number
        // This is because stacked area charts in ApexCharts do not handle null values well (other entries are shifted up outside the graph)
        y: Number.isFinite(value) ? value : (isStacked ? 0 : null),
      });
    }
    // Only add the series to the graph if it isn't all null/0
    if (childSeries.filter((entry) => entry.y).length > 0) {
      dataPoints.push({
        name: `${child.name || child.indicatorParameter.split('\\').at(-1)} (${child.roadmap.metaRoadmap.name || t("graphs:common.unknown_roadmap")})`,
        data: childSeries,
        type: isStacked ? 'area' : 'line',
      });
    }
  }

  // Early return if there is no data to compare
  if (dataPoints.length < 2) {
    return null;
  }

  // If childSeries are lines, make them dashed
  let dashArray: number[] = [];
  if (!isStacked) {
    dashArray = new Array<number>(dataPoints.length).fill(5);
    // Main series should always be solid
    dashArray[0] = 0;
  }
  const curve = new Array<("smooth" | "straight")>(dataPoints.length).fill(isStacked ? 'smooth' : 'straight');
  // Main series should always be straight
  curve[0] = 'straight';

  // ApexCharts options
  const chartOptions: ApexCharts.ApexOptions = {
    chart: {
      id: 'goalChildGraph',
      type: isStacked ? 'area' : 'line',
      stacked: isStacked,
      stackOnlyBar: false,
      animations: { enabled: false, dynamicAnimation: { enabled: false } },
      zoom: { allowMouseWheelZoom: false },
    },
    fill: {
      type: 'solid',
      opacity: [1, 0.3]
    },
    stroke: { curve: stroke.curve, width: stroke.width },
    markers: { size: isStacked ? 0 : marker.size },
    xaxis: {
      type: 'datetime',
      labels: { format: 'yyyy' },
      tooltip: { enabled: false },
      min: new Date("2020-01-01T00:00:00Z").getTime(),
      max: new Date("2050-01-01T00:00:00Z").getTime(),
    },
    yaxis: {
      title: { text: goal.dataSeries.unit === null ? t("common:tsx.unitless") : goal.dataSeries.unit || t("common:tsx.unit_missing") },
      labels: { formatter: graphNumberFormatter },
    },
    tooltip: {
      x: { format: 'yyyy' },
      inverseOrder: isStacked,
    },
    dataLabels: { enabled: false },
  };

  return (
    <WrappedChart
      options={chartOptions}
      series={dataPoints}
      type={isStacked ? 'area' : 'line'}
      width="100%"
      height="100%"
    />
  )
}