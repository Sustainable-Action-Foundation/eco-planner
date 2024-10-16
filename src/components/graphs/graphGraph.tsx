"use client"

import MainDeltaGraph from "./mainGraphs/mainDeltaGraph";
import MainGraph from "./mainGraphs/mainGraph";
import MainRelativeGraph from "./mainGraphs/mainRelativeGraph";
import { Action, DataSeries, Goal } from "@prisma/client";
import GraphSelector from "./graphselector/graphSelector";
import { useEffect, useState } from "react";
import { getStoredGraphType } from "./functions/graphFunctions";
import { PxWebApiV2TableContent } from "@/lib/pxWeb/pxWebApiV2Types";

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
  actions,
}: {
  goal: Goal & { dataSeries: DataSeries | null, baselineDataSeries: DataSeries | null },
  secondaryGoal: Goal & { dataSeries: DataSeries | null } | null,
  nationalGoal: Goal & { dataSeries: DataSeries | null } | null,
  historicalData?: PxWebApiV2TableContent | null,
  actions: (Action & { dataSeries: DataSeries | null })[],
}) {
  const [graphType, setGraphType] = useState<GraphType | "">("");

  useEffect(() => {
    setGraphType(getStoredGraphType(goal.id));
  }, [goal.id]);

  function graphSwitch(graphType: string) {
    switch (graphType) {
      case GraphType.Main:
        return <div>
          <nav className="display-flex align-items-center gap-25 margin-block-100">
            <GraphSelector goal={goal} current={graphType} setter={setGraphType} />
          </nav>
          <MainGraph goal={goal} nationalGoal={nationalGoal} historicalData={historicalData} secondaryGoal={secondaryGoal} actions={actions} />
        </div>;
      case GraphType.Relative:
        return <div>
          <nav className="display-flex align-items-center gap-25 margin-block-100">
            <GraphSelector goal={goal} current={graphType} setter={setGraphType} />
          </nav>
          <MainRelativeGraph goal={goal} nationalGoal={nationalGoal} secondaryGoal={secondaryGoal} />
        </div>;
      case GraphType.Delta:
        return <div>
          <nav className="display-flex align-items-center gap-25 margin-block-100">
            <GraphSelector goal={goal} current={graphType} setter={setGraphType} />
          </nav>
          <MainDeltaGraph goal={goal} nationalGoal={nationalGoal} secondaryGoal={secondaryGoal} actions={actions} />
        </div>;
      default:
        return graphSwitch(GraphType.Main);
    }
  };

  return (
    <>

      {graphSwitch(graphType)}
    </>
  );
}