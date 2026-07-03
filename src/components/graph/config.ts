/* Various style options for graphs to make consistency over several files easier */

import { graphNumberFormatter } from "@/lib/chartWrapper";
import type { ApexMarkers, ApexStroke } from "apexcharts";

/* TODO: Look over the colours here */
/* TODO: Create a type for this */
export const color_palette = {
  main: { color: '#0090ff', fillOpacity: 1 },
  baseline: { color: 'red', fillOpacity: 1 },
  historical: { color: '#2e8a56', fillOpacity: 0.3 },
  predictedOutcome: { color: '#f59e0b', fillOpacity: 1 },
  comparison: { color: 'purple', fillOpacity: 1 },
  parentGoal: { color: 'teal', fillOpacity: 1 },
};

export const marker: ApexMarkers = {
  size: 3,
};

export const stroke: ApexStroke = {
  curve: 'straight',
  width: 3,
};

export function generateApexChartOptions({
  chartType,
  colors,
  opacities,
  yAxisTitle,
}: {
  chartType: "main" | "thumbnail";
  colors: Array<string>;
  opacities: Array<number>;
  yAxisTitle?: string;
}): ApexCharts.ApexOptions {

  switch (chartType) {
    case "thumbnail": {
      const options: ApexCharts.ApexOptions = {
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
        },
        yaxis: {
          show: false,
        },
      };
      return options;
    }

    case "main":
    default: {
      const options: ApexCharts.ApexOptions = {
        chart: {
          type: 'line',
          animations: { enabled: false, dynamicAnimation: { enabled: false } },
          zoom: { allowMouseWheelZoom: false },
        },
        fill: {
          type: 'solid',
          colors: colors,
          opacity: opacities,
        },
        stroke: { curve: stroke.curve, width: stroke.width },
        markers: { size: marker.size },
        xaxis: {
          type: 'datetime',
          labels: { format: 'yyyy' },
          tooltip: { enabled: false },
        },
        yaxis: [
          {
            title: { text: yAxisTitle ?? "" },
            labels: { formatter: graphNumberFormatter },
            seriesName: [],
          },
        ],
        tooltip: {
          x: { format: 'yyyy' },
          shared: true,
        },
      };
      return options;
    }
  }
}; 