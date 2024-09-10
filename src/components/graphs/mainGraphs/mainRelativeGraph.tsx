import WrappedChart, { floatSmoother } from "@/lib/chartWrapper";
import { dataSeriesDataFieldNames, DataSeriesDataFields } from "@/types";
import { Goal, DataSeries } from "@prisma/client";
import styles from '../graphs.module.css';

export default function MainRelativeGraph({
  goal,
  secondaryGoal,
  nationalGoal,
}: {
  goal: Goal & { dataSeries: DataSeries | null },
  secondaryGoal: Goal & { dataSeries: DataSeries | null } | null,
  nationalGoal: Goal & { dataSeries: DataSeries | null } | null,
}) {
  if (!goal.dataSeries || goal.dataSeries.unit.toLowerCase() == "procent" || goal.dataSeries.unit.toLowerCase() == "andel") {
    return null
  }

  const chart: ApexAxisChartSeries = [];

  // Local goal
  const mainSeries = []
  for (const i in dataSeriesDataFieldNames) {
    const currentField = dataSeriesDataFieldNames[i]
    const baseValue = goal.dataSeries[dataSeriesDataFieldNames[0]]
    if (goal.dataSeries[currentField] && baseValue) {
      mainSeries.push({
        x: new Date(currentField.replace('val', '')).getTime(),
        y: (goal.dataSeries[currentField]! / baseValue) * 100
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
    const secondarySeries = []
    for (const i in dataSeriesDataFieldNames) {
      const currentField = dataSeriesDataFieldNames[i]
      const baseValue = secondaryGoal.dataSeries[dataSeriesDataFieldNames[0]]
      if (secondaryGoal.dataSeries[currentField] && baseValue) {
        secondarySeries.push({
          x: new Date(currentField.replace('val', '')).getTime(),
          y: (secondaryGoal.dataSeries[currentField]! / baseValue) * 100
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
    const nationalSeries = []
    for (const i in dataSeriesDataFieldNames) {
      const currentField = dataSeriesDataFieldNames[i]
      const baseValue = nationalGoal.dataSeries[dataSeriesDataFieldNames[0]]
      if (nationalGoal.dataSeries[currentField] && baseValue) {
        nationalSeries.push({
          x: new Date(currentField.replace('val', '')).getTime(),
          y: (nationalGoal.dataSeries[currentField]! / baseValue) * 100
        })
      }
    }
    chart.push({
      name: 'Nationell motsvarighet',
      data: nationalSeries,
      type: 'line',
    })
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
  )
}