"use client";

import React, { ChangeEvent, Dispatch, SetStateAction } from 'react';
import { DataSeries, Goal } from "@prisma/client";
import { GraphType } from "../graphs/goal/main/container";
import { setStoredGraphType } from '../functions/graphFunctions';
import { useTranslation } from "react-i18next";

export const percentAndFraction = ['procent', 'percent', '%', 'andel', 'fraction'];

export default function GraphSelector({
  goal,
  childGoals,
  siblings,
  currentSelection,
  setter,
}: {
  goal: Goal & { dataSeries: DataSeries | null },
  childGoals: boolean,
  siblings: boolean,
  currentSelection: GraphType | "",
  setter: Dispatch<SetStateAction<GraphType | "">>
}) {
  const { t } = useTranslation(["graphs", "common", "pages"]);

  const handleSelectChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setStoredGraphType(event.target.value, goal.id);
    if (Object.values(GraphType).includes(event.target.value as GraphType)) {
      setter(event.target.value as GraphType);
    }
    else {
      console.log("Invalid graph type");
      setter("");
    }
  };

  // TODO: Probably makes sense to switch between graphs using radio buttons rather than this select
  return (
    <div className='floating-label'>
      <label htmlFor='select-graphType' style={{ "--background": "linear-gradient(var(--gray-95) 50%, white 100%)" } as React.CSSProperties} >
        {t("common:tsx.show")}
      </label>
      <select
        id='select-graphType'
        className='block smooth'
        style={{ "--padding": ".3rem", "--icon-size": '16px', fontSize: '.75rem', minWidth: 'unset' } as React.CSSProperties}
        onChange={handleSelectChange}
        value={currentSelection}
      >
        <option value={GraphType.Main}>{t("graphs:graph_selector.goal")}</option>
        <option value={GraphType.Delta}>{t("graphs:graph_selector.annual_change")}</option>
        { // Don't allow relative graph if the main graph is already percent or fraction
          !percentAndFraction.includes(goal.dataSeries?.unit?.toLowerCase() ?? "") &&
          <option value={GraphType.Relative}>{t("graphs:graph_selector.percentage_change")}</option>
        }
        {childGoals && <option value={GraphType.Children}>{t("pages:goal.goals_working_towards", { goalName: goal.name ? goal.name : goal.indicatorParameter })}</option>}
        {siblings && <option value={GraphType.Siblings}>{t("pages:goal.related_goals")}</option>}
      </select>
    </div>
  );
}
