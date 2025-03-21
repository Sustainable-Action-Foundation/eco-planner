"use client"

import MainDeltaGraph from "./mainGraphs/mainDeltaGraph";
import MainGraph from "./mainGraphs/mainGraph";
import MainRelativeGraph from "./mainGraphs/mainRelativeGraph";
import { DataSeries, Effect, Goal } from "@prisma/client";
import GraphSelector from "./graphselector/graphSelector";
import { useEffect, useState } from "react";
import { getStoredGraphType } from "./functions/graphFunctions";
import SecondaryGoalSelector from "./secondaryGraphSelector";
import { ApiTableContent } from "@/lib/api/apiTypes";

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

  return (
    <>
      <h2 className="padding-bottom-50 margin-bottom-100" style={{borderBottom: '1px solid var(--gray)'}}>Målbana</h2>
      <menu className="flex align-items-flex-end gap-25 margin-0 margin-bottom-25 padding-0 flex-wrap-wrap" >
        <GraphSelector goal={goal} currentSelection={graphType} setter={setGraphType} />
        <SecondaryGoalSelector />
        {children}
      </menu>
      {goal.name ? 
        <h2 className="text-align-center block font-weight-500 margin-block-200" style={{fontSize: '1.5rem'}}>{goal.name}</h2>
      : 
        <h2 className="text-align-center block font-weight-500 margin-block-200" style={{fontSize: '1.5rem'}}>{goal.indicatorParameter}</h2>
      }
      <div style={{ height: '500px',  paddingInline: '.3rem' }}>
        {graphSwitch(graphType)}
      </div>
    </>
  );
}