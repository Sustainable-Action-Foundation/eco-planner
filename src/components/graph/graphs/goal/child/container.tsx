"use client"

import GoalChildGraph from "./children.tsx";
import PredictionChildGraph from "./prediction.tsx";
import { useEffect, useState } from "react";
import { getStoredChildGraphType } from "../../../functions/graphFunctions.ts";
import { percentAndFraction } from "../../../graphSelectors/graphSelector.tsx";
import ChildGraphSelector from "../../../graphSelectors/childGraphSelector.tsx";
import { useTranslation } from "react-i18next";
import { IconChartAreaLineFilled, IconLink } from "@tabler/icons-react";
import { Goal } from "@/types.ts";
import { graphHeight } from "../config.tsx";

export const ChildGraphType = {
  Target: "TARGET",
  Prediction: "PREDICTION",
} as const;
export type ChildGraphType = (typeof ChildGraphType)[keyof typeof ChildGraphType];

export default function ChildGraphContainer({
  goal,
  childGoals,
  children,
}: {
  goal: Goal;
  childGoals: Goal[];
  children?: React.ReactNode;
}) {
  const { t } = useTranslation("graphs");

  const [childGraphType, setChildGraphType] = useState<ChildGraphType>(ChildGraphType.Target);
  // Default to stacked unless the unit is percent or fraction
  const [isStacked, setIsStacked] = useState(!percentAndFraction.includes(goal.dataSeries?.unit?.toLowerCase() ?? ""));

  useEffect(() => {
    const storedGraphType = getStoredChildGraphType(goal.id);
    if (Object.values(ChildGraphType).includes(storedGraphType)) {
      setChildGraphType(storedGraphType);
    }
  }, [goal.id]);

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
    <div className="purewhite" style={{ border: '1px solid var(--gray-80)', borderTop: 0, borderRadius: '0 0 .25rem .25rem' }}>
      <header>
        <menu className="flex align-items-flex-end gap-25 margin-0 padding-25 flex-wrap-wrap padding-top-50" style={{ backgroundColor: 'var(--gray-95)', borderBottom: '1px solid var(--gray-80)' }}>
          <ChildGraphSelector goal={goal} currentSelection={childGraphType} setter={setChildGraphType} />
          <button
            className="display-flex align-items-center gap-50 gray-90 font-weight-500"
            style={{ width: 'fit-content', fontSize: '.75rem', padding: '.3rem .6rem', lineHeight: '1.5' }}
            type="button" onClick={() => setIsStacked(!isStacked)}
          >
            {t("graphs:common.change_graph_type")}
            <IconChartAreaLineFilled aria-hidden="true" width={16} height={16} />
          </button>
          {children}
        </menu>
        <h2 className="text-align-center block font-weight-500 margin-top-200 margin-bottom-50" style={{ fontSize: '1.5rem' }}>
          {t("graphs:child_graph_container.goals_toward", { goalName: goal.name ? `${goal.name}` : `${goal.indicatorParameter}` })}
        </h2>
      </header>

      <div style={{ height: graphHeight }} className="padding-inline-25 padding-bottom-50">
        {childGraphSwitch(childGraphType)}
      </div>
      
      <footer>
        <nav
          className="font-size-14px flex gap-75 flex-wrap-wrap justify-content-center padding-50"
          style={{ borderTop: '1px solid var(--gray-80)', backgroundColor: 'var(--tertiary-neutral)', borderRadius: '0 0 .25rem .25rem' }}
        >
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