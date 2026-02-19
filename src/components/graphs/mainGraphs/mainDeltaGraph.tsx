"use client";

import { calculatePredictedOutcome } from "@/components/graphs/functions/graphFunctions";
import { dataSeriesToDateValues } from "@/functions/recipe/vectorAndMaskUtils";
import WrappedChart, { graphNumberFormatter } from "@/lib/chartWrapper";
import { Effect, Goal, isISOIshDate, Roadmap } from "@/types";
import { useTranslation } from "react-i18next";
import { color_palette, stroke, marker } from "../config";

// TODO: Come back to look at colors later, have not tested them
export default function MainDeltaGraph({
  goal,
  secondaryGoal,
  parentGoal,
  parentGoalRoadmap,
  effects,
}: {
  goal: Goal,
  secondaryGoal: Goal | null,
  parentGoal: Goal | null,
  parentGoalRoadmap: Roadmap | null,
  effects: Effect[] | Goal["effects"],
}) {
  const { t } = useTranslation("graphs");

  if (!goal.dataSeries) {
    return null
  }

  const colors: Array<string> = [color_palette.data.color];
  const opacities: Array<number> = [color_palette.data.fillOpacity];

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
      opacity: opacities
    },
    stroke: { curve: stroke.curve, width: stroke.width },
    markers: { size: marker.size },
    xaxis: {
      type: 'datetime',
      labels: { format: 'yyyy' },
      tooltip: { enabled: false },
      min: new Date("2020-01-01T00:00:00Z").getTime(),
      max: new Date("2050-01-01T00:00:00Z").getTime()
    },
    yaxis: [{
      title: {
        text: t("graphs:main_delta_graph.annual_change", { unit: goal.dataSeries.unit?.toLowerCase() == 'procent' ? t("graphs:main_delta_graph.percentage_points") : goal.dataSeries.unit === null ? t("common:tsx.unitless") : goal.dataSeries.unit || t("common:tsx.unit_missing") })
      },
      labels: { formatter: graphNumberFormatter },
      seriesName: [
        (goal.name || goal.indicatorParameter).split('\\').at(-1) ?? "",
        t("graphs:common.baseline_scenario"),
        t("graphs:common.expected_outcome"),
        (secondaryGoal?.dataSeries?.unit === goal.dataSeries.unit) ? (secondaryGoal.name || secondaryGoal.indicatorParameter) : '',
        t("graphs:common.parent_counterpart", { parent: parentGoalRoadmap?.metaRoadmap.name || "" }),
      ],
    }],
    tooltip: {
      x: { format: 'yyyy' },
    },
  }

  const chart: ApexAxisChartSeries = [];

  // Local goal
  const mainSeries = [];
  const dataSeries = dataSeriesToDateValues(goal.dataSeries);
  const dates = Object.keys(dataSeries.dateValues).sort();
  if (!dates.every(d => isISOIshDate(d))) {
    throw new Error("Invalid date found in goal data series when generating main delta graph.");
  }

  // Start at 1 to skip the first value
  for (let i = 1; i < dates.length; i++) {
    const currentField = dates[i];
    const previousField = dates[i - 1];

    const currentValue = dataSeries.dateValues[currentField] ?? NaN;
    const previousValue = dataSeries.dateValues[previousField] ?? NaN;

    const value = currentValue - previousValue;

    mainSeries.push({
      x: new Date(currentField).getTime(),
      y: Number.isFinite(value) ? value : null,
    });
  }
  chart.push({
    name: (goal.name || goal.indicatorParameter).split('\\').at(-1),
    data: mainSeries,
    type: 'line',
  });

  if (goal.baseline) {
    // Baseline / predicted outcome without actions/effects
    const baselineSeries = [];
    const baseline = dataSeriesToDateValues(goal.baseline);
    const dates = Object.keys(baseline.dateValues).sort();
    if (!dates.every(d => isISOIshDate(d))) {
      throw new Error("Invalid date found in baseline data series when generating main delta graph.");
    }

    for (let i = 1; i < dates.length; i++) {
      const currentField = dates[i];
      const previousField = dates[i - 1];

      const currentValue = baseline.dateValues[currentField] ?? NaN;
      const previousValue = baseline.dateValues[previousField] ?? NaN;

      const value = currentValue - previousValue;

      baselineSeries.push({
        x: new Date(currentField).getTime(),
        y: Number.isFinite(value) ? value : null,
      });
    }
    chart.push({
      name: t("graphs:common.baseline_scenario"),
      data: baselineSeries,
      type: 'line',
    });

    const totalEffect = calculatePredictedOutcome(effects, goal.baseline);

    // Predicted outcome with actions
    if (totalEffect.length > 0) {
      // Calculate deltas (currentYear = currentYear - previousYear, working back-to-front in the array)
      for (let i = totalEffect.length - 1; i > 0; i--) {
        totalEffect[i].y = (totalEffect[i].y ?? NaN) - (totalEffect[i - 1].y ?? NaN);
        if (!Number.isFinite(totalEffect[i].y)) {
          totalEffect[i].y = null;
        }
      }
      // Remove value for first year since it's not a delta
      totalEffect.shift();

      chart.push({
        name: t("graphs:common.expected_outcome"),
        data: totalEffect,
        type: 'line',
      });

      colors.push(color_palette.expected.color);
      opacities.push(color_palette.expected.fillOpacity)
    }

    colors.push(color_palette.baseline.color);
    opacities.push(color_palette.baseline.fillOpacity)
  } else if (effects.length > 0) {
    // If no baseline is set, use the first non-null value as baseline
    const firstNonNullEntry = goal.dataSeries.values.find(v => Number.isFinite(v.value));
    const firstNonNull = !firstNonNullEntry
      ? undefined
      : new Date(firstNonNullEntry.timestamp).getUTCFullYear().toString();
    if (!firstNonNull || !isISOIshDate(firstNonNull)) throw new Error("Invalid date format in goal data series.");

    if (firstNonNull) {
      // Since the baseline is a single value, it won't have any delta year-to-year, so only draw effects

      const totalEffect = calculatePredictedOutcome(effects, dataSeries.dateValues[firstNonNull]);

      // Predicted outcome with actions
      if (totalEffect.length > 0) {
        // Calculate deltas (currentYear = currentYear - previousYear, working back-to-front in the array)
        for (let i = totalEffect.length - 1; i > 0; i--) {
          totalEffect[i].y = (totalEffect[i].y ?? NaN) - (totalEffect[i - 1].y ?? NaN);
          if (!Number.isFinite(totalEffect[i].y)) {
            totalEffect[i].y = null;
          }
        }
        // Remove value for first year since it's not a delta
        totalEffect.shift();

        chart.push({
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

  // Secondary goal
  if (secondaryGoal?.dataSeries) {
    const secondarySeries = [];
    const secondaryDataSeries = dataSeriesToDateValues(secondaryGoal.dataSeries);
    const dates = Object.keys(secondaryDataSeries.dateValues).sort();
    if (!dates.every(d => isISOIshDate(d))) {
      throw new Error("Invalid date found in secondary goal data series when generating main delta graph.");
    }

    for (let i = 1; i < dates.length; i++) {
      const currentField = dates[i];
      const previousField = dates[i - 1];

      const currentValue = secondaryDataSeries.dateValues[currentField] ?? NaN;
      const previousValue = secondaryDataSeries.dateValues[previousField] ?? NaN;

      const value = currentValue - previousValue;

      secondarySeries.push({
        x: new Date(currentField).getTime(),
        y: Number.isFinite(value) ? value : null,
      });
    }
    chart.push({
      name: secondaryGoal.name || secondaryGoal.indicatorParameter,
      data: secondarySeries,
      type: 'line',
    });
    // Place secondary series on separate scale if it doesn't share unit with main
    if (secondaryGoal.dataSeries.unit != goal.dataSeries.unit) {
      (chartOptions.yaxis as ApexYAxis[]).push({
        title: {
          text: t("graphs:main_delta_graph.annual_change", { unit: secondaryGoal.dataSeries.unit?.toLowerCase() == 'procent' ? t("graphs:main_delta_graph.percentage_points") : secondaryGoal.dataSeries.unit === null ? t("common:tsx.unitless") : secondaryGoal.dataSeries.unit || t("common:tsx.unit_missing") })
        },
        labels: { formatter: graphNumberFormatter },
        seriesName: secondaryGoal.name || secondaryGoal.indicatorParameter,
        opposite: true,
      });
    }

    colors.push(color_palette.secondaryGoal.color);
    opacities.push(color_palette.secondaryGoal.fillOpacity)
  }

  // National goal
  if (parentGoal?.dataSeries) {
    const parentSeries = []
    const parentDataSeries = dataSeriesToDateValues(parentGoal.dataSeries);
    const dates = Object.keys(parentDataSeries.dateValues).sort();
    if (!dates.every(d => isISOIshDate(d))) {
      throw new Error("Invalid date found in parent goal data series when generating main delta graph.");
    }

    for (let i = 1; i < dates.length; i++) {
      const currentField = dates[i];
      const previousField = dates[i - 1];

      const currentValue = parentDataSeries.dateValues[currentField] ?? NaN;
      const previousValue = parentDataSeries.dateValues[previousField] ?? NaN;

      const value = currentValue - previousValue;
      parentSeries.push({
        x: new Date(currentField.replace('val', '')).getTime(),
        y: Number.isFinite(value) ? value : null,
      });
    }
    chart.push({
      name: t("graphs:common.parent_counterpart", { parent: parentGoalRoadmap?.metaRoadmap.name || "" }),
      data: parentSeries,
      type: 'line',
    });

    colors.push(color_palette.parentGoal.color);
    opacities.push(color_palette.parentGoal.fillOpacity)
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
  );
}