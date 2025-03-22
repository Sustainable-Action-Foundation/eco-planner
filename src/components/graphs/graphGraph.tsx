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
      <menu className="flex align-items-flex-end gap-25 margin-0 margin-block-25 padding-0 flex-wrap-wrap" >
        <GraphSelector goal={goal} currentSelection={graphType} setter={setGraphType} />
        <SecondaryGoalSelector />
        {children}
      </menu>
      <article className="smooth" style={{border: '1px solid var(--gray)', backgroundColor: 'white'}}>
        {goal.name ? 
          <h3 className="text-align-center block font-weight-500 margin-top-200 margin-bottom-0">{goal.name}</h3>
        : 
          <h3 className="text-align-center block font-weight-500 margin-top-200 margin-bottom-0">{goal.indicatorParameter}</h3>
        }
        {secondaryGoal && <p className="margin-block-0 margin-inline-auto text-align-center">Jämför med målbanan {secondaryGoal.name || secondaryGoal.indicatorParameter}</p>}
        <div style={{ height: '500px'}}>
          {graphSwitch(graphType)}
        </div>
      </article>
    </>
  );
}