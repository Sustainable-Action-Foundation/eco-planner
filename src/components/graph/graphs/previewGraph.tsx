import { dataSeriesToDateValues } from "@/functions/recipe";
import WrappedChart, { graphNumberFormatter } from "@/lib/chartWrapper";
import type { DataSeries, DateValuesWithUnit } from "@/types";
import type { ApexAxisChartSeries, ApexYAxis } from "apexcharts";
import { color_palette, stroke, marker } from "../config";
import { useTranslation } from "react-i18next";

// Checks if we have a dataSeries or DateValuesWithUnit
function isDataSeries(
  series: DataSeries | DateValuesWithUnit,
): series is DataSeries {
  return !("dateValues" in series);
}

function toChartSeries(
  series: DataSeries | DateValuesWithUnit,
  name: string,
  type: ApexAxisChartSeries[number]["type"] = "line",
  color: ApexAxisChartSeries[number]["color"] = "",
) {
  // If a dataSeries is passed, convert it to DateValuesWithUnit 
  const dateValues = isDataSeries(series)
    ? dataSeriesToDateValues(series)
    : series;

  // Sort all entries in DateValuesWithUnit by time
  const entries = Object.entries(dateValues.dateValues).sort(
    (a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime(),
  );

  const data = entries.map(([isoDate, value]) => ({
    x: new Date(isoDate).getTime(),
    y: Number.isFinite(value) ? value : null,
  }));

  return { name, data, type, color };
}

export default function PreviewGraph({
  series: {
    main = null,
    baseline = null,
    historical = null,
    predictedOutcome = null,
    comparison = null,
    parent = null,
  } = {},
}: {
  series?: {
    main?: ((DataSeries | DateValuesWithUnit) & { name: string }) | null;
    baseline?: ((DataSeries | DateValuesWithUnit) & { name: string }) | null;
    historical?: ((DataSeries | DateValuesWithUnit) & { name: string }) | null;
    predictedOutcome?: ((DataSeries | DateValuesWithUnit) & { name: string }) | null;
    comparison?: ((DataSeries | DateValuesWithUnit) & { name: string }) | null;
    parent?: ((DataSeries | DateValuesWithUnit) & { name: string }) | null;
  };
}) {
  const { t } = useTranslation("graphs");

  const chart: ApexAxisChartSeries = [];
  const colors: Array<string> = [];
  const opacities: Array<number> = [];

  const mainChartOptions: ApexCharts.ApexOptions = {
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
        title: { text: main?.unit === null ? t("common:tsx.unitless") : main?.unit || t("common:tsx.unit_missing") },
        labels: { formatter: graphNumberFormatter },
        seriesName: [],
      },
    ],
    tooltip: {
      x: { format: 'yyyy' },
      shared: true,
    },
  };

  const mainYAxis = (
    (mainChartOptions.yaxis as ApexYAxis[])[0].seriesName as string[]
  );

  if (main) {
    chart.push(toChartSeries(main, main.name, "line", color_palette.main.color));
    mainYAxis.push(main.name);
    colors.push(color_palette.main.color);
    opacities.push(color_palette.main.fillOpacity);
  }

  if (baseline) {
    chart.push(toChartSeries(baseline, baseline.name, "line", color_palette.baseline.color));
    mainYAxis.push(baseline.name);
    colors.push(color_palette.baseline.color);
    opacities.push(color_palette.baseline.fillOpacity);
  }

  if (historical) {
    chart.push(toChartSeries(historical, historical.name, "area", color_palette.historical.color));
    mainYAxis.push(historical.name);
    colors.push(color_palette.historical.color);
    opacities.push(color_palette.historical.fillOpacity);
  }

  if (predictedOutcome) {
    chart.push(toChartSeries(predictedOutcome, predictedOutcome.name, "line", color_palette.predictedOutcome.color));
    mainYAxis.push(predictedOutcome.name);
    colors.push(color_palette.predictedOutcome.color);
    opacities.push(color_palette.predictedOutcome.fillOpacity);
  }

  if (comparison) {
    chart.push(toChartSeries(comparison, comparison.name, "line", color_palette.comparison.color));

    (mainChartOptions.yaxis as ApexYAxis[]).push({
      title: { text: `${t("graphs:main_graph.secondary_goal", { unit: comparison.unit })}` },
      labels: { formatter: graphNumberFormatter },
      seriesName: comparison.name,
      opposite: true,
    });

    colors.push(color_palette.comparison.color);
    opacities.push(color_palette.comparison.fillOpacity);
  }

  if (parent) {
    chart.push(toChartSeries(parent, parent.name, "line", color_palette.parentGoal.color)); // TODO: Rename parentGoal --> parent
    mainYAxis.push(parent.name);
    colors.push(color_palette.parentGoal.color);
    opacities.push(color_palette.parentGoal.fillOpacity);
  }

  return <WrappedChart height={"100%"} width={"100%"} options={mainChartOptions} series={chart} />;
}