import WrappedChart from "@/lib/chartWrapper";
import { actionGraphSorter } from "@/lib/sorters";
import { Action } from "@prisma/client";
import styles from './graphs.module.css'
import { useTranslation } from "react-i18next";

export default function ActionGraph({
  actions,
}: {
  actions: Action[],
}) {
  const { t } = useTranslation();
  
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
    name: t("components:action_graph.actions"),
    data: actionData,
    type: 'rangeBar',
  })

  const height = `${100 + (series[0].data.length * 32)}px`

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
    plotOptions: {
      bar: {
        horizontal: true,
        barHeight: "24px",
        borderRadius: 3,
      },
    },
    grid: {
      show: false,
    },
    xaxis: {
      type: 'datetime',
      labels: {
        format: 'yyyy',
        style: {
          fontSize: '.75rem',
          fontFamily: 'system-ui',
          colors: 'black'
        },
      },
      axisBorder: {
        show: false,
      },
      min: new Date("2020").getTime(),
      max: new Date("2050").getTime(),
    },
    yaxis: {
      labels: {
        style: {
          fontSize: '1rem',
          colors: 'black'
        },
      },
    },
    tooltip: {
      x: { format: 'yyyy' }
    },
  }

  return (actions.length > 0 &&
    <div className={styles.graphWrapper} style={{ height: `${height}`, backgroundColor: 'transparent', border: 'none', borderRadius: 0 }}>
      <WrappedChart
        options={chartOptions}
        series={series}
        type="rangeBar"
        width="100%"
        height="100%"
      />
    </div>
  );
}