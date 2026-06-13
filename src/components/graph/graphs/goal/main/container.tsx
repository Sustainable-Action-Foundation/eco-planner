"use client";

import { getHistoricalDataset } from "@/functions/getHistoricalDataset";
import { useState } from "react";
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
import CopyAndScale from "@/components/modals/copyAndScale";
import type { LoginData } from "@/lib/session";
import styles from '../goal.module.css';

export const GraphType = {
  Main: "MAIN",
  Relative: "RELATIVE",
  Delta: "DELTA",
  Children: "CHILDREN",
  Siblings: "SIBLINGS",
} as const;
export type GraphType = (typeof GraphType)[keyof typeof GraphType];

export default function GraphGraph({
  goal,
  secondaryGoal,
  parentGoal,
  childGoals,
  roadmap,
  parentGoalRoadmap,
  effects,
  session,
  roadmapOptions,
}: {
  goal: Goal,
  secondaryGoal: Goal | null,
  parentGoal: Goal | null,
  childGoals: Goal[], // TODO: Should be optional
  roadmap: Roadmap,
  parentGoalRoadmap: Roadmap | null,
  effects: Effect[] | Goal["effects"],
  session: LoginData,
  roadmapOptions: {
    id: string;
    name: string;
    version: number;
    actor: string | null;
  }[]
}) {
  const { t } = useTranslation("graphs");

  const [graphType, setGraphType] = useState<GraphType | "">(getStoredGraphType(goal.id));

  function graphSwitch(graphType: GraphType) {
    switch (graphType) {
      case GraphType.Relative:
        return <MainRelativeGraph goal={goal} parentGoal={parentGoal} parentGoalRoadmap={parentGoalRoadmap} secondaryGoal={secondaryGoal} />;
      case GraphType.Delta:
        return <MainDeltaGraph goal={goal} parentGoal={parentGoal} parentGoalRoadmap={parentGoalRoadmap} secondaryGoal={secondaryGoal} effects={effects} />;
      case GraphType.Children:
        return <ChildGraphContainer goal={goal} childGoals={childGoals} />;
      case GraphType.Siblings:
        return findSiblings(roadmap, goal).length > 1 && <SiblingGraph roadmap={roadmap} goal={goal} />; // TODO: Does findSiblings make sense here?
      case GraphType.Main:
      default:
        return <MainGraph goal={goal} parentGoal={parentGoal} parentGoalRoadmap={parentGoalRoadmap} secondaryGoal={secondaryGoal} effects={effects} />;
    }
  };

  const { dataset } = getHistoricalDataset(goal);

  return (
    <div className={`${styles['tab-panel']}`}>
      {/* TODO: Use role="toolbar" (or menubar) for this */}
      <header>
        <menu className={`${styles['menu']}`}>
          <GraphSelector goal={goal} childGoals={false} siblings={false} currentSelection={graphType} setter={setGraphType} /> {/* NOTE: Set childGoals and siblings to false until the feature is fully implemented */}
          <SecondaryGoalSelector />
          {(goal.dataSeries?.id && session.user) ?
            <CopyAndScale goal={goal} roadmapOptions={roadmapOptions} />
            : null}
        </menu>
        <h2 className={`${styles['heading']}`}>
          {!!goal.name ? goal.name : goal.indicatorParameter}
        </h2>
        {secondaryGoal ? <p className="margin-block-0 margin-inline-auto text-align-center">
          {t("graphs:graph_graph.compare_with_goal", { goalName: secondaryGoal.name || secondaryGoal.indicatorParameter })}
        </p> : null
        }
      </header>

      <div className={`${styles['body']}`}>
        {graphSwitch(graphType || GraphType.Main)}
      </div>

      {goal.historical && dataset ?
        <footer className={`${styles['footer']}`} >
          <Trans
            i18nKey="graphs:graph_graph.historical_data_source"
            components={{ a: <a href={dataset.userFacingUrl} target="_blank" rel="noreferrer" /> }}
            tOptions={{ source: dataset.fullName ?? dataset.userFacingUrl }}
          />
        </footer>
        : null}
    </div>
  );
}