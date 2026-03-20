"use client";

import WrappedChart, { graphNumberFormatter } from "@/lib/chartWrapper.tsx";
import { calculatePredictedOutcome } from "../../../functions/graphFunctions.ts";
import { useTranslation } from "react-i18next";
import { Goal, isISOIshDate } from "@/types";
import { dataSeriesToDateValues } from "@/functions/recipe/vectorAndMaskUtils.ts";

export default function PredictionChildGraph({
  goal,
  childGoals,
  isStacked,
}: {
  goal: Goal;
  childGoals: Goal[];
  isStacked: boolean,
}) {
  const { t } = useTranslation("graphs");

  // Early returns if there is no relevant data to compare
  if (!goal.dataSeries) {
    return null;
  }
  if (childGoals.filter(child => child.dataSeries).length < 1) {
    return null;
  }

  const dataPoints: ApexAxisChartSeries = [];

  const definedDates: string[] = [...new Set(
    ...goal.dataSeries.values.map(e => new Date(e.timestamp).getUTCFullYear().toString()),
    ...childGoals
      .filter(child => child.dataSeries)
      .flatMap(child => child.dataSeries?.values.map(e => new Date(e.timestamp).getUTCFullYear().toString()))
  )]
    .sort()
    .map(yyyy => `${yyyy}-01-01T00:00:00Z`);
  if (!definedDates.every(d => isISOIshDate(d))) return null;

  const dataSeries = dataSeriesToDateValues(goal.dataSeries);

  // Data series for the main goal
  // Use projected outcomes only for the children, not the main goal
  const mainSeries = [];
  for (const date of definedDates) {
    const goalValue = dataSeries.dateValues[date];

    mainSeries.push({
      x: new Date(date).getTime(),
      y: Number.isFinite(goalValue) ? goalValue : null,
    });
  }
  dataPoints.push({
    name: (goal.name || goal.indicatorParameter.split('\\').at(-1)),
    data: mainSeries,
    // Main series is always a line
    type: 'line',
    zIndex: 999,
    color: 'black',
  });

  for (const child of childGoals) {
    const definedEffects = child.effects.filter(e => e.dataSeries);
    const totalEffect = calculatePredictedOutcome(definedEffects, child.baseline);
    if (isStacked) {
      // For stacked area graphs, default to 0 rather than null on bad values
      for (const entry of totalEffect) entry.y ??= 0;
    }
    if (totalEffect.length > 0) {
      const effectName = child.name || child.indicatorParameter.split('\\').at(-1);
      const roadmapName = child.roadmap.metaRoadmap.name || t("graphs:common.unknown_roadmap");
      dataPoints.push({
        name: `${effectName} (${roadmapName})`,
        data: totalEffect,
        type: isStacked ? 'area' : 'line',
      });
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
      min: new Date(`2020-01-01T00:00:00Z`).getTime(),
      max: new Date(`2050-01-01T00:00:00Z`).getTime(),
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