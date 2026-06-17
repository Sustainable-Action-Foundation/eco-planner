"use client";

import WrappedChart, { graphNumberFormatter } from "@/lib/chartWrapper";
import type { Goal } from "@/types";
import { calculatePredictedOutcome } from "@/components/graph/functions/graphFunctions";
import { useTranslation } from "react-i18next";
import { dataSeriesToDateValues } from "@/functions/recipe/vectorAndMaskUtils";
import { color_palette, stroke, marker } from "../config";
import type { ApexAxisChartSeries } from "apexcharts";

// TODO: IT seems we want translations in our name, e.g (${t("common:goal_one")}), to be specifically in the label instead if possible. 
// This would make dealing with y-axis "series name" more sensible
// TODO: Probably want some helper function to create historical, parent and comparative dataseries that we can reuse in multiple components
export default function HistoricalDataGraph({
  goal,
  historicalData,
  effects,
}: {
  goal: Goal,
  historicalData: { period: string; value: string; }[],
  effects: Goal["effects"],
}) {
  const { t } = useTranslation("graphs");

  if (!goal.dataSeries) {
    return null;
  }

  const sortDateEntries = (entries: Array<[string, number]>) =>
    entries.sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime());

  const seriesFromDateValues = (dateValues: Record<string, number>) =>
    sortDateEntries(Object.entries(dateValues)).map(([isoDate, value]) => ({
      x: new Date(isoDate).getTime(),
      y: Number.isFinite(value) ? value : null,
    }));

  const mainDateValues = dataSeriesToDateValues(goal.dataSeries);
  const mainEntries = sortDateEntries(Object.entries(mainDateValues.dateValues));
  const baselineEntries = goal.baseline
    ? sortDateEntries(Object.entries(dataSeriesToDateValues(goal.baseline).dateValues))
    : [];
  const timelineEntries = mainEntries.length ? mainEntries : baselineEntries;

  const sortedMainEntries = Object.entries(mainDateValues.dateValues)
    .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime());

  const historicalEntries = historicalData
    ? historicalData
      .map(({ period, value }) => [new Date(period).getTime(), Number(value)] as [number, number])
      .sort((a, b) => a[0] - b[0])
    : [];

  const lastMainEntry = sortedMainEntries.at(-1);
  const firstHistoricalEntry = historicalEntries.at(0);
  const lastHistoricalEntry = historicalEntries.at(-1);

  if (!lastMainEntry) throw new Error("sortedMainEntries is empty");

  const colors: Array<string> = [color_palette.data.color];
  const opacities: Array<number> = [color_palette.data.fillOpacity];

  const mainChartOptions: ApexCharts.ApexOptions = {
    chart: {
      type: 'line',
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
      // If we have historical data, we set the start year to whatever starts first. Otherwise we just use the main data series.
      min: firstHistoricalEntry ? Math.min(new Date(sortedMainEntries[0][0]).getTime(), new Date(firstHistoricalEntry[0]).getTime()) : new Date(sortedMainEntries[0][0]).getTime(),
      // If we have historical data, we set the end year to whatever ends last. Otherwise we just use the main data series.
      max: lastHistoricalEntry ? Math.max(new Date(lastMainEntry[0]).getTime(), new Date(lastHistoricalEntry[0]).getTime()) : new Date(lastMainEntry[0]).getTime(),
    },
    yaxis: [
      {
        title: { text: goal.dataSeries.unit === null ? t("common:tsx.unitless") : goal.dataSeries.unit || t("common:tsx.unit_missing") },
        labels: { formatter: graphNumberFormatter },
        seriesName: [
          `${(goal.name || goal.indicatorParameter).split('\\').slice(-1)[0]} (${t("common:goal_one")})`,
          t("graphs:common.baseline_scenario"),
          t("graphs:common.expected_outcome"),
        ],
      },
    ],
    tooltip: {
      x: { format: 'yyyy' },
      shared: true,
    },
  };

  const mainChart: ApexAxisChartSeries = [];

  // Main data series for the goal
  const mainSeries = seriesFromDateValues(mainDateValues.dateValues);
  mainChart.push({
    name: `${(goal.name || goal.indicatorParameter).split('\\').slice(-1)[0]} (${t("common:goal_one")})`,
    data: mainSeries,
    type: 'line',
  });

  const historicalSeries = historicalEntries.map(([timestamp, value]) => ({
    x: timestamp,
    y: value,
  }));

  mainChart.push({
    name: 'TRANSLATION HERE !!!!!',
    data: historicalSeries,
    type: 'area',
    color: '#2e8a56',
  });

  colors.push(color_palette.historical.color);
  opacities.push(color_palette.historical.fillOpacity);

  if (goal.baseline) {
    // Predicted outcome without actions/effects
    const baselineDateValues = dataSeriesToDateValues(goal.baseline);
    const baseline = seriesFromDateValues(baselineDateValues.dateValues);
    mainChart.push({
      name: t("graphs:common.baseline_scenario"),
      data: baseline,
      type: 'line',
    });

    if (effects.length > 0) {
      const totalEffect = calculatePredictedOutcome(effects, goal.baseline);

      // Line based on totalEffect + baseline
      if (totalEffect.length > 0) {
        mainChart.push({
          name: t("graphs:common.expected_outcome"),
          data: totalEffect,
          type: 'line',
        });
      }

      colors.push(color_palette.expected.color);
      opacities.push(color_palette.expected.fillOpacity);
    }

    colors.push(color_palette.baseline.color);
    opacities.push(color_palette.baseline.fillOpacity);
  } else if (effects.length > 0) {
    // If no baseline is set, use the first non-null value as baseline
    const firstNonNull = mainEntries.find(([, value]) => Number.isFinite(value));

    if (firstNonNull) {
      const totalEffect = calculatePredictedOutcome(effects, firstNonNull[1]);

      // Only draw if totalEffect has values
      if (totalEffect.length > 0) {
        // Flat line based on goal.dataSeries[firstNonNull]
        const baseline = timelineEntries.map(([isoDate]) => ({
          x: new Date(isoDate).getTime(),
          y: firstNonNull[1],
        }));
        mainChart.push({
          name: t("graphs:common.baseline_scenario"),
          data: baseline,
          type: 'line',
        });

        // Line based on totalEffect
        mainChart.push({
          name: t("graphs:common.expected_outcome"),
          data: totalEffect,
          type: 'line',
        });

        colors.push(color_palette.baseline.color);
        opacities.push(color_palette.baseline.fillOpacity);
        colors.push(color_palette.expected.color);
        opacities.push(color_palette.expected.fillOpacity);
      }
    }
  }

  return (
    <WrappedChart
      options={mainChartOptions}
      series={mainChart}
      type="line"
      width="100%"
      height="100%"
    />
  );
}