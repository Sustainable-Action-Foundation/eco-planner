"use client"

import MainDeltaGraph from "./mainGraphs/mainDeltaGraph";
import MainGraph from "./mainGraphs/mainGraph";
import MainRelativeGraph from "./mainGraphs/mainRelativeGraph";
import { DataSeries, Effect, Goal } from "@prisma/client";
import GraphSelector from "./graphselector/graphSelector";
import { useEffect, useState } from "react";
import { getStoredGraphType } from "./functions/graphFunctions";
import { PxWebApiV2TableContent } from "@/lib/pxWeb/pxWebApiV2Types";
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
  historicalData?: PxWebApiV2TableContent | null,
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

  return (
    <div className="smooth purewhite" style={{ border: '1px solid var(--gray)',}}>
      <menu
        className="flex align-items-center gap-25 margin-0 margin-bottom-25 padding-0 flex-wrap-wrap"
        style={{ borderBottom: '1px solid var(--gray)', backgroundColor: '#f9f9f9', borderRadius: '.25rem .25rem 0 0', padding: '2px' }}
      >
        {/* TODO: Missing label */}
        <GraphSelector goal={goal} currentSelection={graphType} setter={setGraphType} />
        <SecondaryGoalSelector />
        {children}
      </menu>
      <div className="margin-top-200 margin-bottom-50">
        {goal.name ? (
          <>
            <h1 className="margin-0 text-align-center" style={{fontSize: '3rem', lineHeight: '1'}}>{goal.name}</h1>
            <small className="text-align-center block" style={{color: 'gray'}}>Målbana</small>
            <small className="text-align-center block" style={{color: 'gray'}}>{goal.indicatorParameter}</small>
          </>
        ) :
          <h1 className="margin-0 text-align-center" style={{lineHeight: '1'}}>{goal.indicatorParameter}</h1>
        } 
        </div>
      <div className="margin-bottom-25" style={{ height: '500px',  paddingInline: '.3rem' }}>
        {graphSwitch(graphType)}
      </div>
    </div>
  );
}