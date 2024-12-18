import React, { ChangeEvent, Dispatch, SetStateAction } from 'react';
import RadioImage from './radioImage';
import { DataSeries, Goal } from "@prisma/client";
import { GraphType } from "../graphGraph";
import { setStoredGraphType } from '../functions/graphFunctions';

export default function GraphSelector({
  goal,
  current,
  setter,
}: {
  goal: Goal & { dataSeries: DataSeries | null },
  current: GraphType | "",
  setter: Dispatch<SetStateAction<GraphType | "">>
}) {
  const handleRadioChange = (event: ChangeEvent<HTMLInputElement>) => {
    setStoredGraphType(event.target.value, goal.id);
    if (Object.values(GraphType).includes(event.target.value as GraphType)) {
      setter(event.target.value as GraphType);
    }
    else {
      console.log("Invalid graph type");
      setter("");
    }
  };

  const percentAndFraction = ['procent', 'percent', '%', 'andel', 'fraction'];

  // Set the selectedOption as the context value
  return (
    <>
      <RadioImage text='Målbana' value={GraphType.Main} name="graph" checked={current == GraphType.Main} onChange={handleRadioChange} />
      <RadioImage text='Årlig förändring' value={GraphType.Delta} name="graph" checked={current == GraphType.Delta} onChange={handleRadioChange} />
      { // Don't allow relative graph if the main graph is already percent or fraction
        !percentAndFraction.includes(goal.dataSeries?.unit?.toLowerCase() ?? "") &&
        <RadioImage text='Procentuell förändring' value={GraphType.Relative} name="graph" checked={current == GraphType.Relative} onChange={handleRadioChange} />
      }
    </>
  );
}
