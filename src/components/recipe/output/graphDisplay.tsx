"use client";

import WrappedChart, { graphNumberFormatter } from "@/lib/chartWrapper";
import { useRecipe } from "../context/recipeContext.use";
import type { ApexOptions } from "apexcharts";
import { IconInfoCircle } from "@tabler/icons-react";
import { Locales } from "@/../i18n.config";
import { useTranslation } from "react-i18next";

// TODO: Does this take historical data into account? Do we need to account for it?
// TODO: We should have a visible title for our graph
export function OutputGraph() {
  const { t } = useTranslation("components");
  const { resultingDataSeries } = useRecipe();

  if (!resultingDataSeries) {
    return <div style={{ fontSize: '14px' }} lang={Locales.enSE} className="flex align-items-flex-start gap-50 margin-top-50">
      <IconInfoCircle width={16} height={16} style={{ minWidth: '16px', marginTop: '2px' }} color="var(--gray-70)" aria-label={t("components:recipe_editor.status.no_issues_icon_aria_label")} />
      {t("components:recipe_editor.missing_resulting_graph")}
    </div>;
  }

  const entries = Object.entries(resultingDataSeries)
    .filter(([key]) => key.startsWith("val"))
    .sort(([a], [b]) => a.localeCompare(b)); // Ensure chronological order

  const years = entries.map(([key]) => key.replace("val", ""));
  const values = entries.map(([, value]) => value);

  const chartSeries = [
    {
      name: "Data",
      data: values,
    },
  ];

  const chartOptions: ApexOptions = {
    chart: {
      animations: { enabled: false },
      type: "line",
      zoom: { enabled: false },
      toolbar: { show: false },
    },
    xaxis: {
      categories: years,
    },
    yaxis: {
      labels: {
        formatter: graphNumberFormatter,
      },
    },
  };

  return (
    <WrappedChart options={chartOptions} series={chartSeries} type="line" />
  );
}