"use client";

import { goalSorter, goalSorterActionAmount, goalSorterActionAmountReverse, goalSorterInterest, goalSorterReverse } from '@/lib/sorters';
import type { Goal, RoadmapIteration } from "@/types";
import { GoalSortBy } from "@/types/enums";
import styles from '../tables.module.css' with { type: "css" };
import { useTranslation } from "react-i18next";
import Link from 'next/link';
import type { ReactNode } from "react";

type GoalTableCommonProps = {
  sortBy?: GoalSortBy;
};

type GoalTableWithGoals = {
  goals: Goal[];
  iteration?: never;
} & GoalTableCommonProps;

type GoalTableWithIteration = {
  goals?: never;
  iteration: RoadmapIteration;
} & GoalTableCommonProps;

type GoalTableProps = GoalTableWithGoals | GoalTableWithIteration;

export default function GoalTable({
  goals,
  iteration,
  sortBy,
}: GoalTableProps): ReactNode {
  const { t } = useTranslation("components");

  // Failsafe in case wrong props are passed
  if (
    (!goals && !iteration)
    || (goals && iteration)
  ) throw new Error('GoalTable: Either `goals` XOR `iteration` must be provided');

  const parsedGoals: Goal[] = [];

  if (!goals && iteration) {
    const stripGoals = (iteration: RoadmapIteration): Goal["roadmap_iteration"] => {
      const {
        goals,
        ...interestingData
      } = iteration;
      return interestingData satisfies Goal["roadmap_iteration"];
    };
    for (const goal of iteration.goals) {
      parsedGoals.push({
        ...goal,
        roadmap_iteration: stripGoals(iteration),
        effects: [],
        comments: [],
        baseline: null,
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
    case GoalSortBy.Alpha: {
      parsedGoals.sort(goalSorter);
      break;
    }
    case GoalSortBy.AlphaReverse: {
      parsedGoals.sort(goalSorterReverse);
      break;
    }
    case GoalSortBy.ActionsFalling: {
      parsedGoals.sort(goalSorterActionAmount);
      break;
    }
    case GoalSortBy.ActionsRising: {
      parsedGoals.sort(goalSorterActionAmountReverse);
      break;
    }
    case GoalSortBy.Interesting: {
      parsedGoals.sort(goalSorterInterest);
      break;
    }
    case GoalSortBy.Default:
    case undefined:
    default: {
      parsedGoals.sort(goalSorter);
      break;
    }
  }

  return <div className="overflow-x-scroll smooth">
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
            <td><Link href={`/goal/${goal.id}`}>{goal.name || goal.indicator_parameter}</Link></td>
            <td>{goal.indicator_parameter}</td>
            <td>{goal.data_series?.unit === null ? t("common:tsx.unitless") : goal.data_series?.unit || t("common:tsx.unit_missing")}</td>
            <td>{goal._count.effects}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>;
}