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
        className: 'padding-25 padding-bottom-0 grid', /* TODO: This grid needs to be responsive */
        style: {
          paddingTop: '3px', /* 3px instead of 4px (.25rem) to compensate for the 1px offset on the tabs */
          gridTemplateColumns: 'repeat(3, 175px)',
          backgroundColor: 'var(--gray-90)',
          borderRadius: '.5rem .5rem 0 0',
          border: '1px solid var(--gray-80)',
          borderBottom: '0'
        }
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