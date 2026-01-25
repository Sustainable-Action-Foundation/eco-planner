"use client";

import WrappedChart, { graphNumberFormatter } from "@/lib/chartWrapper";
import type { Effect, MetaRoadmap, Roadmap } from "@prisma/client";
import { parsePeriod } from "@/lib/api/utility";
import { calculatePredictedOutcome } from "@/components/graphs/functions/graphFunctions";
import { ApiTableContent } from "@/lib/api/apiTypes";
import { useTranslation } from "react-i18next";
import { Goal } from "@/types";

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
  parentGoalRoadmap: Roadmap & { metaRoadmap: MetaRoadmap } | null,
  historicalData?: ApiTableContent | null,
  effects: Effect[],
}) {
  const { t } = useTranslation("graphs");

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
      min: new Date("2020-01-01T00:00:00Z").getTime(),
      max: new Date("2050-01-01T00:00:00Z").getTime()
    },
    yaxis: [
      {
        title: { text: goal.dataSeries.unit === null ? t("common:tsx.unitless") : goal.dataSeries.unit || t("common:tsx.unit_missing") },
        labels: { formatter: graphNumberFormatter },
        seriesName: [
          (goal.name || goal.indicatorParameter).split('\\').slice(-1)[0],
          t("graphs:common.baseline_scenario"),
          t("graphs:common.expected_outcome"),
          (secondaryGoal?.dataSeries?.unit === goal.dataSeries.unit) ? (secondaryGoal.name || secondaryGoal.indicatorParameter).split('\\').slice(-1)[0] : "",
          historicalData ? `${historicalData.metadata[0]?.label}` : "",
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
  const mainSeries: { x: number; y: number; }[] = [];
  for (const dateEntry of goal.dataSeries.values) {
    mainSeries.push({
      x: dateEntry.timestamp.getTime(),
      y: dateEntry.value,
    });
  }

  mainChart.push({
    name: (goal.name ?? goal.indicatorParameter).split('\\').at(-1),
    data: mainSeries,
    type: 'line',
  })

  if (goal.baseline) {
    // Predicted outcome without actions/effects
    const baseline = [];
    for (const dateEntry of goal.baseline.values) {
      baseline.push({
        x: dateEntry.timestamp.getTime(),
        y: dateEntry.value,
      });
    }
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
    }
  } else if (effects.length > 0) {
    // If no baseline is set, use the first non-null value as baseline
    const firstNonNull = Years.find(i => goal.dataSeries && Number.isFinite((goal.dataSeries)[i]));

    if (firstNonNull) {
      const totalEffect = calculatePredictedOutcome(effects, goal.dataSeries[firstNonNull] as number)

      // Only draw if totalEffect has values
      if (totalEffect.length > 0) {
        // Flat line based on goal.dataSeries[firstNonNull]
        const baseline = [];
        for (const i of Years) {
          baseline.push({
            x: new Date(i.replace('val', '')).getTime(),
            y: goal.dataSeries[firstNonNull]
          });
        }
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
      }
    }
  }

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
        name: `${historicalData.metadata[0]?.label}`,
        data: historicalSeries,
        type: 'line',
      });
    }
  }

  if (secondaryGoal?.dataSeries) {
    const secondarySeries = [];
    for (const i of Years) {
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
        labels: { formatter: graphNumberFormatter },
        seriesName: [(secondaryGoal.name || secondaryGoal.indicatorParameter).split('\\').slice(-1)[0]],
        opposite: true,
      });
    }
  }

  if (parentGoal?.dataSeries) {
    const nationalSeries = [];
    for (const i of Years) {
      const value = parentGoal.dataSeries[i];

      nationalSeries.push({
        x: new Date(i.replace('val', '')).getTime(),
        y: Number.isFinite(value) ? value : null,
      });
    }
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