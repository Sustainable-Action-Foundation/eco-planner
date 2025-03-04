import React, { ChangeEvent, Dispatch, SetStateAction, useContext } from 'react';
import RadioImage from './radioImage';
import { ViewMode } from '../goals';
import { setStoredViewMode } from '../functions/tableFunctions';
import { createDict } from "../tables.dict.ts";
import { LocaleContext } from '@/app/context/localeContext.tsx';

export default function TableSelector({ id, current, setter }: { id: string, current: ViewMode | "", setter: Dispatch<SetStateAction<ViewMode | "">> }) {
  const locale = useContext(LocaleContext);
  const dict = createDict(locale).tableSelector.tableSelector;

  const handleRadioChange = (event: ChangeEvent<HTMLInputElement>) => {
    setStoredViewMode(event.target.value, id);
    if (Object.values(ViewMode).includes(event.target.value as ViewMode)) {
      setter(event.target.value as ViewMode);
    }
    else {
      console.log("Invalid view mode")
      setter("");
    }
  };

  // Set the selectedOption as the context value
  return (
    <div className='flex align-items-center gap-25'>
      <RadioImage text={dict.treeDisplay} value={ViewMode.Tree} src="/icons/listTree.svg" name="table" checked={current == ViewMode.Tree} onChange={handleRadioChange} />
      <RadioImage text={dict.tableDisplay} value={ViewMode.Table} src="/icons/table.svg" name="table" checked={current == ViewMode.Table} onChange={handleRadioChange} />
      <RadioImage text={dict.actionsDisplay} value={ViewMode.Actions} src="/icons/list.svg" name="table" checked={current == ViewMode.Actions} onChange={handleRadioChange} />
    </div>
  );
}
