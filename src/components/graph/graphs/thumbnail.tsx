import WrappedChart from "@/lib/chartWrapper";
import styles from '../graph.module.css';
import { dataSeriesToDateValues } from "@/functions/recipe/vectorAndMaskUtils";
import { getHistoricalDataset } from "@/functions/getHistoricalDataset";
import type { Goal } from "@/types";
import { color_palette } from "../config";
import type { ApexAxisChartSeries } from "apexcharts";

type ThumbnailGoal = Pick<
  Goal,
  "id" | "name" | "indicatorParameter" | "dataSeries" | "historical"
>;


export default function ThumbnailGraph({
  goal,
  historicalData,
}: {
  goal: ThumbnailGoal,
  historicalData?: boolean,
}) {
  if (!goal.dataSeries) {
    return null;
  }

  // Historical data is stored as a DataSeries on the goal.
  const historical = historicalData && goal.historical ? goal.historical : null;

  const mainDateValues = dataSeriesToDateValues(goal.dataSeries);
  const sortedMainEntries = Object.entries(mainDateValues.dateValues)
    .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime());
  const mainSeries = sortedMainEntries.map(([isoDate, value]) => ({
    x: new Date(isoDate).getTime(),
    y: Number.isFinite(value) ? value : null,
  }));

  const mainChart: ApexAxisChartSeries = [];
  const colors: Array<string> = [color_palette.data.color];
  const opacities: Array<number> = [color_palette.data.fillOpacity];

  mainChart.push({
    name: (goal.name || goal.indicatorParameter).split('\\').slice(-1)[0],
    data: mainSeries,
    type: 'line',
  });

  const historicalEntries = historical
    ? Object.entries(dataSeriesToDateValues(historical).dateValues)
      .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
    : [];

  if (historicalEntries.length > 0) {
    const historicalSeries = historicalEntries.map(([isoDate, value]) => ({
      x: new Date(isoDate).getTime(),
      y: Number.isFinite(value) ? value : null,
    }));
    mainChart.push({
      name: getHistoricalDataset(goal).label || `${(goal.name || goal.indicatorParameter).split('\\').slice(-1)[0]}`,
      data: historicalSeries,
      type: 'area',
    });

    colors.push(color_palette.historical.color);
    opacities.push(color_palette.historical.fillOpacity);
  }

  const lastMainEntry = sortedMainEntries.at(-1);
  const firstHistoricalEntry = historicalEntries.at(0);
  const lastHistoricalEntry = historicalEntries.at(-1);

  if (!lastMainEntry) throw new Error("sortedMainEntries is empty");

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
    legend: { show: false },
    fill: {
      type: 'solid',
      colors: colors,
      opacity: opacities,
    },
    tooltip: { enabled: false },
    stroke: { curve: 'straight', width: 1.5 },
    xaxis: {
      type: 'datetime',
      labels: { format: 'yyyy' },
      tooltip: { enabled: false },
      // If we have historical data, we set the start year to whatever starts first. Otherwise we just use the main data series.
      min: firstHistoricalEntry ? Math.min(new Date(sortedMainEntries[0][0]).getTime(), new Date(firstHistoricalEntry[0]).getTime()) : new Date(sortedMainEntries[0][0]).getTime(),
      // If we have historical data, we set the end year to whatever ends last. Otherwise we just use the main data series.
      max: lastHistoricalEntry ? Math.max(new Date(lastMainEntry[0]).getTime(), new Date(lastHistoricalEntry[0]).getTime()) : new Date(lastMainEntry[0]).getTime(),
    },
    yaxis: {
      show: false,
    },
  };

  return (
    <div className={`${styles['thumbnail-graph']}`}>
        <h3 className="font-weight-500 margin-0 padding-top-75 padding-inline-75 overflow-hidden white-space-nowrap text-align-center text-overflow-ellipsis">
          {!!goal.name ? goal.name : goal.indicatorParameter}
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
  );
}