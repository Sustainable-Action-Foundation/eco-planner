"use client"

import { ApiTableContent } from "@/lib/api/apiTypes";
import { DatasetData, ExternalDataset } from "@/lib/api/utility";
import { useEffect, useState } from "react";
import { getStoredGraphType } from "../../../functions/graphFunctions";
import GraphSelector from "../../../graphSelectors/graphSelector";
import MainDeltaGraph from "./delta";
import MainGraph from "./main";
import MainRelativeGraph from "./relative";
import SecondaryGoalSelector from "../../../graphSelectors/secondaryGoalSelector";
import { Trans, useTranslation } from "react-i18next";
import type { Effect, Goal, Roadmap } from "@/types";
import ChildGraphContainer from "../child/container";
import SiblingGraph from "../sibling/siblings";
import findSiblings from "@/functions/findSiblings";

export const GraphType = {
  Main: "MAIN",
  Relative: "RELATIVE",
  Delta: "DELTA",
  Children: "CHILDREN",
  Siblings: "SIBLINGS"
} as const;
export type GraphType = (typeof GraphType)[keyof typeof GraphType];

export default function GraphGraph({
  goal,
  secondaryGoal,
  parentGoal,
  childGoals,
  roadmap,
  parentGoalRoadmap,
  historicalData,
  effects,
  children,
}: {
  goal: Goal,
  secondaryGoal: Goal | null,
  parentGoal: Goal | null,
  childGoals: Goal[], // TODO: Should be optional
  roadmap: Roadmap,
  parentGoalRoadmap: Roadmap | null,
  historicalData?: ApiTableContent | null,
  effects: Effect[] | Goal["effects"],
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
      case GraphType.Children:
        return <ChildGraphContainer goal={goal} childGoals={childGoals} />
      case GraphType.Siblings:
        return <>{findSiblings(roadmap, goal).length > 1 ? <SiblingGraph roadmap={roadmap} goal={goal} /> : null}</> // TODO: Does findsbilings make sense here?
      default:
        return graphSwitch(GraphType.Main);
    }
  };

  let dataset: DatasetData | null = null;
  if (historicalData?.metadata[0]?.source) {
    dataset = ExternalDataset.getDatasetByAlternateName(historicalData.metadata[0].source);
  }

  return (
    <div className="purewhite" style={{ border: '1px solid var(--gray-80)', borderTop: 0, borderRadius: '0 0 .25rem .25rem' }}>
      {/* TODO: Use role="toolbar" (or menubar) for this */}
      <menu className="flex align-items-flex-end gap-25 margin-0 padding-25 flex-wrap-wrap" style={{ backgroundColor: 'var(--gray-95)', borderBottom: '1px solid var(--gray-80)' }}>
        <GraphSelector goal={goal} childGoals={false} siblings={false} currentSelection={graphType} setter={setGraphType} /> {/* NOTE: Set childgoals and siblings to false until the feature is fully implemented */}
        <SecondaryGoalSelector />
        {children}
      </menu>
      <article>  {/* TODO: Not sure that article is correct here altough it might very well be*/}
        <h2 className="text-align-center block font-weight-500 margin-top-200 margin-bottom-50" style={{ fontSize: '1.5rem' }}>
          {goal.name ? goal.name : goal.indicatorParameter}
        </h2>
        {secondaryGoal && <p className="margin-block-0 margin-inline-auto text-align-center">{t("graphs:graph_graph.compare_with_goal", { goalName: secondaryGoal.name || secondaryGoal.indicatorParameter })}</p>}
        <div style={{ height: '500px' }} className="padding-inline-25 padding-bottom-50">
          {graphSwitch(graphType || GraphType.Main)}
        </div>
        <footer
          className="font-size-14px text-align-center padding-50"
          style={{ borderTop: '1px solid var(--gray-80)', backgroundColor: 'var(--tertiary-neutral)', borderRadius: '0 0 .25rem .25rem' }}
        >
          {historicalData && (
            <Trans // TODO: Apply the same nav styling as is used in children and sibling graphs  
              i18nKey="graphs:graph_graph.historical_data_source"
              components={{ a: <a href={dataset?.userFacingUrl} target="_blank" /> }}
              tOptions={{ source: dataset?.fullName ?? historicalData.metadata[0]?.source }}
            />
          )}
        </footer>
      </article>
    </div>
  );
}