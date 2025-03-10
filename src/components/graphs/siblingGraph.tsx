'use client';

import findSiblings from "@/functions/findSiblings";
import WrappedChart, { floatSmoother } from "@/lib/chartWrapper";
import { dataSeriesDataFieldNames } from "@/types";
import { DataSeries, Goal, Roadmap } from "@prisma/client";
import { useState } from "react";
import Image from "next/image";

/**
 * A graph that shows how a goal stacks up against its siblings (other goals in the same roadmap version with similar indicator parameters and same unit).
 */
export default function SiblingGraph({
  roadmap,
  goal,
}: {
  roadmap: Roadmap & {
    goals: (Goal & { dataSeries: DataSeries | null })[],
  },
  goal: Goal & { dataSeries: DataSeries | null },
}) {
  const siblings = findSiblings(roadmap, goal);
  const dataPoints: ApexAxisChartSeries = [];

  const [isStacked, setIsStacked] = useState(true);

  for (const i in siblings) {
    const mainSeries = [];
    if (siblings[i].dataSeries) {
      for (const j of dataSeriesDataFieldNames) {
        const value = siblings[i].dataSeries[j];

        mainSeries.push({
          x: new Date(j.replace('val', '')).getTime(),
          // Specifically in the combined graph, when stacked, default to 0 rather than null if the value is not a number
          // This is because stacked area charts in ApexCharts do not handle null values well (other entries are shifted up outside the graph)
          // TODO: Submit a bug report to ApexCharts, and then link it here
          y: Number.isFinite(value) ? value : (isStacked ? 0 : null),
        });
      }
    }
    // Only add the series to the graph if it isn't all null/0
    if (mainSeries.filter((entry) => entry.y).length > 0) {
      dataPoints.push({
        name: (siblings[i].name || siblings[i].indicatorParameter).split('\\').slice(-1)[0],
        data: mainSeries,
        type: isStacked ? 'area' : 'line',
      })
    }
  }

  const chartOptions: ApexCharts.ApexOptions = {
    chart: {
      id: 'combinedGraph',
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
  }

  // TODO: Show this information to the user again. See commit c403159 for the original implementation. https://github.com/Sustainable-Action-Foundation/eco-planner/commit/c403159
  /*
  let indicatorCategory: string;
  let additionalInfo: string = '';
  if (goal.indicatorParameter.split('\\')[0] == 'Key' || goal.indicatorParameter.split('\\')[0] == 'Demand') {
    indicatorCategory = goal.indicatorParameter.split('\\').slice(1, -1).join('\\')
    additionalInfo = "Visar data för både Key och Demand"
  } else {
    indicatorCategory = goal.indicatorParameter.split('\\').slice(0, -1).join('\\')
  }
  */

  return (siblings.length > 1 &&
    <div className="smooth purewhite" style={{ border: '1px solid var(--gray)' }}>
      <menu
        className="flex align-items-center gap-25 margin-0 padding-0 flex-wrap-wrap"
        style={{ borderBottom: '1px solid var(--gray-90)', padding: '2px' }}
      >
        <button
          className="display-flex align-items-center gap-50 transparent"
          style={{ width: 'fit-content', fontWeight: 'bold', fontSize: '.75rem', padding: '.3rem .6rem' }}
          type="button" onClick={() => setIsStacked(!isStacked)}
        >
          Byt graftyp
          <Image src='/icons/chartArea.svg' alt='Byt graf' width={16} height={16} />
        </button>
      </menu>
      <div className="margin-bottom-25" style={{ height: '500px', paddingInline: '.3rem' }}>
        <WrappedChart
          key={"combinedGraph"}
          options={chartOptions}
          series={dataPoints}
          type={isStacked ? 'area' : 'line'}
          width="100%"
          height="100%"
        />
      </div>
    </div>
  )
}