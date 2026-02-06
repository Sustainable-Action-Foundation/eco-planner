import WrappedChart from "@/lib/chartWrapper";
import styles from '../graphs.module.css'
import { Goal } from "@/types";

export default function ThumbnailGraph({
  goal,
}: {
  goal: Goal;
}) {
  if (!goal.dataSeries) {
    return null;
  }

  const mainChart: ApexAxisChartSeries = [];
  const mainSeries = [];
  for (const point of goal.dataSeries.values) {
    mainSeries.push({
      x: new Date(point.timestamp).getTime(),
      y: Number.isFinite(point.value) ? point.value : null,
    });
  }
  mainChart.push({
    name: (goal.name || goal.indicatorParameter).split('\\').at(-1),
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
      min: new Date("2020-01-01T00:00:00.000Z").getTime(),
      max: new Date("2050-01-01T00:00:00.000Z").getTime(),
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