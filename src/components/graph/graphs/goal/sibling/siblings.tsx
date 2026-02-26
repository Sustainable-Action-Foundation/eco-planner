'use client';

import findSiblings from "@/functions/findSiblings";
import WrappedChart, { graphNumberFormatter } from "@/lib/chartWrapper";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { IconChartAreaLineFilled, IconLink } from "@tabler/icons-react";
import { Goal, Roadmap } from "@/types";
import { color_palette, stroke, marker } from "../../../config";

// TODO: Do we want to showcase the goal itself here or only its siblings? If we do want to showcase the goal, 
// how can we ensure that it maintains the same colour as in the other graphs?
/**
 * A graph that shows how a goal stacks up against its siblings (other goals in the same roadmap version with similar indicator parameters and same unit).
 */
export default function SiblingGraph({
  roadmap,
  goal,
}: {
  roadmap: Roadmap;
  goal: Goal;
}) {
  const { t } = useTranslation("graphs");

  const siblings = findSiblings(roadmap, goal);
  const dataPoints: ApexAxisChartSeries = [];
  const [isStacked, setIsStacked] = useState(true);

  for (const entry of siblings) {
    const mainSeries = [];
    if (entry.dataSeries) {
      for (const dateValue of entry.dataSeries.values) {
        mainSeries.push({
          x: new Date(dateValue.timestamp).getTime(),
          y: Number.isFinite(dateValue.value) ? dateValue.value : null,
        });
      }
    }
    // Only add the series to the graph if it isn't all null/0
    if (mainSeries.filter((entry) => entry.y).length > 0) {
      dataPoints.push({
        name: (entry.name || entry.indicatorParameter).split('\\').at(-1),
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
    fill: {
      type: 'solid',
      opacity: 0.3
    },
    stroke: { curve: stroke.curve, width: stroke.width },
    markers: { size: isStacked ? 0 : marker.size },
    xaxis: {
      type: 'datetime',
      labels: { format: 'yyyy' },
      tooltip: { enabled: false },
      min: new Date("2020-01-01T00:00:00Z").getTime(),
      max: new Date("2050-01-01T00:00:00Z").getTime(),
    },
    yaxis: {
      title: { text: goal.dataSeries?.unit === null ? t("common:tsx.unitless") : goal.dataSeries?.unit || t("common:tsx.unit_missing") },
      labels: { formatter: graphNumberFormatter },
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
    <>
      <menu className="flex align-items-flex-end gap-25 margin-0 margin-block-25 padding-0 flex-wrap-wrap">
        <button
          className="flex align-items-center gap-50 transparent font-weight-500 gray-90"
          style={{ width: 'fit-content', fontSize: '.75rem', padding: '.3rem .6rem', lineHeight: '1.5' }}
          type="button" onClick={() => setIsStacked(!isStacked)}
        >
          {t("graphs:common.change_graph_type")}
          <IconChartAreaLineFilled aria-hidden="true" width={16} height={16} />
        </button>
      </menu>
      <article className="smooth purewhite" style={{ border: '1px solid var(--gray)' }}>
        <h2 className="text-align-center block font-weight-500 margin-block-200" style={{ fontSize: '1rem' }}>{t("graphs:sibling_graph.related_goals")}</h2>
        <div style={{ height: '500px' }} className="padding-inline-25 padding-bottom-50">
          <WrappedChart
            key={"combinedGraph"}
            options={chartOptions}
            series={dataPoints}
            type={isStacked ? 'area' : 'line'}
            width="100%"
            height="100%"
          />
        </div>
        <nav 
          className="font-size-14px flex gap-75 flex-wrap-wrap justify-content-center padding-50" 
          style={{ borderTop: '1px solid var(--gray-80)', backgroundColor: 'var(--tertiary-neutral)', borderRadius: '0 0 .25rem .25rem' }}
        >
          {siblings.map((sibling, index) =>
            <span key={sibling.id} className="flex gap-50 line-height-100">
              <a href={`/goal/${sibling.id}`} className="flex gap-25 align-items-center">
                <IconLink width={14} height={14} strokeWidth={1.5}  />
                {sibling.name ? sibling.name : sibling.indicatorParameter.split('\\').at(-1)}
              </a>
              {index !== siblings.length - 1 ?
                <hr aria-orientation="vertical" className="padding-0 margin-block-25" /> /* TODO: Need to add orientation aria to other HR */
                : null}
            </span>
          )}
        </nav>
      </article>
    </>
  )
}