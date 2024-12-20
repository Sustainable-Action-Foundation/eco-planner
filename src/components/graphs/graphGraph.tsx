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
    <div className="smooth padding-inline-50 purewhite" style={{border: '1px solid var(--gray-90)'}}>
      {/* Turn this into like a msWord typa toolbar */}
      <menu 
        className="flex align-items-center gap-50 margin-0 margin-bottom-50 padding-0 padding-block-50 flex-wrap-wrap" 
        style={{borderBottom: '1px solid var(--gray-90)'}}
      > 
        {/* TODO: Some of theese are missing a label now, not good for accessability, fix this */}
        <div className="flex gap-25">
          <GraphSelector goal={goal} current={graphType} setter={setGraphType} />
        </div>
        <SecondaryGoalSelector />
        {children}
      </menu>
      <div style={{height: '450px'}}>
        {graphSwitch(graphType)}
      </div>
    </div>
  );
}