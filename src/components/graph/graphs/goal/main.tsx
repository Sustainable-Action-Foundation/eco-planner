"use client"; // TODO: dont like this but whatever

import { dataSeriesToDateValues } from "@/functions/recipe";
import WrappedChart, { graphNumberFormatter } from "@/lib/chartWrapper";
import type { DataSeries, DateValuesWithUnit } from "@/types";
import type { ApexAxisChartSeries, ApexYAxis } from "apexcharts";
import { color_palette, generateApexChartOptions } from "../../config";
import { useTranslation } from "react-i18next";
import { memo } from "react";
import { UnitFlags } from "@/types/enums";
import { parseUnit } from "@/functions/unit";

// Checks if we have a dataSeries or DateValuesWithUnit
function isDataSeries(
  series: DataSeries | DateValuesWithUnit,
): series is DataSeries {
  return !("dateValues" in series);
}

function toDateValueMap(
  series: DataSeries | DateValuesWithUnit,
): Map<number, number> {
  const dateValuesWithUnit = isDataSeries(series)
    ? dataSeriesToDateValues(series)
    : series;

  const map = new Map<number, number>();
  for (const [isoDate, value] of Object.entries(dateValuesWithUnit.dateValues)) {
    map.set(new Date(isoDate).getTime(), value);
  }

  return map;
}

// Pad with null or omit values to create tooltips which function for multiple series.
function toChartSeries(
  dateValueMap: Map<number, number>,
  allTimestamps: number[],
  name: string,
  type: ApexAxisChartSeries[number]["type"] = "line",
  color: ApexAxisChartSeries[number]["color"] = "",
) {
  const ownTimestamps = Array.from(dateValueMap.keys());
  const minOwn = ownTimestamps.length > 0 ? Math.min(...ownTimestamps) : null;
  const maxOwn = ownTimestamps.length > 0 ? Math.max(...ownTimestamps) : null;

  const data = allTimestamps
    .filter((x) => minOwn !== null && maxOwn !== null && x >= minOwn && x <= maxOwn)
    .map((x) => {
      const value = dateValueMap.get(x);
      return {
        x,
        y: value !== undefined && Number.isFinite(value) ? value : null,
      };
    });

  return { name, data, type, color };
}


// Converts a hex color to HSL components
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  let h = 0;
  let s = 0;

  if (max !== min) {
    const delta = max - min;
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);

    switch (max) {
      case r: {
        h = ((g - b) / delta + (g < b ? 6 : 0)) * 60;
        break;
      }
      case g: {
        h = ((b - r) / delta + 2) * 60;
        break;
      }
      case b: {
        h = ((r - g) / delta + 4) * 60;
        break;
      }
      default:
        break;
    }
  }

  return { h, s: s * 100, l: l * 100 };
}

function getSiblingColor(index: number, total: number, baseHex: string): string {
  const base = hexToHsl(baseHex);

  // Spread hues within a narrow band around the base hue (e.g. +/- 60deg)
  const hueRange = 80; // total spread in degrees
  const hueStart = base.h - hueRange / 2;
  const hue = total > 1 ? hueStart + (index * hueRange) / (total - 1) : base.h;


  return `hsl(${hue}, ${base.s}%, 50%)`;
}

export function GoalGraph({
  chartType, // TODO: TURN INTO PROPER TYPE!
  chartOptionsType,
  series: {
    main = null,
    baseline = null,
    historical = null,
    predictedOutcome = null,
    comparison = null,
    parent = null,
    siblings = null,
  } = {},
}: {
  chartType: "main" | "thumbnail" | "siblings" | "preview" // TODO: This should be a type if i do it this way...  (also dislike this generally, probably want to pass options for each graph instead of doing it like this)
  chartOptionsType?: "line" | "area" | "bar" | "pie" | "donut" | "radialBar" | "scatter" | "bubble" | "heatmap" | "candlestick" | "boxPlot" | "radar" | "polarArea" | "rangeBar" | "rangeArea" | "treemap" | "funnel" | "pyramid" | "gauge" | undefined;
  series?: {
    main?: ((DataSeries | DateValuesWithUnit) & { name: string }) | null;
    baseline?: ((DataSeries | DateValuesWithUnit) & { name: string }) | null;
    historical?: ((DataSeries | DateValuesWithUnit) & { name: string }) | null;
    predictedOutcome?: ((DataSeries | DateValuesWithUnit) & { name: string }) | null;
    comparison?: ((DataSeries | DateValuesWithUnit) & { name: string }) | null;
    parent?: ((DataSeries | DateValuesWithUnit) & { name: string }) | null;
    siblings?: Array<((DataSeries | DateValuesWithUnit) & { name: string })> | null;
  };
}) {
  const { t } = useTranslation("graphs");

  const chart: ApexAxisChartSeries = [];
  const colors: Array<string> = [];
  const opacities: Array<number> = [];
  const options = generateApexChartOptions({
    chartType: chartType,
    colors: colors,
    opacities: opacities,
    // `main` may be a raw db series (legacy unit convention) or a DateValuesWithUnit; parse either
    yAxisTitle: (() => {
      if (main === null || main === undefined) return t("common:tsx.unit_missing");
      const unit = parseUnit(main.unit);
      if (unit === UnitFlags.Missing) return t("common:tsx.unit_missing");
      if (unit === UnitFlags.Unitless) return t("common:tsx.unitless");
      return unit;
    })(),
  });

  const mainYAxis =
    chartType === "main" // TODO: Might be relevant with more stuff here later
      ? ((options.yaxis as ApexYAxis[])[0].seriesName as string[])
      : undefined;

  // Pre-compute date-value maps for every series that's actually present,
  // then union all their timestamps so every rendered series shares the
  // same x-axis domain (missing points become null rather than the series
  // just stopping short).
  const dateValueMaps = {
    main: main ? toDateValueMap(main) : null,
    baseline: baseline ? toDateValueMap(baseline) : null,
    historical: historical ? toDateValueMap(historical) : null,
    predictedOutcome: predictedOutcome ? toDateValueMap(predictedOutcome) : null,
    comparison: comparison ? toDateValueMap(comparison) : null,
    parent: parent ? toDateValueMap(parent) : null,
    siblings: siblings ? siblings.map((sibling) => toDateValueMap(sibling)) : null,
  };

  const allTimestampsSet = new Set<number>();
  for (const map of [
    dateValueMaps.main,
    dateValueMaps.baseline,
    dateValueMaps.historical,
    dateValueMaps.predictedOutcome,
    dateValueMaps.comparison,
    dateValueMaps.parent,
    ...(dateValueMaps.siblings ?? []),
  ]) {
    if (!map) continue;
    for (const timestamp of map.keys()) {
      allTimestampsSet.add(timestamp);
    }
  }
  const allTimestamps = Array.from(allTimestampsSet).sort((a, b) => a - b);

  // TODO: Need to add z-index so this is always on top! (probably want to handle typing so its easier to accept correct things for each dataseries)
  if (main && dateValueMaps.main) { // TODO: i dislike the way i handle area types here, figure out a better way ... 
    chart.push(toChartSeries(dateValueMaps.main, allTimestamps, main.name, chartOptionsType ?? 'line', color_palette.main.color));
    mainYAxis?.push(main.name);
    colors.push(color_palette.main.color);
    opacities.push(chartOptionsType === "area" ? 0.3 : 1); // TODO: Weird stuff is happening with opacities...
  }

  if (baseline && dateValueMaps.baseline) {
    chart.push(toChartSeries(dateValueMaps.baseline, allTimestamps, baseline.name, "line", color_palette.baseline.color));
    mainYAxis?.push(baseline.name);
    colors.push(color_palette.baseline.color);
    opacities.push(color_palette.baseline.fillOpacity);
  }

  if (historical && dateValueMaps.historical) {
    chart.push(toChartSeries(dateValueMaps.historical, allTimestamps, historical.name, "area", color_palette.historical.color));
    mainYAxis?.push(historical.name);
    colors.push(color_palette.historical.color);
    opacities.push(color_palette.historical.fillOpacity);
  }

  if (predictedOutcome && dateValueMaps.predictedOutcome) {
    chart.push(toChartSeries(dateValueMaps.predictedOutcome, allTimestamps, predictedOutcome.name, "line", color_palette.predictedOutcome.color));
    mainYAxis?.push(predictedOutcome.name);
    colors.push(color_palette.predictedOutcome.color);
    opacities.push(color_palette.predictedOutcome.fillOpacity);
  }

  if (comparison && dateValueMaps.comparison) {
    chart.push(toChartSeries(dateValueMaps.comparison, allTimestamps, comparison.name, "line", color_palette.comparison.color));

    (options.yaxis as ApexYAxis[]).push({
      title: {
        text: `${t("graphs:main_graph.secondary_goal", {
          unit: (() => {
            const unit = parseUnit(comparison.unit);
            if (unit === UnitFlags.Missing) return t("common:tsx.unit_missing");
            if (unit === UnitFlags.Unitless) return t("common:tsx.unitless");
            return unit;
          })(),
        })}`,
      },
      labels: { formatter: graphNumberFormatter },
      seriesName: comparison.name,
      opposite: true,
    });

    colors.push(color_palette.comparison.color);
    opacities.push(color_palette.comparison.fillOpacity);
  }

  if (parent && dateValueMaps.parent) {
    chart.push(toChartSeries(dateValueMaps.parent, allTimestamps, parent.name, "line", color_palette.parentGoal.color)); // TODO: Rename parentGoal --> parent
    mainYAxis?.push(parent.name);
    colors.push(color_palette.parentGoal.color);
    opacities.push(color_palette.parentGoal.fillOpacity);
  }

  if (siblings && dateValueMaps.siblings) {
    const siblingMaps = dateValueMaps.siblings;

    if (siblings && siblingMaps) {
      siblings.forEach((sibling, index) => {
        const siblingMap = siblingMaps[index];
        const siblingColor = getSiblingColor(index, siblings.length + 1, color_palette.main.color);

        chart.push(toChartSeries(siblingMap, allTimestamps, sibling.name, 'area', siblingColor));
        mainYAxis?.push(sibling.name);
        colors.push(siblingColor);
        opacities.push(0.3); // TODO: Weird stuff is happening with opacities...
      });
    }
  }

  return <WrappedChart
    height={"100%"}
    width={"100%"}
    options={options}
    series={chart}
  />;
}

export default memo(GoalGraph);