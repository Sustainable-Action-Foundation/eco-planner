"use client";

import { calculatePredictedOutcome } from "@/components/graphs/functions/graphFunctions";
import WrappedChart, { graphNumberFormatter } from "@/lib/chartWrapper";
import { Years } from "@/types";
import type { Goal, DataSeries, Effect, MetaRoadmap, Roadmap } from "@prisma/client";
import { useTranslation } from "react-i18next";

export default function MainDeltaGraph({
  goal,
  secondaryGoal,
  parentGoal,
  parentGoalRoadmap,
  effects,
}: {
  goal: Goal & { dataSeries: DataSeries | null, baselineDataSeries: DataSeries | null },
  secondaryGoal: Goal & { dataSeries: DataSeries | null } | null,
  parentGoal: Goal & { dataSeries: DataSeries | null } | null,
  parentGoalRoadmap: Roadmap & { metaRoadmap: MetaRoadmap } | null,
  effects: (Effect & { dataSeries: DataSeries | null })[],
}) {
  const { t } = useTranslation("graphs");

  if (!goal.dataSeries) {
    return null
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
      min: new Date(Years[0].replace('val', '')).getTime(),
      max: new Date(Years[Years.length - 1].replace('val', '')).getTime()
    },
    yaxis: [{
      title: {
        text: t("graphs:main_delta_graph.annual_change", { unit: goal.dataSeries.unit?.toLowerCase() == 'procent' ? t("graphs:main_delta_graph.percentage_points") : goal.dataSeries.unit === null ? t("common:tsx.unitless") : goal.dataSeries.unit || t("common:tsx.unit_missing") })
      },
      labels: { formatter: graphNumberFormatter },
      seriesName: [
        (goal.name || goal.indicatorParameter).split('\\').slice(-1)[0],
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
  // Start at 1 to skip the first value
  for (let i = 1; i < Years.length; i++) {
    const currentField = Years[i];
    const previousField = Years[i - 1];

    const currentValue = goal.dataSeries[currentField] ?? NaN;
    const previousValue = goal.dataSeries[previousField] ?? NaN;

    const value = currentValue - previousValue;

    mainSeries.push({
      x: new Date(currentField.replace('val', '')).getTime(),
      y: Number.isFinite(value) ? value : null,
    });
  }
  chart.push({
    name: (goal.name || goal.indicatorParameter).split('\\').slice(-1)[0],
    data: mainSeries,
    type: 'line',
  });

  if (goal.baselineDataSeries) {
    // Baseline / predicted outcome without actions/effects
    const baselineSeries = [];
    for (let i = 1; i < Years.length; i++) {
      const currentField = Years[i];
      const previousField = Years[i - 1];

      const currentValue = goal.baselineDataSeries[currentField] ?? NaN;
      const previousValue = goal.baselineDataSeries[previousField] ?? NaN;

      const value = currentValue - previousValue;

      baselineSeries.push({
        x: new Date(currentField.replace('val', '')).getTime(),
        y: Number.isFinite(value) ? value : null,
      });
    }
    chart.push({
      name: t("graphs:common.baseline_scenario"),
      data: baselineSeries,
      type: 'line',
    });

    const totalEffect = calculatePredictedOutcome(effects, goal.baselineDataSeries);

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
    }
  } else if (effects.length > 0) {
    // If no baseline is set, use the first non-null value as baseline
    const firstNonNull = Years.find(i => goal.dataSeries && Number.isFinite(goal.dataSeries[i]));

    if (firstNonNull) {
      // Since the baseline is a single value, it won't have any delta year-to-year, so only draw effects

      const totalEffect = calculatePredictedOutcome(effects, goal.dataSeries[firstNonNull] as number);

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
      }
    }
  }

  // Secondary goal
  if (secondaryGoal?.dataSeries) {
    const nationalSeries = [];
    for (let i = 1; i < Years.length; i++) {
      const currentField = Years[i];
      const previousField = Years[i - 1];

      const currentValue = secondaryGoal.dataSeries[currentField] ?? NaN;
      const previousValue = secondaryGoal.dataSeries[previousField] ?? NaN;

      const value = currentValue - previousValue;

      nationalSeries.push({
        x: new Date(currentField.replace('val', '')).getTime(),
        y: Number.isFinite(value) ? value : null,
      });
    }
    chart.push({
      name: secondaryGoal.name || secondaryGoal.indicatorParameter,
      data: nationalSeries,
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
  }

  // National goal
  if (parentGoal?.dataSeries) {
    const nationalSeries = []
    for (let i = 1; i < Years.length; i++) {
      const currentField = Years[i];
      const previousField = Years[i - 1];

      const currentValue = parentGoal.dataSeries[currentField] ?? NaN;
      const previousValue = parentGoal.dataSeries[previousField] ?? NaN;

      const value = currentValue - previousValue;
      nationalSeries.push({
        x: new Date(currentField.replace('val', '')).getTime(),
        y: Number.isFinite(value) ? value : null,
      });
    }
    chart.push({
      name: t("graphs:common.parent_counterpart", { parent: parentGoalRoadmap?.metaRoadmap.name || "" }),
      data: nationalSeries,
      type: 'line',
    });
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