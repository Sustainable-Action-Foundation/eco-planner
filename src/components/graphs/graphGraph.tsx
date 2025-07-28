"use client"

import { ApiTableContent } from "@/lib/api/apiTypes";
import { externalDatasets } from "@/lib/api/utility";
import type { DataSeries, Effect, Goal, MetaRoadmap, Roadmap } from "@prisma/client";
import { useEffect, useState } from "react";
import { getStoredGraphType } from "./functions/graphFunctions";
import GraphSelector from "./graphSelector/graphSelector";
import MainDeltaGraph from "./mainGraphs/mainDeltaGraph";
import MainGraph from "./mainGraphs/mainGraph";
import MainRelativeGraph from "./mainGraphs/mainRelativeGraph";
import SecondaryGoalSelector from "./secondaryGraphSelector";
import { Trans, useTranslation } from "react-i18next";

export enum GraphType {
  Main = "MAIN",
  Relative = "RELATIVE",
  Delta = "DELTA",
}

export default function GraphGraph({
  goal,
  secondaryGoal,
  parentGoal,
  parentGoalRoadmap,
  historicalData,
  effects,
  children,
}: {
  goal: Goal & { dataSeries: DataSeries | null, baselineDataSeries: DataSeries | null },
  secondaryGoal: Goal & { dataSeries: DataSeries | null } | null,
  parentGoal: Goal & { dataSeries: DataSeries | null } | null,
  parentGoalRoadmap: Roadmap & { metaRoadmap: MetaRoadmap } | null,
  historicalData?: ApiTableContent | null,
  effects: (Effect & { dataSeries: DataSeries | null })[],
  children: React.ReactNode
}) {
  const { t } = useTranslation("graphs");

  const [graphType, setGraphType] = useState<GraphType | "">("");

  useEffect(() => {
    setGraphType(getStoredGraphType(goal.id));
  }, [goal.id]);

  function graphSwitch(graphType: GraphType) {
    switch (graphType) {
      case GraphType.Main:
        return <MainGraph goal={goal} parentGoal={parentGoal} parentGoalRoadmap={parentGoalRoadmap} historicalData={historicalData} secondaryGoal={secondaryGoal} effects={effects} />
      case GraphType.Relative:
        return <MainRelativeGraph goal={goal} parentGoal={parentGoal} parentGoalRoadmap={parentGoalRoadmap} secondaryGoal={secondaryGoal} />
      case GraphType.Delta:
        return <MainDeltaGraph goal={goal} parentGoal={parentGoal} parentGoalRoadmap={parentGoalRoadmap} secondaryGoal={secondaryGoal} effects={effects} />
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
        {secondaryGoal && <p className="margin-block-0 margin-inline-auto text-align-center">{t("graphs:graph_graph.compare_with_goal", { goalName: secondaryGoal.name || secondaryGoal.indicatorParameter })}</p>}
        <div style={{ height: '500px' }}>
          {graphSwitch(graphType || GraphType.Main)}
        </div>
        {historicalData && (
          <Trans
            i18nKey="graphs:graph_graph.historical_data_source"
            components={{ a: <a href={getHistoricalDataLink(historicalData) as string || ""} target="_blank" /> }}
            tOptions={{ source: externalDatasets[historicalData.metadata[0].source]?.fullName ? externalDatasets[historicalData.metadata[0].source]?.fullName : historicalData.metadata[0].source }}
          />
        )}
      </article>
    </>
  );
}