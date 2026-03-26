"use client"

import { goalSorter, goalSorterActionAmount, goalSorterActionAmountReverse, goalSorterInterest, goalSorterReverse } from '@/lib/sorters';
import { GoalSortBy } from '../goals';
import styles from '../tables.module.css' with { type: "css" };
import { useTranslation } from "react-i18next";
import Link from 'next/link';
import type { Goal, Roadmap } from "@/types";
import type { ReactNode } from "react";

type GoalTableCommonProps = {
  sortBy?: GoalSortBy;
};

type GoalTableWithGoals = {
  goals: Goal[];
  roadmap?: never;
} & GoalTableCommonProps;

type GoalTableWithRoadmap = {
  goals?: never;
  roadmap: Roadmap;
} & GoalTableCommonProps;

type GoalTableProps = GoalTableWithGoals | GoalTableWithRoadmap;

export default function GoalTable({
  goals,
  roadmap,
  sortBy,
}: GoalTableProps): ReactNode {
  const { t } = useTranslation("components");

  // Failsafe in case wrong props are passed
  if (
    (!goals && !roadmap)
    || (goals && roadmap)
  ) throw new Error('GoalTable: Either `goals` XOR `roadmap` must be provided');

  const parsedGoals: Goal[] = [];

  if (!goals && roadmap) {
    const stripGoals = (roadmap: Roadmap): Goal["roadmap"] => {
      const {
        goals,
        ...interestingData
      } = roadmap;
      return interestingData satisfies Goal["roadmap"];
    };
    for (const goal of roadmap.goals) {
      parsedGoals.push({
        ...goal,
        roadmap: stripGoals(roadmap),
        effects: [],
        comments: [],
        links: [],
        baseline: null,
        dataSeries: null,
      });
    }
  }
  else {
    parsedGoals.push(...goals);
  }

  if (!parsedGoals.length) return <p>
    {t("components:goal_table.no_goals")}
  </p>;

  switch (sortBy) {
    case GoalSortBy.Alpha:
      parsedGoals.sort(goalSorter);
      break;
    case GoalSortBy.AlphaReverse:
      parsedGoals.sort(goalSorterReverse);
      break;
    case GoalSortBy.ActionsFalling:
      parsedGoals.sort(goalSorterActionAmount);
      break;
    case GoalSortBy.ActionsRising:
      parsedGoals.sort(goalSorterActionAmountReverse);
      break;
    case GoalSortBy.Interesting:
      parsedGoals.sort(goalSorterInterest);
      break;
    case GoalSortBy.Default:
    default:
      parsedGoals.sort(goalSorter);
      break;
  }

  return <>
    <div className="overflow-x-scroll smooth">
      <table id="goalTable" className={styles.table}>
        <thead>
          <tr>
            <th>{t("components:goal_table.goal_name")}</th>
            <th>{t("components:goal_table.leap_parameter")}</th>
            <th>{t("components:goal_table.unit")}</th>
            <th>{t("components:goal_table.action_count")}</th>
          </tr>
        </thead>
        <tbody>
          {parsedGoals.map(goal => (goal &&
            <tr key={goal.id}>
              <td><Link href={`/goal/${goal.id}`}>{goal.name ?? goal.indicatorParameter}</Link></td>
              <td>{goal.indicatorParameter}</td>
              <td>{goal.dataSeries?.unit === null ? t("common:tsx.unitless") : goal.dataSeries?.unit ?? t("common:tsx.unit_missing")}</td>
              <td>{goal._count.effects}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </>
}