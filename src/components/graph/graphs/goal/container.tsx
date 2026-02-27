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
// TODO: Rename file and component
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
  parentGoalRoadmap:  Roadmap | null,
  externalData?: ApiTableContent | null,
  secondaryGoal: Goal | null,
  effects: Effect[] | Goal["effects"],
  children?: React.ReactNode,
}) {
  return (
    <TabListSimple >
      <TabListSimple.Tab>Målbana</TabListSimple.Tab>
      <TabListSimple.Tab>Underliggande målbanor</TabListSimple.Tab>
      <TabListSimple.Tab>Angränsande målbanor</TabListSimple.Tab>
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
      : null }
      {findSiblings(roadmap, goal).length > 1 ?
        <TabListSimple.TabPanel>
          <SiblingGraph roadmap={roadmap} goal={goal} />
        </TabListSimple.TabPanel>
      : null }
    </TabListSimple>
  )
}