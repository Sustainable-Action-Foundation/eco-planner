import WrappedChart, { floatSmoother } from "@/lib/chartWrapper";
import { dataSeriesDataFieldNames } from "@/types";
import { Goal, DataSeries } from "@prisma/client";
import styles from '../graphs.module.css';

export default function MainDeltaGraph({
  goal,
  secondaryGoal,
  nationalGoal,
}: {
  goal: Goal & { dataSeries: DataSeries | null },
  secondaryGoal: Goal & { dataSeries: DataSeries | null } | null,
  nationalGoal: Goal & { dataSeries: DataSeries | null } | null,
}) {
  if (!goal.dataSeries) {
    return null
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
    yaxis: [{
      title: { text: `Årlig förändring i ${goal.dataSeries.unit.toLowerCase() == 'procent' ? 'procentenheter' : goal.dataSeries.unit}` },
      labels: { formatter: floatSmoother },
    }],
    tooltip: {
      x: { format: 'yyyy' },
    },
  }

  const chart: ApexAxisChartSeries = [];

  // Local goal
  const mainSeries = []
  // Start at 1 to skip the first value
  for (let i = 1; i < dataSeriesDataFieldNames.length; i++) {
    const currentField = dataSeriesDataFieldNames[i]
    const previousField = dataSeriesDataFieldNames[i - 1]
    if (goal.dataSeries[currentField] && goal.dataSeries[previousField]) {
      mainSeries.push({
        x: new Date(currentField.replace('val', '')).getTime(),
        y: goal.dataSeries[currentField]! - goal.dataSeries[previousField]!
      })
    }
  }
  chart.push({
    name: (goal.name || goal.indicatorParameter).split('\\').slice(-1)[0],
    data: mainSeries,
    type: 'line',
  })

  // Secondary goal
  if (secondaryGoal?.dataSeries) {
    const nationalSeries = []
    for (let i = 1; i < dataSeriesDataFieldNames.length; i++) {
      const currentField = dataSeriesDataFieldNames[i]
      const previousField = dataSeriesDataFieldNames[i - 1]
      if (secondaryGoal.dataSeries[currentField] && secondaryGoal.dataSeries[previousField]) {
        nationalSeries.push({
          x: new Date(currentField.replace('val', '')).getTime(),
          y: secondaryGoal.dataSeries[currentField]! - secondaryGoal.dataSeries[previousField]!
        })
      }
    }
    chart.push({
      name: secondaryGoal.name || secondaryGoal.indicatorParameter,
      data: nationalSeries,
      type: 'line',
    });
    // Place secondary series on separate scale if it doesn't share unit with main
    if (secondaryGoal.dataSeries.unit != goal.dataSeries.unit) {
      (chartOptions.yaxis as ApexYAxis[]).push({
        title: { text: `Årlig förändring i ${secondaryGoal.dataSeries.unit.toLowerCase() == 'procent' ? 'procentenheter' : secondaryGoal.dataSeries.unit}` },
        labels: { formatter: floatSmoother },
        opposite: true,
      });
    }
  }

  // National goal
  if (nationalGoal?.dataSeries) {
    const nationalSeries = []
    for (let i = 1; i < dataSeriesDataFieldNames.length; i++) {
      const currentField = dataSeriesDataFieldNames[i]
      const previousField = dataSeriesDataFieldNames[i - 1]
      if (nationalGoal.dataSeries[currentField] && nationalGoal.dataSeries[previousField]) {
        nationalSeries.push({
          x: new Date(currentField.replace('val', '')).getTime(),
          y: nationalGoal.dataSeries[currentField]! - nationalGoal.dataSeries[previousField]!
        })
      }
    }
    chart.push({
      name: 'Nationell motsvarighet',
      data: nationalSeries,
      type: 'line',
    })
  }

  return (
    <>
      <div className={styles.graphWrapper}>
        <WrappedChart
          options={chartOptions}
          series={chart}
          type="line"
          width="100%"
          height="100%"
        />
      </div>
    </>
  );
}