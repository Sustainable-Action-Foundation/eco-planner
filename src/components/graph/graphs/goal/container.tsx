"use client";

import TabListSimple from "@/components/generic/tablist/tabListSimple";
import ChildGraphContainer from "./child/container";
import SiblingGraph from "./sibling/siblings";
import findSiblings from "@/functions/findSiblings";
import type { Effect, Goal, Roadmap } from "@/types";
import type { ApiTableData } from "@/lib/api/apiTypes";
import GraphGraph from "./main/container";
import styles from './goal.module.css';
import { useTranslation } from "react-i18next";
import type { LoginData } from "@/lib/session";

// TODO: Rename file and component
// TODO: Shared styling for goal graphs
export default function GoalGraph({
  goal,
  parentGoal,
  childGoals,
  roadmap,
  parentGoalRoadmap,
  externalData,
  secondaryGoal,
  effects,
  session,
  roadmapOptions,
}: {
  goal: Goal,
  parentGoal: Goal | null,
  childGoals: Goal[],
  roadmap: Roadmap,
  parentGoalRoadmap: Roadmap | null,
  externalData?: ApiTableData | null,
  secondaryGoal: Goal | null,
  effects: Effect[] | Goal["effects"],
  session: LoginData,
  roadmapOptions: {
    id: string;
    name: string;
    version: number;
    actor: string | null;
  }[]
}) {

  const { t } = useTranslation(["pages", "common"]);

  const siblings = findSiblings(roadmap, goal);

  if (!(childGoals.length > 0) && !(siblings.length > 1)) {
    return (
      <section>
        <GraphGraph
          goal={goal}
          parentGoal={parentGoal}
          childGoals={childGoals}
          roadmap={roadmap}
          parentGoalRoadmap={parentGoalRoadmap}
          historicalData={externalData}
          secondaryGoal={secondaryGoal}
          effects={effects}
          session={session}
          roadmapOptions={roadmapOptions}
        />
      </section>
    );
  }

  return (
    <section>
      <TabListSimple
        props={{
          className: `padding-inline-25 padding-bottom-0 grid ${styles['tablist']}`,
        }}
      >
        <TabListSimple.Tab
          className={`font-size-14px padding-25 ${styles['tab']}`}
          style={{ textTransform: 'capitalize' }}
        >
          {t("common:goal_one")}
        </TabListSimple.Tab>
        {childGoals.length > 0 ?
          <TabListSimple.Tab
            className={`font-size-14px padding-25 ${styles['tab']}`}
          >
            {t("pages:goal.sub_goals")}
          </TabListSimple.Tab>
          : null }
        {siblings.length > 1 ?
          <TabListSimple.Tab
            className={`font-size-14px padding-25 ${styles['tab']}`}
          >
            {t("pages:goal.related_goals")}
          </TabListSimple.Tab>
          : null}

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
            session={session}
            roadmapOptions={roadmapOptions}
          />
        </TabListSimple.TabPanel>
        {childGoals.length > 0 ?
          <TabListSimple.TabPanel>
            <ChildGraphContainer goal={goal} childGoals={childGoals} />
          </TabListSimple.TabPanel>
          : null}
        {siblings.length > 1 ?
          <TabListSimple.TabPanel>
            <SiblingGraph roadmap={roadmap} goal={goal} />
          </TabListSimple.TabPanel>
          : null}
      </TabListSimple>
    </section>
  );
}