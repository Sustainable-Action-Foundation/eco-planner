"use client"

import TabListSimple from "@/components/generic/tablist/tabListSimple";
import MainGraph from "./main/main";
import ChildGraphContainer from "./child/container";
import SiblingGraph from "./sibling/siblings";
import findSiblings from "@/functions/findSiblings";
import { Effect, Goal, Roadmap } from "@/types";
import getGoalByIndicator from "@/fetchers/getGoalByIndicator";
import { ApiTableContent } from "@/lib/api/apiTypes";
import GraphGraph from "./main/container";
import styles from '../../graphs.module.css'

// TODO: Rename file and component
// TODO: Single component for footer and header
// TODO: Shared styling for goal graphs
// TODO: Ensure styling leads to no layout shifting
// TODO: Messages for when childgoals and siblings dont exist (rather than not showing at all)
export default function GoalGraph({
  goal,
  parentGoal,
  childGoals,
  roadmap,
  parentGoalRoadmap,
  externalData,
  secondaryGoal,
  effects,
  children
}: {
  goal: Goal,
  parentGoal: Goal | null,
  childGoals: Goal[],
  roadmap: Roadmap,
  parentGoalRoadmap: Roadmap | null,
  externalData?: ApiTableContent | null,
  secondaryGoal: Goal | null,
  effects: Effect[] | Goal["effects"],
  children?: React.ReactNode,
}) {
  return (
    <TabListSimple
      props={{
        className: `padding-inline-25 padding-bottom-0 grid ${styles['graph-tablist']}`, /* TODO: This grid needs to be responsive */
      }}
    >
      <TabListSimple.Tab
        className={`font-size-14px padding-25 ${styles['graph-tab']}`}
      >
        Målbana {/* TODO: i18n */}
      </TabListSimple.Tab>
      <TabListSimple.Tab
        className={`font-size-14px padding-25 ${styles['graph-tab']}`}
      >
        Underliggande målbanor {/* TODO: i18n */}
      </TabListSimple.Tab>
      <TabListSimple.Tab
        className={`font-size-14px padding-25 ${styles['graph-tab']}`}
      >
        Angränsande målbanor {/* TODO: i18n */}
      </TabListSimple.Tab>
      <TabListSimple.TabPanel>
        <GraphGraph
          goal={goal}
          parentGoal={parentGoal}
          childGoals={childGoals}
          roadmap={roadmap}
          parentGoalRoadmap={parentGoalRoadmap}
          historicalData={externalData}
          secondaryGoal={secondaryGoal}
          effects={effects}
        >
          {children}
        </GraphGraph>
      </TabListSimple.TabPanel>
      {childGoals.length > 0 ?
        <TabListSimple.TabPanel>
          <ChildGraphContainer goal={goal} childGoals={childGoals} />
        </TabListSimple.TabPanel>
        : null}
      {findSiblings(roadmap, goal).length > 1 ?
        <TabListSimple.TabPanel>
          <SiblingGraph roadmap={roadmap} goal={goal} />
        </TabListSimple.TabPanel>
        : null}
    </TabListSimple>
  )
}