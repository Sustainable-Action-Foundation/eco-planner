import getOneGoal from "@/functions/getOneGoal";
import WrappedChart, { floatSmoother } from "@/lib/chartWrapper";
import { DataSeriesDataFields, dataSeriesDataFieldNames } from "@/types";
import { DataSeries, Goal } from "@prisma/client";

export default async function MainGraph({
  goal,
}: {
  goal: Goal & { dataSeries: DataSeries | null },
}) {
  if (!goal.dataSeries) {
    return null
  }

  let nationalGoal: Goal & { dataSeries: DataSeries | null } | null = null;
  if (goal.nationalGoalId) {
    nationalGoal = await getOneGoal(goal.nationalGoalId)
  }

  let mainChart: ApexAxisChartSeries = [];
  if (goal.dataSeries) {
    let mainSeries = []
    for (let i of dataSeriesDataFieldNames) {
      if (goal.dataSeries[i as keyof DataSeriesDataFields]) {
        mainSeries.push({
          x: new Date(i.replace('val', '')).getTime(),
          y: goal.dataSeries[i as keyof DataSeriesDataFields]
        })
      }
    }
    mainChart.push({
      name: (goal.name || goal.indicatorParameter).split('\\').slice(-1)[0],
      data: mainSeries,
      type: 'line',
    })
  }

  if (nationalGoal?.dataSeries) {
    let nationalSeries = []
    for (let i of dataSeriesDataFieldNames) {
      if (nationalGoal.dataSeries[i as keyof DataSeriesDataFields]) {
        nationalSeries.push({
          x: new Date(i.replace('val', '')).getTime(),
          y: nationalGoal.dataSeries[i as keyof DataSeriesDataFields]
        })
      }
    }
    mainChart.push({
      name: 'Nationell motsvarighet',
      data: nationalSeries,
      type: 'line',
    })
  }

  let mainChartOptions: ApexCharts.ApexOptions = {
    chart: { type: 'line' },
    stroke: { curve: 'straight' },
    xaxis: {
      type: 'datetime',
      labels: { format: 'yyyy' },
      tooltip: { enabled: false },
      min: new Date(dataSeriesDataFieldNames[0].replace('val', '')).getTime(),
      max: new Date(dataSeriesDataFieldNames[dataSeriesDataFieldNames.length - 1].replace('val', '')).getTime()
      // categories: dataSeriesDataFieldNames.map(name => name.replace('val', ''))
    },
    yaxis: {
      title: { text: goal.dataSeries?.unit },
      labels: { formatter: floatSmoother },
    },
    tooltip: {
      x: { format: 'yyyy' },
    },
  }

  return (
    <>
      <h2>Målbana</h2>
      <WrappedChart
        options={mainChartOptions}
        series={mainChart}
        type="line"
        width="90%"
        height="500"
      />
    </>
  )
}