import { DataSeries, Goal } from "@prisma/client";
import { ChildGraphType } from "../childGraphs/childGraphContainer.tsx";
import { ChangeEvent, Dispatch, SetStateAction, useContext } from "react";
import { setStoredChildGraphType } from "../functions/graphFunctions.ts";
import { createDict } from "../graphs.dict.ts";
import { LocaleContext } from "@/app/context/localeContext.tsx";

export default function ChildGraphSelector({
  goal,
  currentSelection,
  setter,
}: {
  goal: Goal & { dataSeries: DataSeries | null },
  currentSelection: ChildGraphType,
  setter: Dispatch<SetStateAction<ChildGraphType>>
}) {
  const locale = useContext(LocaleContext);
  const dict = createDict(locale).graphSelector.childGraphSelector;

  const handleSelectChange = (event: ChangeEvent<HTMLSelectElement>) => {
    if (Object.values(ChildGraphType).includes(event.target.value as ChildGraphType)) {
      setStoredChildGraphType(event.target.value as ChildGraphType, goal.id);
      setter(event.target.value as ChildGraphType);
    } else {
      console.log(dict.handleSelectChange.invalidGraphType);
      // Don't update local storage if the selection is invalid
      setter(ChildGraphType.Target);
    }
  };

  // Set the selectedOption as the context value
  return (
    <>
      <select onChange={handleSelectChange} value={currentSelection} style={{ padding: '.3rem .5rem', borderRadius: '2px' }}>
        <option value={ChildGraphType.Target}>{dict.return.options.goals}</option>
        <option value={ChildGraphType.Prediction}>{dict.return.options.expectedEffects}</option>
      </select>
    </>
  );
}