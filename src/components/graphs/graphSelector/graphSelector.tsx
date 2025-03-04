import React, { ChangeEvent, Dispatch, SetStateAction, useContext } from 'react';
import { DataSeries, Goal } from "@prisma/client";
import { GraphType } from "../graphGraph.tsx";
import { setStoredGraphType } from '../functions/graphFunctions.ts';
import { createDict } from "../graphs.dict.ts";
import { LocaleContext } from '@/app/context/localeContext.tsx';

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
  const locale = useContext(LocaleContext);
  const dict = createDict(locale).graphSelector.graphSelector;

  const handleSelectChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setStoredGraphType(event.target.value, goal.id);
    if (Object.values(GraphType).includes(event.target.value as GraphType)) {
      setter(event.target.value as GraphType);
    }
    else {
      console.log(dict.handleSelectChange.invalidGraphType);
      setter("");
    }
  };

  // Set the selectedOption as the context value
  return (
    <>
      <select onChange={handleSelectChange} value={currentSelection} style={{ padding: '.3rem .5rem', borderRadius: '2px' }}>
        <option value={GraphType.Main}>{dict.return.options.main}</option>
        <option value={GraphType.Delta}>{dict.return.options.delta}</option>
        { // Don't allow relative graph if the main graph is already percent or fraction
          !percentAndFraction.includes(goal.dataSeries?.unit?.toLowerCase() ?? "") &&
          <option value={GraphType.Relative}>{dict.return.options.relative}</option>
        }
      </select>
    </>
  );
}
