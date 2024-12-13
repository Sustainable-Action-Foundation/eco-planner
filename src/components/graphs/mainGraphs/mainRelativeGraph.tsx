import WrappedChart, { floatSmoother } from "@/lib/chartWrapper";
import { dataSeriesDataFieldNames } from "@/types";
import { Goal, DataSeries } from "@prisma/client";

export default function MainRelativeGraph({
  goal,
  secondaryGoal,
  nationalGoal,
}: {
  goal: Goal & { dataSeries: DataSeries | null },
  secondaryGoal: Goal & { dataSeries: DataSeries | null } | null,
  nationalGoal: Goal & { dataSeries: DataSeries | null } | null,
}) {
  if (!goal.dataSeries || ["procent", "percent", "andel", "ratio", "fraction"].includes(goal.dataSeries.unit.toLowerCase())) {
    return null;
  }

  const chart: ApexAxisChartSeries = [];

  // Local goal
  const mainSeries = [];
  const mainFirstNonNull = dataSeriesDataFieldNames.find(i => goal.dataSeries![i] != null && goal.dataSeries![i] !== 0);
  let mainBaseValue: number | null = null;
  if (mainFirstNonNull) {
    mainBaseValue = goal.dataSeries[mainFirstNonNull];
  }
  for (const i of dataSeriesDataFieldNames) {
    if (goal.dataSeries[i] != null && mainBaseValue) {
      mainSeries.push({
        x: new Date(i.replace('val', '')).getTime(),
        y: (goal.dataSeries[i]! / mainBaseValue) * 100
      });
    }
  }
  chart.push({
    name: (goal.name || goal.indicatorParameter).split('\\').slice(-1)[0],
    data: mainSeries,
    type: 'line',
  });

  // Secondary goal
  if (secondaryGoal?.dataSeries) {
    const secondarySeries = [];
    const firstNonNullOrZero = dataSeriesDataFieldNames.find(i => secondaryGoal.dataSeries![i] != null && secondaryGoal.dataSeries![i] !== 0);
    let baseValue: number | null = null;
    if (firstNonNullOrZero) {
      baseValue = secondaryGoal.dataSeries[firstNonNullOrZero];
    }
    for (const i of dataSeriesDataFieldNames) {
      if (secondaryGoal.dataSeries[i] != null && baseValue) {
        secondarySeries.push({
          x: new Date(i.replace('val', '')).getTime(),
          y: (secondaryGoal.dataSeries[i]! / baseValue) * 100
        })
      }
    }
    chart.push({
      name: secondaryGoal.name || secondaryGoal.indicatorParameter,
      data: secondarySeries,
      type: 'line',
    })
  }

  // National goal
  if (nationalGoal?.dataSeries) {
    const nationalSeries = [];
    const firstNonNullOrZero = dataSeriesDataFieldNames.find(i => nationalGoal.dataSeries![i] != null && nationalGoal.dataSeries![i] !== 0);
    let baseValue: number | null = null;
    if (firstNonNullOrZero) {
      baseValue = nationalGoal.dataSeries[firstNonNullOrZero];
    }
    for (const i of dataSeriesDataFieldNames) {
      if (nationalGoal.dataSeries[i] != null && baseValue) {
        nationalSeries.push({
          x: new Date(i.replace('val', '')).getTime(),
          y: (nationalGoal.dataSeries[i]! / baseValue) * 100
        });
      }
    }
    chart.push({
      name: 'Nationell motsvarighet',
      data: nationalSeries,
      type: 'line',
    });
  }

  const chartOptions: ApexCharts.ApexOptions = {
    chart: {
      type: 'line',
      animations: { enabled: false, dynamicAnimation: { enabled: false } }
    },
    stroke: { curve: 'straight' },
    xaxis: {
      type: 'datetime',
      labels: { format: 'yyyy' },
      tooltip: { enabled: false },
      min: new Date(dataSeriesDataFieldNames[0].replace('val', '')).getTime(),
      max: new Date(dataSeriesDataFieldNames[dataSeriesDataFieldNames.length - 1].replace('val', '')).getTime()
    },
    yaxis: {
      title: { text: "procent relativt basår" },
      labels: { formatter: floatSmoother },
    },
    tooltip: {
      x: { format: 'yyyy' },
    },
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
  )
}