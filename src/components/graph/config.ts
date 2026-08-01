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

// Builds the same circle `d` path string ApexCharts itself uses for markers
// (a two-arc circle centered at cx/cy with the given radius).
function buildMarkerCirclePath(cx: number, cy: number, radius: number): string {
  return `M ${cx}, ${cy} m -${radius}, 0 a ${radius},${radius} 0 1,0 ${radius * 2},0 a ${radius},${radius} 0 1,0 -${radius * 2},0`;
}
function highlightSharedMarkers({
  seriesIndex,
  dataPointIndex,
  w,
}: {
  seriesIndex: number;
  dataPointIndex: number;
  w: {
    globals: {
      seriesX: Array<Array<number>>;
      seriesNames: Array<string>;
      dom?: { baseEl?: HTMLElement };
    };
  };
}): void {
  const baseEl = w.globals.dom?.baseEl;
  if (!baseEl) return;

  // Shrink back down any markers we enlarged on a previous hover.
  baseEl.querySelectorAll<SVGPathElement>('path.apexcharts-marker[data-graph-hover="true"]').forEach((path) => {
    const cx = parseFloat(path.getAttribute('cx') ?? '0');
    const cy = parseFloat(path.getAttribute('cy') ?? '0');
    const defaultSize = parseFloat(path.getAttribute('default-marker-size') ?? '0');
    path.style.transition = 'none';
    path.setAttribute('d', buildMarkerCirclePath(cx, cy, defaultSize));
    path.removeAttribute('data-graph-hover');
  });

  const hoveredTimestamp = w.globals.seriesX[seriesIndex]?.[dataPointIndex];
  if (hoveredTimestamp === undefined) return;

  const seriesMarkerWraps = Array.from(
    baseEl.querySelectorAll<SVGGElement>('.apexcharts-series-markers-wrap'),
  );

  requestAnimationFrame(() => {
    w.globals.seriesNames.forEach((_name, idx) => {
      const ownTimestamps = w.globals.seriesX[idx] ?? [];
      const ownIndex = ownTimestamps.indexOf(hoveredTimestamp);
      if (ownIndex === -1) return; // This series has no point at this timestamp.

      const seriesWrap = seriesMarkerWraps.find((el) => el.getAttribute('data:realIndex') === String(idx))
        ?? seriesMarkerWraps[idx]; // fallback: assume DOM order matches series order
      const markerPaths = seriesWrap?.querySelectorAll<SVGPathElement>(`path[j="${ownIndex}"]`);
      if (!markerPaths || markerPaths.length === 0) return;

      markerPaths.forEach((markerPath) => {
        const defaultSize = parseFloat(markerPath.getAttribute('default-marker-size') ?? '0');
        // Skip points that are hidden (null data, showNullDataPoints: false
        // draws these at a near-zero size) — nothing real to highlight there.
        if (defaultSize < 1) return;

        const cx = parseFloat(markerPath.getAttribute('cx') ?? '0');
        const cy = parseFloat(markerPath.getAttribute('cy') ?? '0');
        markerPath.style.transition = 'none';
        markerPath.setAttribute('d', buildMarkerCirclePath(cx, cy, defaultSize * 3)); // Multiplying by 3 matches apexcharts own highlight style
        markerPath.setAttribute('data-graph-hover', 'true');
      });
    });
  });
}

function buildSharedDatetimeTooltip({
  series,
  seriesIndex,
  dataPointIndex,
  w,
}: {
  series: Array<Array<number | null>>;
  seriesIndex: number;
  dataPointIndex: number;
  w: {
    globals: {
      seriesX: Array<Array<number>>;
      seriesNames: Array<string>;
      colors: Array<string>;
      dom?: { baseEl?: HTMLElement };
    };
  };
}): string {
  highlightSharedMarkers({ seriesIndex, dataPointIndex, w });

  const hoveredTimestamp = w.globals.seriesX[seriesIndex]?.[dataPointIndex];
  if (hoveredTimestamp === undefined) return '';

  const dateLabel = new Date(hoveredTimestamp).getFullYear().toString();

  const rows = w.globals.seriesNames
    .map((name, idx) => {
      const ownTimestamps = w.globals.seriesX[idx] ?? [];
      const ownIndex = ownTimestamps.indexOf(hoveredTimestamp);
      if (ownIndex === -1) {
        return ''; // This series has no point at all for this exact timestamp.
      }

      const rawValue = series[idx]?.[ownIndex];
      if (rawValue === null || rawValue === undefined || !Number.isFinite(rawValue)) {
        return ''; // No data for this series at this timestamp.
      }

      const color = w.globals.colors[idx] ?? '';
      return `
        <div class="apexcharts-tooltip-series-group apexcharts-active" style="display: flex; order: ${idx};">
          <span class="apexcharts-tooltip-marker" style="background-color: ${color};"></span>
          <div class="apexcharts-tooltip-text">
            <div class="apexcharts-tooltip-y-group">
              <span class="apexcharts-tooltip-text-y-label">${name}: </span>
              <span class="apexcharts-tooltip-text-y-value">${graphNumberFormatter(rawValue)}</span>
            </div>
          </div>
        </div>
      `;
    })
    .join('');

  return `
    <div class="apexcharts-tooltip-title">${dateLabel}</div>
    ${rows}
   `;
}

// TODO: Don't really like this ):
export function generateApexChartOptions({
  chartType,
  colors,
  opacities,
  yAxisTitle,
}: {
  chartType: "main" | "thumbnail" | "siblings" | "preview";
  colors: Array<string>;
  opacities: Array<number>;
  yAxisTitle?: string;
}): ApexCharts.ApexOptions {
  switch (chartType) {
    case "preview": {
      const options: ApexCharts.ApexOptions = {
        chart: {
          type: 'line',
          animations: {
            enabled: true,
            dynamicAnimation: {
              enabled: true,
              speed: 200,
              easing: [.33, -0.03, .15, 1.01], // was dropped from the dynamicAnimation options in the bumped apexcharts typings
            },
          },
          zoom: { allowMouseWheelZoom: false },
        },
        fill: {
          type: 'solid',
          colors: colors,
          opacity: opacities,
        },
        stroke: { curve: stroke.curve, width: stroke.width },
        markers: { size: marker.size, showNullDataPoints: false },
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
          shared: true,
          custom: buildSharedDatetimeTooltip,
          followCursor: true,
        },
      };
      return options;
    }

    case "siblings": {
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
        markers: { size: marker.size, showNullDataPoints: false },
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
          shared: true,
          custom: buildSharedDatetimeTooltip,
          followCursor: true,
        },
      };
      return options;
    }

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
        markers: { size: marker.size, showNullDataPoints: false },
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
          shared: true,
          custom: buildSharedDatetimeTooltip,
          followCursor: true,
        },
      };
      return options;
    }
  }
};