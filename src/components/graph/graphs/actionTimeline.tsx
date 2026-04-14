"use client"

import WrappedChart from "@/lib/chartWrapper";
import { actionGraphSorter } from "@/lib/sorters";
import type { Action } from "@prisma/client";
import type { ApexAxisChartSeries } from "apexcharts";
import { useTranslation } from "react-i18next";

export default function ActionGraph({
  actions,
}: {
  actions: Action[],
}) {
  const { t } = useTranslation("graphs");

  const series: ApexAxisChartSeries = [];
  const actionData = []

  // The string '2020' is interpreted as a year while the number 2020 is interpreted as a timestamp
  for (const action of actions) {
    if (!action) continue;

    actionData.push({
      x: action.name,
      y: [
        new Date((action.startYear ?? 2020).toString()).getTime(),
        new Date((action.endYear ?? 2050).toString()).getTime()
      ]
    })
  }

  actionData.sort(actionGraphSorter)

  series.push({
    name: t("graphs:action_graph.actions"),
    data: actionData,
    type: 'rangeBar',
  })

  // Add empty buffers as a cheap fix for padding not behaving
  actionData.unshift({ x: ' ', y: [null, null] });
  actionData.push({ x: '  ', y: [null, null], type: 'rangeBar' });

  const chartOptions: ApexCharts.ApexOptions = {
    chart: {
      type: 'rangeBar',
      zoom: {
        enabled: false,
      },
      animations: {
        enabled: false,
        dynamicAnimation: {
          enabled: false
        }
      },
      toolbar: {
        show: false,
      },
    },
    fill: {
      type: 'solid',
      colors: ['var(--blue-40)']
    },
    states: {
      active: {
        filter: { type: 'none' }
      }
    },
    dataLabels: {
      enabled: true,
      textAnchor: 'start',
      style: {
        fontWeight: 'normal',
        colors: ['white']
      },
      formatter: function (val, opts?: { dataPointIndex: number, w: { globals: { labels: string[] } } }) {
        if (!opts || !("w" in opts) || !("globals" in opts.w) || !("labels" in opts.w.globals) || !("dataPointIndex" in opts) || typeof opts.dataPointIndex !== 'number' || !Array.isArray(opts.w.globals.labels) || opts.w.globals.labels.some(label => typeof label !== 'string')) return val;
        const label = opts.w.globals.labels[opts.dataPointIndex];
        // Don't render label if it is for the buffer bars
        if (!label || label.trim() === '') return '';
        return label;
      },
    },
    plotOptions: {
      bar: { /* Figure out the padding for theese */
        dataLabels: {
          position: 'bottom',
        },
        horizontal: true,
        barHeight: '32px',
        borderRadius: 2,
        borderRadiusApplication: 'end'
      },
    },
    grid: {
      xaxis: { lines: { show: true } },
      yaxis: { lines: { show: false } }
    },
    annotations: {
      xaxis: [
        {
          x: new Date().getTime(),
          borderColor: 'var(--gray-30)',
          label: {
            textAnchor: 'middle',
            position: 'end',
            offsetY: 20,
            orientation: 'horizontal',
            borderColor: 'var(--gray-80)',
            style: {
              color: 'black',
              background: 'var(--gray-95)',
              fontSize: '14px',
            },
            text: new Date().toLocaleDateString('en-GB', { /* TODO: i18n */
              day: 'numeric',
              month: 'short',
              year: 'numeric'
            }),
          },
          strokeDashArray: 0,
          borderWidth: 1,
        },
      ],
    },
    xaxis: {
      axisTicks: { show: false },
      position: 'top',
      type: 'datetime',
      labels: {
        offsetX: 50, /* Half of the width for each tick */
        format: 'yyyy',
        style: {
          fontSize: '14px',
          fontFamily: 'system-ui',
          colors: 'black'
        },
      },
      axisBorder: { /* TODO: add colors for this and grid */
        show: true,
      },
      min: new Date("2020").getTime(),
      max: new Date("2051").getTime(),
    },
    yaxis: {
      show: false,
    },
    tooltip: {
      x: { format: 'yyyy' }
    },
  }

  const height = `${100 + (series[0].data.length * 32)}px`
  const widht = `${(31 * 100)}px` /* represents one tick... TODO: Need to get the amount (32) dynamically */

  /* TODO: Would be ideal to scroll directly to annnotation and have the labels be fixed so they follow scroll. 
  Maybe there is some css solution for that which allows us to fix padding for the labels aswell */
  return (actions.length > 0 &&
    <div className="padding-bottom-50" style={{ overflowX: 'scroll', overflowY: 'hidden' }}>
      <div style={{ height: `${height}`, width: `${widht}` }}>
        <WrappedChart
          options={chartOptions}
          series={series}
          type="rangeBar"
          width="100%"
          height="100%"
        />
      </div>
    </div>
  );
}