import React, { ChangeEvent, Dispatch, SetStateAction } from 'react';
import RadioImage from './radioImage';
import { ViewMode } from '../goals';
import { setStoredViewMode } from '../functions/tableFunctions';
import { getClientLocale, validateDict } from '@/functions/clientLocale';
import dict from './tableSelector.dict.json' assert { type: "json" };

export default function TableSelector({ id, current, setter }: { id: string, current: ViewMode | "", setter: Dispatch<SetStateAction<ViewMode | "">> }) {
  validateDict(dict);
  const locale = getClientLocale();

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
      <RadioImage text={dict.treeDisplay[locale]} value={ViewMode.Tree} src="/icons/listTree.svg" name="table" checked={current == ViewMode.Tree} onChange={handleRadioChange} />
      <RadioImage text={dict.tableDisplay[locale]} value={ViewMode.Table} src="/icons/table.svg" name="table" checked={current == ViewMode.Table} onChange={handleRadioChange} />
      <RadioImage text={dict.actionsDisplay[locale]} value={ViewMode.Actions} src="/icons/list.svg" name="table" checked={current == ViewMode.Actions} onChange={handleRadioChange} />
    </div>
  );
}
