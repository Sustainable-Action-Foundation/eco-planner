"use client";

import { calculatePredictedOutcome } from "@/components/graphs/functions/graphFunctions";
import WrappedChart, { floatSmoother } from "@/lib/chartWrapper";
import { dataSeriesDataFieldNames } from "@/types";
import { Goal, DataSeries, Effect } from "@prisma/client";
import { useTranslation } from "react-i18next";

export default function MainDeltaGraph({
  goal,
  secondaryGoal,
  nationalGoal,
  effects,
}: {
  goal: Goal & { dataSeries: DataSeries | null, baselineDataSeries: DataSeries | null },
  secondaryGoal: Goal & { dataSeries: DataSeries | null } | null,
  nationalGoal: Goal & { dataSeries: DataSeries | null } | null,
  effects: (Effect & { dataSeries: DataSeries | null })[],
}) {
  const { t } = useTranslation();

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
      min: new Date(dataSeriesDataFieldNames[0].replace('val', '')).getTime(),
      max: new Date(dataSeriesDataFieldNames[dataSeriesDataFieldNames.length - 1].replace('val', '')).getTime()
    },
    yaxis: [{
      title: {
        text: t("components:main_delta_graph.annual_change", { unit: goal.dataSeries.unit.toLowerCase() == 'procent' ? t("components:main_delta_graph.percentage_points") : goal.dataSeries.unit })
      },
      labels: { formatter: floatSmoother },
      seriesName: [
        (goal.name || goal.indicatorParameter).split('\\').slice(-1)[0],
        t("components:main_delta_graph.baseline_scenario"),
        t("components:main_delta_graph.expected_outcome"),
        (secondaryGoal?.dataSeries?.unit == goal.dataSeries.unit) ? (secondaryGoal?.name || secondaryGoal?.indicatorParameter) : '',
        t("components:main_delta_graph.national_counterpart"),
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
  for (let i = 1; i < dataSeriesDataFieldNames.length; i++) {
    const currentField = dataSeriesDataFieldNames[i];
    const previousField = dataSeriesDataFieldNames[i - 1];

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
    for (let i = 1; i < dataSeriesDataFieldNames.length; i++) {
      const currentField = dataSeriesDataFieldNames[i];
      const previousField = dataSeriesDataFieldNames[i - 1];

      const currentValue = goal.baselineDataSeries[currentField] ?? NaN;
      const previousValue = goal.baselineDataSeries[previousField] ?? NaN;

      const value = currentValue - previousValue;

      baselineSeries.push({
        x: new Date(currentField.replace('val', '')).getTime(),
        y: Number.isFinite(value) ? value : null,
      });
    }
    chart.push({
      name: t("components:main_delta_graph.baseline_scenario"),
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
        name: t("components:main_delta_graph.expected_outcome"),
        data: totalEffect,
        type: 'line',
      });
    }
  } else if (effects.length > 0) {
    // If no baseline is set, use the first non-null value as baseline
    const firstNonNull = dataSeriesDataFieldNames.find(i => goal.dataSeries && Number.isFinite(goal.dataSeries[i]));

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
          name: t("components:main_delta_graph.expected_outcome"),
          data: totalEffect,
          type: 'line',
        });
      }
    }
  }

  // Secondary goal
  if (secondaryGoal?.dataSeries) {
    const nationalSeries = [];
    for (let i = 1; i < dataSeriesDataFieldNames.length; i++) {
      const currentField = dataSeriesDataFieldNames[i];
      const previousField = dataSeriesDataFieldNames[i - 1];

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
          text: t("components:main_delta_graph.annual_change", { unit: secondaryGoal.dataSeries.unit.toLowerCase() == 'procent' ? t("components:main_delta_graph.percentage_points") : secondaryGoal.dataSeries.unit })
        },
        labels: { formatter: floatSmoother },
        seriesName: secondaryGoal.name || secondaryGoal.indicatorParameter,
        opposite: true,
      });
    }
  }

  // National goal
  if (nationalGoal?.dataSeries) {
    const nationalSeries = []
    for (let i = 1; i < dataSeriesDataFieldNames.length; i++) {
      const currentField = dataSeriesDataFieldNames[i];
      const previousField = dataSeriesDataFieldNames[i - 1];

      const currentValue = nationalGoal.dataSeries[currentField] ?? NaN;
      const previousValue = nationalGoal.dataSeries[previousField] ?? NaN;

      const value = currentValue - previousValue;
      nationalSeries.push({
        x: new Date(currentField.replace('val', '')).getTime(),
        y: Number.isFinite(value) ? value : null,
      });
    }
    chart.push({
      name: t("components:main_delta_graph.national_counterpart"),
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