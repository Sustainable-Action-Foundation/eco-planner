import WrappedChart from "@/lib/chartWrapper";
import { Years } from "@/types";
import { DataSeries, Goal } from "@prisma/client";
import styles from '../graphs.module.css'
import { ApiTableContent } from "@/lib/api/apiTypes";
import { parsePeriod } from "@/lib/api/utility";
import getTableContent from "@/lib/api/getTableContent";
import i18nServer from "i18next";

export default async function ThumbnailGraph({
  goal,
  historicalData
}: {
  goal: Goal & { dataSeries: DataSeries | null },
  historicalData?: boolean,
}) {
  if (!goal.dataSeries) {
    return null;
  }

  const locale = i18nServer.language.split("-")[0];
  let externalData: ApiTableContent | null = null;
  if (historicalData) {
    // Fetch external data
    if (goal.externalDataset && goal.externalTableId && goal.externalSelection) {
      externalData = await getTableContent(goal.externalTableId, goal.externalDataset, goal.externalSelection, locale);
    }
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
    type: 'area',
  });

  if (externalData) {
    const historicalSeries = [];

    if (externalData.values.length >= 0) {
      for (const { period, value } of externalData.values) {
        const parsedValue = parseFloat(value);

        historicalSeries.push({
          x: parsePeriod(period).getTime(),
          y: Number.isFinite(parsedValue) ? parsedValue : null,
        });
      }
      mainChart.push({
        name: `${externalData.metadata[0]?.label}`,
        data: historicalSeries,
        type: 'area',
      });
    }
  }

  const mainChartOptions: ApexCharts.ApexOptions = {
    chart: {
      type: 'area',
      animations: { enabled: false, dynamicAnimation: { enabled: false } },
      zoom: {
        enabled: false,
      },
      toolbar: {
        show: false,
      },
    },
    legend: {show: false},
    colors: ['#0090ff', '#2e8a56'],
    fill: {
      type: 'solid',
      opacity: [0.1, 0.5],
      colors: ['#0090ff', '#2e8a56'],
    },
    tooltip: { enabled: false },
    stroke: { curve: 'straight', width: [1.5,1.5] },
    xaxis: {
      type: 'datetime',
      labels: { format: 'yyyy' },
      tooltip: { enabled: false },
      min: externalData ? Date.UTC(Number(externalData?.values[0].period), 0, 1) : new Date(Years[0].replace('val', '')).getTime(),
      max: new Date(Years[Years.length - 1].replace('val', '')).getTime()
    },
    yaxis: {
      show: false
    }
  }

  return (
    <>
      <div className={styles.graphWrapperThumbnail}>
        <h3 className="font-weight-500 margin-0 padding-top-75 padding-inline-75 overflow-hidden white-space-nowrap text-align-center text-overflow-ellipsis">
          {goal.name}
        </h3>
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