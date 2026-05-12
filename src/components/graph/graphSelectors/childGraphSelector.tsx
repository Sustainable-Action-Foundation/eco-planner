"use client";

import type { DataSeries, Goal } from "@prisma/client";
import { ChildGraphType } from "../graphs/goal/child/container";
import type { ChangeEvent, Dispatch, SetStateAction } from "react";
import { setStoredChildGraphType } from "../functions/graphFunctions";
import { useTranslation } from "react-i18next";

export default function ChildGraphSelector({
  goal,
  currentSelection,
  setter,
}: {
  goal: Goal & { dataSeries: DataSeries | null },
  currentSelection: ChildGraphType,
  setter: Dispatch<SetStateAction<ChildGraphType>>
}) {
  const { t } = useTranslation("graphs");

  const handleSelectChange = (event: ChangeEvent<HTMLSelectElement>) => {
    if (Object.values(ChildGraphType).includes(event.target.value as ChildGraphType)) {
      setStoredChildGraphType(event.target.value as ChildGraphType, goal.id);
      setter(event.target.value as ChildGraphType);
    } else {
      console.log("Invalid graph type");
      // Don't update local storage if the selection is invalid
      setter(ChildGraphType.Target);
    }
  };

  return (
    <>
      <select onChange={handleSelectChange} value={currentSelection} style={{ "--padding": '.3rem', "--icon-size": "16px", fontSize: '.75rem' } as React.CSSProperties }>
        <option value={ChildGraphType.Target}>{t("graphs:child_graph_selector.target_goals")}</option>
        <option value={ChildGraphType.Prediction}>{t("graphs:common.expected_outcome")}</option>
      </select>
    </>
  );
}