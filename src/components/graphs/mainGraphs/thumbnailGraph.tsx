import WrappedChart from "@/lib/chartWrapper";
import { Years } from "@/types";
import { DataSeries, Goal } from "@prisma/client";
import styles from '../graphs.module.css'

export default function ThumbnailGraph({
  goal,
}: {
  goal: Goal & { dataSeries: DataSeries | null },
}) {
  if (!goal.dataSeries) {
    return null;
  }

  const mainChart: ApexAxisChartSeries = [];
  const mainSeries = [];
  for (const i of Years) {
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
  });

  const mainChartOptions: ApexCharts.ApexOptions = {
    chart: {
      type: 'line',
      animations: { enabled: false, dynamicAnimation: { enabled: false } },
      zoom: {
        enabled: false,
      },
      toolbar: {
        show: false,
      },
    },
    tooltip: { enabled: false },
    stroke: { curve: 'straight' },
    xaxis: {
      type: 'datetime',
      labels: { format: 'yyyy' },
      tooltip: { enabled: false },
      min: new Date(Years[0].replace('val', '')).getTime(),
      max: new Date(Years[Years.length - 1].replace('val', '')).getTime()
      // categories: dataSeriesDataFieldNames.map(name => name.replace('val', ''))
    },
    yaxis: {
      show: false
    }
  }

  return (
    <>
      <div className={styles.graphWrapperThumbnail}>
        <h3 className="font-weight-500 margin-0 padding-top-75 text-align-center">
          {goal.name}
        </h3> {/* TODO: Make conditional */}
        <div style={{ height: '200px' }}>
          <WrappedChart
            options={mainChartOptions}
            series={mainChart}
            type="line"
            width="100%"
            height="200px"
          />
        </div>
      </div>
    </>
  )
}