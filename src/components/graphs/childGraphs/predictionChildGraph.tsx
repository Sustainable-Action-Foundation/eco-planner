"use client";

import WrappedChart, { graphNumberFormatter } from "@/lib/chartWrapper.tsx";
import { dataSeriesDataFieldNames } from "@/types.ts";
import { DataSeries, Effect, Goal } from "@prisma/client";
import { calculatePredictedOutcome, firstNonNullValue } from "../functions/graphFunctions.ts";
import { useTranslation } from "react-i18next";

export default function PredictionChildGraph({
  goal,
  childGoals,
  isStacked,
}: {
  goal: Goal & { dataSeries: DataSeries | null },
  childGoals: (Goal & { dataSeries: DataSeries | null, baselineDataSeries: DataSeries | null, effects: (Effect & { dataSeries: DataSeries | null })[], roadmapName?: string })[],
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
  // Use projected outcomes only for the children, not the main goal
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
    if (child.dataSeries) {
      const baseline = child.baselineDataSeries ?? firstNonNullValue(child.dataSeries);
      if (!baseline) {
        continue;
      } else if (typeof baseline === 'number' && child.effects.length < 1) {
        continue;
      }

      const totalEffect = calculatePredictedOutcome(child.effects, baseline);
      if (isStacked) {
        // For stacked area graphs, default to 0 rather than null on bad values
        for (const entry of totalEffect) {
          entry.y ??= 0;
        }
      }
      if (totalEffect.length > 0) {
        dataPoints.push({
          name: `${child.name || child.indicatorParameter.split('\\').slice(-1)[0]} (${child.roadmapName || t("graphs:common.unknown_roadmap")})`,
          data: totalEffect,
          type: isStacked ? 'area' : 'line',
        });
      }
    }
  }

  // Early return if there is no data to compare
  if (dataPoints.length < 2) {
    return <b className="flex justify-content-center align-items-center font-weight-500 padding-inline-100" style={{ width: '100%', height: '100%' }}>
      {t("graphs:prediction_child_graph.no_child_roadmaps")}
    </b>
  }

  // If childSeries are lines, make them dashed
  let dashArray: number[] = [];
  if (!isStacked) {
    dashArray = new Array(dataPoints.length).fill(5);
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
  );
}