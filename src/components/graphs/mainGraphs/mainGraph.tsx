"use client";

import WrappedChart, { floatSmoother } from "@/lib/chartWrapper";
import { dataSeriesDataFieldNames } from "@/types";
import { DataSeries, Effect, Goal } from "@prisma/client";
import { parsePeriod } from "@/lib/api/utility";
import { calculatePredictedOutcome } from "@/components/graphs/functions/graphFunctions";
import { ApiTableContent } from "@/lib/api/apiTypes";
import { useTranslation } from "react-i18next";

export default function MainGraph({
  goal,
  secondaryGoal,
  nationalGoal,
  historicalData,
  effects,
}: {
  goal: Goal & { dataSeries: DataSeries | null, baselineDataSeries: DataSeries | null },
  secondaryGoal: Goal & { dataSeries: DataSeries | null } | null,
  nationalGoal: Goal & { dataSeries: DataSeries | null } | null,
  historicalData?: ApiTableContent | null,
  effects: (Effect & { dataSeries: DataSeries | null })[],
}) {
  const { t } = useTranslation();

  if (!goal.dataSeries) {
    return null;
  }

  const mainChartOptions: ApexCharts.ApexOptions = {
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
      // categories: dataSeriesDataFieldNames.map(name => name.replace('val', ''))
    },
    yaxis: [
      {
        title: { text: goal.dataSeries?.unit },
        labels: { formatter: floatSmoother },
        seriesName: [
          (goal.name || goal.indicatorParameter).split('\\').slice(-1)[0],
          t("graphs:main_graph.baseline_scenario"),
          t("graphs:main_graph.expected_outcome"),
          (secondaryGoal?.dataSeries?.unit == goal.dataSeries.unit) ? (secondaryGoal.name || secondaryGoal.indicatorParameter).split('\\').slice(-1)[0] : "",
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
  const mainSeries = [];
  for (const i of dataSeriesDataFieldNames) {
    const value = goal.dataSeries[i];

    mainSeries.push({
      x: new Date(i.replace('val', '')).getTime(),
      y: Number.isFinite(value) ? value : null,
    });
  }
  mainChart.push({
    name: (goal.name || goal.indicatorParameter).split('\\').slice(-1)[0],
    data: mainSeries,
    type: 'line',
  })

  if (goal.baselineDataSeries) {
    // Predicted outcome without actions/effects
    const baseline = [];
    for (const i of dataSeriesDataFieldNames) {
      const value = goal.baselineDataSeries[i];

      baseline.push({
        x: new Date(i.replace('val', '')).getTime(),
        y: Number.isFinite(value) ? value : null,
      });
    }
    mainChart.push({
      name: t("graphs:main_graph.baseline_scenario"),
      data: baseline,
      type: 'line',
    })

    if (effects.length > 0) {
      const totalEffect = calculatePredictedOutcome(effects, goal.baselineDataSeries)

      // Line based on totalEffect + baseline
      if (totalEffect.length > 0) {
        mainChart.push({
          name: t("graphs:main_graph.expected_outcome"),
          data: totalEffect,
          type: 'line',
        });
      }
    }
  } else if (effects.length > 0) {
    // If no baseline is set, use the first non-null value as baseline
    const firstNonNull = dataSeriesDataFieldNames.find(i => goal.dataSeries && Number.isFinite((goal.dataSeries)[i]));

    if (firstNonNull) {
      const totalEffect = calculatePredictedOutcome(effects, goal.dataSeries[firstNonNull] as number)

      // Only draw if totalEffect has values
      if (totalEffect.length > 0) {
        // Flat line based on goal.dataSeries[firstNonNull]
        const baseline = [];
        for (const i of dataSeriesDataFieldNames) {
          baseline.push({
            x: new Date(i.replace('val', '')).getTime(),
            y: goal.dataSeries[firstNonNull]
          });
        }
        mainChart.push({
          name: t("graphs:main_graph.baseline_scenario"),
          data: baseline,
          type: 'line',
        });

        // Line based on totalEffect
        mainChart.push({
          name: t("graphs:main_graph.expected_outcome"),
          data: totalEffect,
          type: 'line',
        });
      }
    }
  }

  if (secondaryGoal?.dataSeries) {
    const secondarySeries = [];
    for (const i of dataSeriesDataFieldNames) {
      const value = secondaryGoal.dataSeries[i];

      secondarySeries.push({
        x: new Date(i.replace('val', '')).getTime(),
        y: Number.isFinite(value) ? value : null,
      });
    }
    mainChart.push({
      name: secondaryGoal.name || secondaryGoal.indicatorParameter,
      data: secondarySeries,
      type: 'line',
    });
    // Place secondary and main series on different scales if they don't share the same unit
    // TODO: Use mathjs to see if the units are the same, rather than just comparing strings
    if (secondaryGoal.dataSeries.unit != goal.dataSeries.unit) {
      (mainChartOptions.yaxis as ApexYAxis[]).push({
        title: { text: `${t("graphs:main_graph.secondary_goal", { unit: secondaryGoal.dataSeries.unit })}` },
        labels: { formatter: floatSmoother },
        seriesName: [(secondaryGoal.name || secondaryGoal.indicatorParameter).split('\\').slice(-1)[0]],
        opposite: true,
      });
    }
  }

  if (nationalGoal?.dataSeries) {
    const nationalSeries = [];
    for (const i of dataSeriesDataFieldNames) {
      const value = nationalGoal.dataSeries[i];

      nationalSeries.push({
        x: new Date(i.replace('val', '')).getTime(),
        y: Number.isFinite(value) ? value : null,
      });
    }
    mainChart.push({
      name: t("graphs:main_graph.national_counterpart"),
      data: nationalSeries,
      type: 'line',
    });
    (mainChartOptions.yaxis as ApexYAxis[]).push({
      title: { text: t("graphs:main_graph.national_goal") },
      labels: { formatter: floatSmoother },
      seriesName: [t("graphs:main_graph.national_counterpart")],
      opposite: true,
    });
  }

  if (historicalData) {
    const historicalSeries = [];
    const timeColumnIndex = historicalData.columns.findIndex(column => column.type == "t");

    if (timeColumnIndex >= 0) {
      for (const row of historicalData.data) {
        const value = parseFloat(row.values[0]);

        historicalSeries.push({
          x: parsePeriod(row.key[timeColumnIndex].value).getTime(),
          y: Number.isFinite(value) ? value : null,
        });
      }
      mainChart.push({
        name: `${historicalData.metadata[0]?.label}`,
        data: historicalSeries,
        type: 'line',
      });
      (mainChartOptions.yaxis as ApexYAxis[]).push({
        title: { text: t("graphs:main_graph.history") },
        labels: { formatter: floatSmoother },
        seriesName: [`${historicalData.metadata[0]?.label}`],
        opposite: true,
      });
    }
  }

  return (
    <>
      <WrappedChart
        options={mainChartOptions}
        series={mainChart}
        type="line"
        width="100%"
        height="100%"
      />
    </>
  )
}