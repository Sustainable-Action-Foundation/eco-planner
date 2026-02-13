"use client";

import WrappedChart, { graphNumberFormatter } from "@/lib/chartWrapper";
import type { Goal, Roadmap } from "@/types";
import { parsePeriod } from "@/lib/api/utility";
import { calculatePredictedOutcome } from "@/components/graphs/functions/graphFunctions";
import { ApiTableContent } from "@/lib/api/apiTypes";
import { useTranslation } from "react-i18next";
import { dataSeriesToDateValues } from "@/functions/recipe/extractors";

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

  const mainChartOptions: ApexCharts.ApexOptions = {
    chart: {
      type: 'line',
      animations: { enabled: false, dynamicAnimation: { enabled: false } },
      zoom: { allowMouseWheelZoom: false },
    },
    colors: ['#0090ff', '#2e8a56', 'red', 'orange'],
    fill: {
      type: 'solid',
      opacity: [1, 0.3, 1, 1],
      colors: ['#0090ff', '#2e8a56', 'red', 'orange'],
    },
    stroke: { curve: 'straight', width: 3 },
    markers: { size: 3 },
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
      });
    }
    console.log(historicalSeries)
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
    }
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
    if (secondaryGoal.dataSeries.unit != goal.dataSeries.unit) {
      (mainChartOptions.yaxis as ApexYAxis[]).push({
        title: { text: `${t("graphs:main_graph.secondary_goal", { unit: secondaryGoal.dataSeries.unit })}` },
        labels: { formatter: graphNumberFormatter },
        seriesName: [(secondaryGoal.name || secondaryGoal.indicatorParameter).split('\\').slice(-1)[0]],
        opposite: true,
      });
    }
  }

  if (parentGoal?.dataSeries) { /* TODO: See if we need to add an additinal colour for this */
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