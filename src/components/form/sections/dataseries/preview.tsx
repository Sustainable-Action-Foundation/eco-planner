"use client";

import TabListSimple from "@/components/generic/tablist/tabListSimple";
import type { DateValuesWithUnit } from "@/types";
import styles from "../../forms.module.css";
import { GoalGraph } from "@/components/graph/graphs/goal/main";
import { useState } from "react";
import { IconGraphFilled, IconTableFilled } from "@tabler/icons-react";

function SeriesTable({
  series,
}: {
  series: (DateValuesWithUnit & { name: string }),
}) {
  return (
    <table className={`${styles['preview-table']}`}>
      <thead>
        <tr className="display-contents">
          <th className="text-align-center" style={{paddingInline: '.5rem'}}>#</th>{/* TODO: i18n */}
          <th>Date</th>
          <th>Value</th>
        </tr>
      </thead>
      <tbody>
        {Object.entries(series.dateValues).map(([date, value], index) => (
          <tr className="display-contents" key={date}>
            <th>{index}</th>
            <td>{new Date(date).toLocaleDateString()}</td>{/* TODO: Format properly given the locale */}
            <td>{value}</td>
          </tr>
        ))}
      </tbody>
      <caption>
        {series.name}
      </caption>
    </table>
  );
}

function PreviewTable({
  main,
  baseline,
  historical,
}: {
  main: (DateValuesWithUnit & { name: string }) | undefined | null;
  baseline: (DateValuesWithUnit & { name: string }) | undefined | null;
  historical: (DateValuesWithUnit & { name: string }) | undefined | null;
}) {
  return (
    <TabListSimple>
      {main ? [
        <TabListSimple.Tab className={`${styles["preview-table-tab"]} margin-right-25`} key="main-tab">Goal</TabListSimple.Tab>,
        <TabListSimple.TabPanel className="height-100" style={{minHeight: '0'}} key="main-panel">
          <SeriesTable series={main} />
        </TabListSimple.TabPanel>,
      ] : null}
      {baseline ? [
        <TabListSimple.Tab className={`${styles["preview-table-tab"]} margin-right-25`} key="baseline-tab">Baseline</TabListSimple.Tab>,
        <TabListSimple.TabPanel className="height-100" style={{minHeight: '0'}} key="baseline-panel">
          <SeriesTable series={baseline} />
        </TabListSimple.TabPanel>,
      ] : null}
      {historical ? [
        <TabListSimple.Tab className={`${styles["preview-table-tab"]}`} key="historical-tab">Historical</TabListSimple.Tab>,
        <TabListSimple.TabPanel className="height-100" style={{minHeight: '0'}} key="historical-panel">
          <SeriesTable series={historical} />
        </TabListSimple.TabPanel>,
      ] : null}
    </TabListSimple>
  );
}

export default function PreviewSeries({
  main,
  baseline,
  historical,
}: {
  main: (DateValuesWithUnit & { name: string }) | undefined | null;
  baseline: (DateValuesWithUnit & { name: string }) | undefined | null;
  historical: (DateValuesWithUnit & { name: string }) | undefined | null;
}) {

  const [displayGraph, setDisplayGraph] = useState<boolean>(true);

  return (
    <>
      <button 
        type="button"
        style={{transform: 'scale(1)'}}
        className="flex align-items-center gap-25 margin-inline-auto height-fit-content"
        onClick={() => setDisplayGraph(!displayGraph)}
      >
        {displayGraph ? // TODO i18n
          <>
            <IconTableFilled width={16} height={16} />
            View as table
          </>
          :
          <>
            <IconGraphFilled width={16} height={16} />
            View as graph
          </>
        }
      </button>

      <div
        className="padding-50 flex flex-direction-column flex-grow-100" 
      >
        {displayGraph ?
            <GoalGraph
              chartType="preview"
              series={{
                main: main,
                baseline: baseline,
                historical: historical,
              }}
            />
          :
          <PreviewTable
            main={main}
            baseline={baseline}
            historical={historical}
          />
        }
      </div>
    </>
  );
}