import React, { ChangeEvent, Dispatch, SetStateAction } from 'react';
import { DataSeries, Goal } from "@prisma/client";
import { GraphType } from "../graphGraph";
import { setStoredGraphType } from '../functions/graphFunctions';

export default function GraphSelector({
  goal,
  currentSelection,
  setter,
}: {
  goal: Goal & { dataSeries: DataSeries | null },
  currentSelection: GraphType | "",
  setter: Dispatch<SetStateAction<GraphType | "">>
}) {
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

  const percentAndFraction = ['procent', 'percent', '%', 'andel', 'fraction'];

  // Set the selectedOption as the context value
  return (
    <>
      <select onChange={handleSelectChange} value={currentSelection} style={{ padding: '.3rem .5rem', borderRadius: '2px' }}>
        <option value={GraphType.Main}>Målbana</option>
        <option value={GraphType.Delta}>Årlig förändring</option>
        { // Don't allow relative graph if the main graph is already percent or fraction
          !percentAndFraction.includes(goal.dataSeries?.unit?.toLowerCase() ?? "") &&
          <option value={GraphType.Relative}>Procentuell förändring</option>
        }
      </select>
    </>
  );
}
