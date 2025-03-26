import React, { ChangeEvent, Dispatch, SetStateAction } from 'react';
import { DataSeries, Goal } from "@prisma/client";
import { GraphType } from "../graphGraph";
import { setStoredGraphType } from '../functions/graphFunctions';
import { useTranslation } from "react-i18next";

export const percentAndFraction = ['procent', 'percent', '%', 'andel', 'fraction'];

export default function GraphSelector({
  goal,
  currentSelection,
  setter,
}: {
  goal: Goal & { dataSeries: DataSeries | null },
  currentSelection: GraphType | "",
  setter: Dispatch<SetStateAction<GraphType | "">>
}) {
  const { t } = useTranslation();

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

  // Set the selectedOption as the context value
  return (
    <>
      <label className='font-weight-500'>
        {t("components:graph_selector.show")}
        <select className='block margin-top-25' onChange={handleSelectChange} value={currentSelection}
          style={{ padding: '.3rem calc(.5rem * 2 + 20px) .3rem .5rem', borderRadius: '2px', backgroundSize: '20px', fontSize: '.75rem' }}>
          <option value={GraphType.Main}>{t("components:graph_selector.goal")}</option>
          <option value={GraphType.Delta}>{t("components:graph_selector.annual_change")}</option>
          { // Don't allow relative graph if the main graph is already percent or fraction
            !percentAndFraction.includes(goal.dataSeries?.unit?.toLowerCase() ?? "") &&
            <option value={GraphType.Relative}>{t("components:graph_selector.percentage_change")}</option>
          }
        </select>
      </label>
    </>
  );
}
