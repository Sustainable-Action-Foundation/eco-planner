import { goalSorter, goalSorterActionAmount, goalSorterActionAmountReverse, goalSorterInterest, goalSorterReverse } from '@/lib/sorters';
import { GoalSortBy } from '../goals';
import styles from '../tables.module.css' with { type: "css" };
import { DataSeries, Goal } from "@prisma/client";
import { useTranslation } from "react-i18next";

interface GoalTableCommonProps {
  sortBy?: GoalSortBy,
}

interface GoalTableWithGoals extends GoalTableCommonProps {
  goals: (Goal & {
    _count: { effects: number }
    dataSeries: DataSeries | null,
    roadmap: { id: string, metaRoadmap: { name: string, id: string } },
  })[],
  roadmap?: never,
}

interface GoalTableWithRoadmap extends GoalTableCommonProps {
  goals?: never,
  roadmap: {
    id: string,
    metaRoadmap: { name: string, id: string },
    goals: (Goal & {
      _count: { effects: number },
      dataSeries: DataSeries | null,
    })[]
  },
}

type GoalTableProps = GoalTableWithGoals | GoalTableWithRoadmap;

export default function GoalTable({
  goals,
  roadmap,
  sortBy,
}: GoalTableProps) {
  const { t } = useTranslation();

  // Failsafe in case wrong props are passed
  if ((!goals && !roadmap) || (goals && roadmap)) throw new Error('GoalTable: Either `goals` XOR `roadmap` must be provided');

  if (!goals) {
    goals = roadmap?.goals.map(goal => {
      return {
        ...goal,
        roadmap: (({ goals, ...data }) => data)(roadmap),
      }
    })
  }

  if (!goals?.length) return (<p>{t("components:goal_table.no_goals")}</p>);

  switch (sortBy) {
    case GoalSortBy.Alpha:
      goals.sort(goalSorter);
      break;
    case GoalSortBy.AlphaReverse:
      goals.sort(goalSorterReverse);
      break;
    case GoalSortBy.ActionsFalling:
      goals.sort(goalSorterActionAmount);
      break;
    case GoalSortBy.ActionsRising:
      goals.sort(goalSorterActionAmountReverse);
      break;
    case GoalSortBy.Interesting:
      goals.sort(goalSorterInterest);
      break;
    case GoalSortBy.Default:
    default:
      goals.sort(goalSorter);
      break;
  }

  return <>
    <div className="overflow-x-scroll smooth">
      <table id="goalTable" className={styles.table}>
        <thead>
          <tr>
            <th>{t("components:goal_table.goal_name")}</th>
            <th>{t("components:goal_table.LEAP_parameter")}</th>
            <th>{t("components:goal_table.unit")}</th>
            <th>{t("components:goal_table.action_count")}</th>
          </tr>
        </thead>
        <tbody>
          {goals.map(goal => (goal &&
            <tr key={goal.id}>
              <td><a href={`/goal/${goal.id}`}>{goal.name || goal.indicatorParameter}</a></td>
              <td>{goal.indicatorParameter}</td>
              <td>{goal.dataSeries?.unit}</td>
              <td>{goal._count.effects}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </>
}