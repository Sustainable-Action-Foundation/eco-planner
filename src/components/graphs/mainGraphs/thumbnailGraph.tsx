import WrappedChart from "@/lib/chartWrapper";
import styles from '../graphs.module.css'
import { ApiTableContent } from "@/lib/api/apiTypes";
import { parsePeriod } from "@/lib/api/utility";
import getTableContent from "@/lib/api/getTableContent";
import i18nServer from "i18next";
import { dataSeriesToDateValues } from "@/functions/recipe/vectorAndMaskUtils";
import type { Goal } from "@/types";

type ThumbnailGoal = Pick<
  Goal,
  "id" | "name" | "indicatorParameter" | "dataSeries" | "externalDataset" | "externalTableId" | "externalSelection"
>;

export default async function ThumbnailGraph({
  goal,
  historicalData
}: {
  goal: ThumbnailGoal,
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

  const mainDateValues = dataSeriesToDateValues(goal.dataSeries);
  const sortedMainEntries = Object.entries(mainDateValues.dateValues)
    .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime());
  const mainSeries = sortedMainEntries.map(([isoDate, value]) => ({
    x: new Date(isoDate).getTime(),
    y: Number.isFinite(value) ? value : null,
  }));

  const mainChart: ApexAxisChartSeries = [];
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
      opacity: [0, 0.3],
      colors: ['#0090ff', '#2e8a56'],
    },
    tooltip: { enabled: false },
    stroke: { curve: 'straight', width: 1.5 },
    xaxis: {
      type: 'datetime',
      labels: { format: 'yyyy' },
      tooltip: { enabled: false },
      ...(externalData?.values?.[0]?.period
        ? { min: Date.UTC(Number(externalData.values[0].period), 0, 1) }
        : sortedMainEntries[0]
          ? { min: new Date(sortedMainEntries[0][0]).getTime() }
          : {}),
      ...(sortedMainEntries[sortedMainEntries.length - 1]
        ? { max: new Date(sortedMainEntries[sortedMainEntries.length - 1][0]).getTime() }
        : {})
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
        <div className="flex-grow-100">
          <WrappedChart
            options={mainChartOptions}
            series={mainChart}
            width="100%"
            height="100%"
          />
        </div>
      </div>
    </>
  )
}