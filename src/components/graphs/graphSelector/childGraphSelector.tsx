"use client";

import { DataSeries, Goal } from "@prisma/client";
import { ChildGraphType } from "../childGraphs/childGraphContainer";
import { ChangeEvent, Dispatch, SetStateAction } from "react";
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
  const { t } = useTranslation();

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

  // Set the selectedOption as the context value
  return (
    <>
      <select onChange={handleSelectChange} value={currentSelection} style={{ padding: '.3rem .5rem', borderRadius: '2px', fontSize: '.75rem' }}>
        <option value={ChildGraphType.Target}>{t("graphs:child_graph_selector.target_goals")}</option>
        <option value={ChildGraphType.Prediction}>{t("graphs:common.expected_outcome")}</option>
      </select>
    </>
  );
}