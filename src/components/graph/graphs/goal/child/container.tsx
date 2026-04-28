"use client"

import GoalChildGraph from "./children";
import PredictionChildGraph from "./prediction";
import { useState } from "react";
import { getStoredChildGraphType } from "../../../functions/graphFunctions";
import { percentAndFraction } from "../../../graphSelectors/graphSelector";
import ChildGraphSelector from "../../../graphSelectors/childGraphSelector";
import { useTranslation } from "react-i18next";
import { IconChartAreaLineFilled, IconLink } from "@tabler/icons-react";
import type { Goal } from "@/types";
import styles from '../goal.module.css'

export const ChildGraphType = {
  Target: "TARGET",
  Prediction: "PREDICTION",
} as const;
export type ChildGraphType = (typeof ChildGraphType)[keyof typeof ChildGraphType];

export default function ChildGraphContainer({
  goal,
  childGoals,
}: {
  goal: Goal;
  childGoals: Goal[];
}) {
  const { t } = useTranslation("graphs");

  const [childGraphType, setChildGraphType] = useState<ChildGraphType>((() => {
    const storedGraphType = getStoredChildGraphType(goal.id);
    if (Object.values(ChildGraphType).includes(storedGraphType)) {
      return storedGraphType;
    }
    else return ChildGraphType.Target;
  })());

  // Default to stacked unless the unit is percent or fraction
  const [isStacked, setIsStacked] = useState(!percentAndFraction.includes(goal.dataSeries?.unit?.toLowerCase() ?? ""));

  function childGraphSwitch(childGraphType: string) {
    switch (childGraphType) {
      case ChildGraphType.Target:
        return <GoalChildGraph goal={goal} childGoals={childGoals} isStacked={isStacked} />
      case ChildGraphType.Prediction:
        return <PredictionChildGraph goal={goal} childGoals={childGoals} isStacked={isStacked} />
      default:
        return childGraphSwitch(ChildGraphType.Target);
    }
  };

  return (
    <div className={`${styles['tab-panel']}`}>
      <header>
        <menu className={`${styles['menu']}`}>
          <ChildGraphSelector goal={goal} currentSelection={childGraphType} setter={setChildGraphType} />
          <button
            className="display-flex align-items-center gap-50 gray-90 font-weight-500 width-fit-content line-height-150 font-size-75"
            style={{ padding: '.3rem .6rem' }}
            type="button" onClick={() => setIsStacked(!isStacked)}
          >
            {t("graphs:common.change_graph_type")}
            <IconChartAreaLineFilled aria-hidden="true" width={16} height={16} />
          </button>
        </menu>
        <h2 className={`${styles['heading']}`}>
          {t("graphs:child_graph_container.goals_toward", { goalName: goal.name ? `${goal.name}` : `${goal.indicatorParameter}` })}
        </h2>
      </header>

      <div className={`${styles['body']}`}>
        {childGraphSwitch(childGraphType)}
      </div>

      <footer className={`${styles['footer']}`} >
        <nav className="flex gap-75 flex-wrap-wrap justify-content-center">
          {childGoals.map((child, index) =>
            <span key={child.id} className="flex gap-50 line-height-100">
              <a href={`/goal/${child.id}`} className="flex gap-25 align-items-center">
                <IconLink width={14} height={14} strokeWidth={1.5} />
                {child.name || child.indicatorParameter.split('\\').at(-1)} ({child.roadmap.metaRoadmap.name || t("graphs:common.unknown_roadmap")})
              </a>
              {index !== childGoals.length - 1 ?
                <hr aria-orientation="vertical" className="padding-0 margin-block-25" /> /* TODO: Need to add orientation aria to other HR */
                : null}
            </span>
          )}
        </nav>
      </footer>
    </div>
  );
} 