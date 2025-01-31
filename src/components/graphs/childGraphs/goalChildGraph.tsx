import { floatSmoother } from "@/lib/chartWrapper.tsx";
import { dataSeriesDataFieldNames } from "@/types.ts";
import { DataSeries, Goal } from "@prisma/client";

/**
 * A graph showing how all goals with the same unit and indicator parameter in roadmaps working towards the active goal's roadmap version stack up against it.
 */
export default function GoalChildGraph({
  goal,
  children,
  isStacked,
}: {
  goal: Goal & { dataSeries: DataSeries | null },
  children: (Goal & { dataSeries: DataSeries | null, roadmapName?: string })[],
  isStacked: boolean,
}) {
  // Early returns if there is no relevant data to compare
  if (!goal.dataSeries) {
    return null;
  }
  if (children.filter(child => child.dataSeries != null).length < 1) {
    return null;
  }

  const dataPoints: ApexAxisChartSeries = [];

  // Data series for the main goal
  const mainSeries = [];
  for (const i of dataSeriesDataFieldNames) {
    const value = goal.dataSeries[i];

    mainSeries.push({
      x: new Date(i.replace('val', '')).getTime(),
      y: Number.isFinite(value) ? value : null,
    });
  }
  dataPoints.push({
    name: (goal.name || goal.indicatorParameter).split('\\').slice(-1)[0],
    data: mainSeries,
    // Main series is always a line
    type: 'line',
    zIndex: 999,
  });

  for (const child of children) {
    const childSeries = [];
    if (child.dataSeries) {
      for (const i of dataSeriesDataFieldNames) {
        const value = child.dataSeries[i];

        childSeries.push({
          x: new Date(i.replace('val', '')).getTime(),
          // Specifically in the combined graph, when stacked, default to 0 rather than null if the value is not a number
          // This is because stacked area charts in ApexCharts do not handle null values well (other entries are shifted up outside the graph)
          y: Number.isFinite(value) ? value : (isStacked ? 0 : null),
        });
      }
    }
    // Only add the series to the graph if it isn't all null/0
    if (childSeries.filter((entry) => entry.y).length > 0) {
      dataPoints.push({
        name: (child.roadmapName || child.name || child.indicatorParameter).split('\\').slice(-1)[0],
        data: childSeries,
        type: isStacked ? 'area' : 'line',
      });
    }
  }

  // Early return if there is no data to compare
  if (dataPoints.length < 2) {
    return null;
  }

  // If childSeries are lines, make them dashed
  let dashArray: number[] = [];
  if (!isStacked) {
    dashArray = new Array(dataPoints.length).fill(5);
    // Main series should always be solid
    dashArray[0] = 0;
  }

  // ApexCharts options
  const chartOptions: ApexCharts.ApexOptions = {
    chart: {
      id: 'goalChildGraph',
      type: isStacked ? 'area' : 'line',
      stacked: isStacked,
      stackOnlyBar: false,
      animations: { enabled: false, dynamicAnimation: { enabled: false } },
      zoom: { allowMouseWheelZoom: false },
    },
    markers: { size: isStacked ? 0 : 5 },
    xaxis: {
      type: 'datetime',
      labels: { format: 'yyyy' },
      tooltip: { enabled: false },
      min: new Date(dataSeriesDataFieldNames[0].replace('val', '')).getTime(),
      max: new Date(dataSeriesDataFieldNames[dataSeriesDataFieldNames.length - 1].replace('val', '')).getTime()
    },
    yaxis: {
      title: { text: goal.dataSeries?.unit },
      labels: { formatter: floatSmoother },
    },
    tooltip: {
      x: { format: 'yyyy' },
      inverseOrder: isStacked,
    },
    dataLabels: { enabled: false },
    stroke: { dashArray },
  };
}