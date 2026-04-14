"use client";

import WrappedChart, { graphNumberFormatter } from "@/lib/chartWrapper";
import type { Goal, Roadmap } from "@/types";
import { parsePeriod } from "@/lib/api/utility";
import { calculatePredictedOutcome } from "@/components/graph/functions/graphFunctions";
import type { ApiTableContent } from "@/lib/api/apiTypes";
import { useTranslation } from "react-i18next";
import { dataSeriesToDateValues } from "@/functions/recipe/vectorAndMaskUtils";
import { color_palette, stroke, marker } from "../../../config";
import type { ApexAxisChartSeries, ApexYAxis } from "apexcharts";

// TODO: IT seems we want translations in our name, e.g (${t("common:goal_one")}), to be specifically in the label instead if possible. 
// This would make dealing with y-axis "series name" more sensible
// TODO: Probably want some helper function to create historical, parent and comparative dataseries that we can reuse in multiple components
export default function MainGraph({
  goal,
  secondaryGoal,
  parentGoal,
  parentGoalRoadmap,
  historicalData,
  effects,
}: {
  goal: Goal,
  secondaryGoal: Goal | null,
  parentGoal: Goal | null,
  parentGoalRoadmap: Roadmap | null,
  historicalData?: ApiTableContent | null,
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
  const minDate = timelineEntries[0]?.[0];
  const maxDate = timelineEntries[timelineEntries.length - 1]?.[0];

  const colors: Array<string> = [color_palette.data.color];
  const opacities: Array<number> = [color_palette.data.fillOpacity];

  const mainChartOptions: ApexCharts.ApexOptions = {
    chart: {
      type: 'line',
      animations: { enabled: false, dynamicAnimation: { enabled: false } },
      zoom: { allowMouseWheelZoom: false },
    },
    colors: colors,
    fill: {
      type: 'solid',
      colors: colors,
      opacity: opacities
    },
    stroke: { curve: stroke.curve, width: stroke.width },
    markers: { size: marker.size },
    xaxis: {
      type: 'datetime',
      labels: { format: 'yyyy' },
      tooltip: { enabled: false },
      ...(minDate ? { min: new Date(minDate).getTime() } : {}),
      ...(maxDate ? { max: new Date(maxDate).getTime() } : {}),
    },
    yaxis: [
      {
        title: { text: goal.dataSeries.unit === null ? t("common:tsx.unitless") : goal.dataSeries.unit || t("common:tsx.unit_missing") },
        labels: { formatter: graphNumberFormatter },
        seriesName: [
          `${(goal.name || goal.indicatorParameter).split('\\').slice(-1)[0]} (${t("common:goal_one")})`,
          t("graphs:common.baseline_scenario"),
          t("graphs:common.expected_outcome"),
          (secondaryGoal?.dataSeries?.unit === goal.dataSeries.unit) ? (secondaryGoal.name || secondaryGoal.indicatorParameter).split('\\').slice(-1)[0] : "",
          historicalData ? `${historicalData.metadata[0]?.label} (${t("common:historical_data")})` : "",
        ]
      }
    ],
    tooltip: {
      x: { format: 'yyyy' },
      shared: true,
    },
  }

  const mainChart: ApexAxisChartSeries = [];

  // Main data series for the goal
  const mainSeries = seriesFromDateValues(mainDateValues.dateValues);
  mainChart.push({
    name: `${(goal.name || goal.indicatorParameter).split('\\').slice(-1)[0]} (${t("common:goal_one")})`,
    data: mainSeries,
    type: 'line',
  })


  if (historicalData) {
    const historicalSeries = [];

    if (historicalData.values.length >= 0) {
      for (const { period, value } of historicalData.values) {
        const parsedValue = parseFloat(value);

        historicalSeries.push({
          x: parsePeriod(period).getTime(),
          y: Number.isFinite(parsedValue) ? parsedValue : null,
        });
      }
      mainChart.push({
        name: `${historicalData.metadata[0]?.label} (${t("common:historical_data")})`,
        data: historicalSeries,
        type: 'area',
        color: '#2e8a56',
      });
    }

    colors.push(color_palette.historical.color);
    opacities.push(color_palette.historical.fillOpacity)
  }


  if (goal.baseline) {
    // Predicted outcome without actions/effects
    const baselineDateValues = dataSeriesToDateValues(goal.baseline);
    const baseline = seriesFromDateValues(baselineDateValues.dateValues);
    mainChart.push({
      name: t("graphs:common.baseline_scenario"),
      data: baseline,
      type: 'line',
    })

    if (effects.length > 0) {
      const totalEffect = calculatePredictedOutcome(effects, goal.baseline)

      // Line based on totalEffect + baseline
      if (totalEffect.length > 0) {
        mainChart.push({
          name: t("graphs:common.expected_outcome"),
          data: totalEffect,
          type: 'line',
        });
      }

      colors.push(color_palette.expected.color);
      opacities.push(color_palette.expected.fillOpacity)
    }

    colors.push(color_palette.baseline.color);
    opacities.push(color_palette.baseline.fillOpacity)
  } else if (effects.length > 0) {
    // If no baseline is set, use the first non-null value as baseline
    const firstNonNull = mainEntries.find(([, value]) => Number.isFinite(value));

    if (firstNonNull) {
      const totalEffect = calculatePredictedOutcome(effects, firstNonNull[1])

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
        opacities.push(color_palette.baseline.fillOpacity)
        colors.push(color_palette.expected.color);
        opacities.push(color_palette.expected.fillOpacity)
      }
    }
  }

  if (secondaryGoal?.dataSeries) {
    const secondaryDateValues = dataSeriesToDateValues(secondaryGoal.dataSeries);
    const secondarySeries = seriesFromDateValues(secondaryDateValues.dateValues);
    mainChart.push({
      name: secondaryGoal.name || secondaryGoal.indicatorParameter,
      data: secondarySeries,
      type: 'line',
    });
    // Place secondary and main series on different scales if they don't share the same unit
    // TODO: Use mathjs to see if the units are the same, rather than just comparing strings
    if (secondaryGoal.dataSeries.unit !== goal.dataSeries.unit) {
      (mainChartOptions.yaxis as ApexYAxis[]).push({
        title: { text: `${t("graphs:main_graph.secondary_goal", { unit: secondaryGoal.dataSeries.unit })}` },
        labels: { formatter: graphNumberFormatter },
        seriesName: [(secondaryGoal.name || secondaryGoal.indicatorParameter).split('\\').slice(-1)[0]],
        opposite: true,
      });
    }

    colors.push(color_palette.secondaryGoal.color);
    opacities.push(color_palette.secondaryGoal.fillOpacity)
  }

  if (parentGoal?.dataSeries) {
    const parentDateValues = dataSeriesToDateValues(parentGoal.dataSeries);
    const nationalSeries = seriesFromDateValues(parentDateValues.dateValues);
    mainChart.push({
      name: t("graphs:common.parent_counterpart", { parent: parentGoalRoadmap?.metaRoadmap.name || "" }),
      data: nationalSeries,
      type: 'line',
    });
    (mainChartOptions.yaxis as ApexYAxis[]).push({
      title: { text: t("graphs:main_graph.national_goal") },
      labels: { formatter: graphNumberFormatter },
      seriesName: [t("graphs:common.parent_counterpart", { parent: parentGoalRoadmap?.metaRoadmap.name || "" })],
      opposite: true,
    });

    colors.push(color_palette.parentGoal.color);
    opacities.push(color_palette.parentGoal.fillOpacity)
  }

  return (
    <WrappedChart
      options={mainChartOptions}
      series={mainChart}
      type="line"
      width="100%"
      height="100%"
    />
  )
}