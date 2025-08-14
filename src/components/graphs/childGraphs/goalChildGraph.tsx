"use client";

import WrappedChart, { graphNumberFormatter } from "@/lib/chartWrapper.tsx";
import { dataSeriesDataFieldNames } from "@/types.ts";
import { DataSeries, Goal } from "@prisma/client";
import { useTranslation } from "react-i18next";

/**
 * A graph showing how all goals with the same unit and indicator parameter in roadmaps working towards the active goal's roadmap version stack up against it.
 */
export default function GoalChildGraph({
  goal,
  childGoals,
  isStacked,
}: {
  goal: Goal & { dataSeries: DataSeries | null },
  childGoals: (Goal & { dataSeries: DataSeries | null, roadmapName?: string })[],
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
  for (const i of dataSeriesDataFieldNames) {
    const value = goal.dataSeries[i];

    mainSeries.push({
      x: new Date(i.replace('val', '')).getTime(),
      y: Number.isFinite(value) ? value : null,
    });
  }
  dataPoints.push({
    name: (goal.name || goal.indicatorParameter.split('\\').slice(-1)[0]),
    data: mainSeries,
    // Main series is always a line
    type: 'line',
    zIndex: 999,
    color: 'black',
  });

  for (const child of childGoals) {
    const childSeries = [];
    if (child.dataSeries) {
      for (const i of dataSeriesDataFieldNames) {
        const value = child.dataSeries[i];

        childSeries.push({
          x: new Date(i.replace('val', '')).getTime(),
          // Specifically in the combined graph, when stacked, default to 0 rather than null if the value is not a number
          // This is because stacked area charts in ApexCharts do not handle null values well (other entries are shifted up outside the graph)
          y: Number.isFinite(value) ? value : (isStacked ? 0 : null),
        });
      }
    }
    // Only add the series to the graph if it isn't all null/0
    if (childSeries.filter((entry) => entry.y).length > 0) {
      dataPoints.push({
        name: `${child.name || child.indicatorParameter.split('\\').slice(-1)[0]} (${child.roadmapName || t("graphs:common.unknown_roadmap")})`,
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
    markers: { size: isStacked ? 0 : 5 },
    xaxis: {
      type: 'datetime',
      labels: { format: 'yyyy' },
      tooltip: { enabled: false },
      min: new Date(dataSeriesDataFieldNames[0].replace('val', '')).getTime(),
      max: new Date(dataSeriesDataFieldNames[dataSeriesDataFieldNames.length - 1].replace('val', '')).getTime()
    },
    yaxis: {
      title: { text: goal.dataSeries?.unit },
      labels: { formatter: graphNumberFormatter },
    },
    tooltip: {
      x: { format: 'yyyy' },
      inverseOrder: isStacked,
    },
    dataLabels: { enabled: false },
    stroke: { dashArray, curve },
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