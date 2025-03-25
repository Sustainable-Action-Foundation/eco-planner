"use client"

import { ApiTableContent } from "@/lib/api/apiTypes";
import { externalDatasets } from "@/lib/api/utility";
import { DataSeries, Effect, Goal } from "@prisma/client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getStoredGraphType } from "./functions/graphFunctions";
import GraphSelector from "./graphselector/graphSelector";
import MainDeltaGraph from "./mainGraphs/mainDeltaGraph";
import MainGraph from "./mainGraphs/mainGraph";
import MainRelativeGraph from "./mainGraphs/mainRelativeGraph";
import SecondaryGoalSelector from "./secondaryGraphSelector";

export enum GraphType {
  Main = "MAIN",
  Relative = "RELATIVE",
  Delta = "DELTA",
}

export default function GraphGraph({
  goal,
  secondaryGoal,
  nationalGoal,
  historicalData,
  effects,
  children,
}: {
  goal: Goal & { dataSeries: DataSeries | null, baselineDataSeries: DataSeries | null },
  secondaryGoal: Goal & { dataSeries: DataSeries | null } | null,
  nationalGoal: Goal & { dataSeries: DataSeries | null } | null,
  historicalData?: ApiTableContent | null,
  effects: (Effect & { dataSeries: DataSeries | null })[],
  children: React.ReactNode
}) {
  const [graphType, setGraphType] = useState<GraphType | "">("");

  useEffect(() => {
    setGraphType(getStoredGraphType(goal.id));
  }, [goal.id]);

  function graphSwitch(graphType: string) {
    switch (graphType) {
      case GraphType.Main:
        return <MainGraph goal={goal} nationalGoal={nationalGoal} historicalData={historicalData} secondaryGoal={secondaryGoal} effects={effects} />
      case GraphType.Relative:
        return <MainRelativeGraph goal={goal} nationalGoal={nationalGoal} secondaryGoal={secondaryGoal} />
      case GraphType.Delta:
        return <MainDeltaGraph goal={goal} nationalGoal={nationalGoal} secondaryGoal={secondaryGoal} effects={effects} />
      default:
        return graphSwitch(GraphType.Main);
    }
  };

  // TODO - link to specific table when possible
  function getHistoricalDataLink(historicalData: ApiTableContent) {
    const dataLink = externalDatasets[historicalData.metadata[0].source]?.userFacingUrl;
    return dataLink;
  }

  return (
    <>
      <menu className="flex align-items-flex-end gap-25 margin-0 margin-block-25 padding-0 flex-wrap-wrap">
        <GraphSelector goal={goal} currentSelection={graphType} setter={setGraphType} />
        <SecondaryGoalSelector />
        {children}
      </menu>
      <article className="smooth padding-inline-25 padding-bottom-50 purewhite" style={{ border: '1px solid var(--gray)' }}>
        {goal.name ?
          <h3 className="text-align-center block font-weight-500 margin-top-200 margin-bottom-50">{goal.name}</h3>
          :
          <h3 className="text-align-center block font-weight-500 margin-top-200 margin-bottom-50">{goal.indicatorParameter}</h3>
        }
        {secondaryGoal && <p className="margin-block-0 margin-inline-auto text-align-center">Jämför med målbanan {secondaryGoal.name || secondaryGoal.indicatorParameter}</p>}
        <div style={{ height: '500px' }}>
          {graphSwitch(graphType)}
        </div>
        {historicalData && (
          <div>
            Den historiska datan i grafen är hämtad från
            {getHistoricalDataLink(historicalData) ?
              <Link href={getHistoricalDataLink(historicalData) as string} target="_blank">
                {// If the data source has a full name, display the full name. Otherwise display the 
                  externalDatasets[historicalData.metadata[0].source]?.fullName ? externalDatasets[historicalData.metadata[0].source]?.fullName : historicalData.metadata[0].source}
              </Link>
              :
              externalDatasets[historicalData.metadata[0].source]?.fullName ? externalDatasets[historicalData.metadata[0].source]?.fullName : historicalData.metadata[0].source
            }
          </div>
        )}
      </article>
    </>
  );
}