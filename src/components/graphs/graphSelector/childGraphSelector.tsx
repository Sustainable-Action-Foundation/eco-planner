import { DataSeries, Goal } from "@prisma/client";
import { ChildGraphType } from "../childGraphs/childGraphContainer";
import { ChangeEvent, Dispatch, SetStateAction, useContext } from "react";
import { setStoredChildGraphType } from "../functions/graphFunctions";
import parentDict from "../graphs.dict.json" with { type: "json" };
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
  const dict = parentDict.graphSelector.childGraphSelector;
  const locale = useContext(LocaleContext);

  const handleSelectChange = (event: ChangeEvent<HTMLSelectElement>) => {
    if (Object.values(ChildGraphType).includes(event.target.value as ChildGraphType)) {
      setStoredChildGraphType(event.target.value as ChildGraphType, goal.id);
      setter(event.target.value as ChildGraphType);
    } else {
      console.log(dict.handleSelectChange.invalidGraphType[locale]);
      // Don't update local storage if the selection is invalid
      setter(ChildGraphType.Target);
    }
  };

  // Set the selectedOption as the context value
  return (
    <>
      <select onChange={handleSelectChange} value={currentSelection} style={{ padding: '.3rem .5rem', borderRadius: '2px' }}>
        <option value={ChildGraphType.Target}>{dict.return.options.goals[locale]}</option>
        <option value={ChildGraphType.Prediction}>{dict.return.options.expectedEffects[locale]}</option>
      </select>
    </>
  );
}