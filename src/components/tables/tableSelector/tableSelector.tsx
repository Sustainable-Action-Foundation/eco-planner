"use client"

import React, { ChangeEvent, Dispatch, SetStateAction } from 'react';
import RadioImage from './radioImage';
import { ViewMode } from '../goals';
import { setStoredViewMode } from '../functions/tableFunctions';
import { useTranslation } from "react-i18next";

export default function TableSelector({ id, current, setter }: { id: string, current: ViewMode | "", setter: Dispatch<SetStateAction<ViewMode | "">> }) {
  const { t } = useTranslation("components");

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

  return (
    <div className='flex align-items-center gap-25'>
      {/* TODO TABLER_ICONS: Figure out how to replace using tabler icons */}
      <RadioImage text={t("components:table_selector.tree")} value={ViewMode.Tree} src="/icons/listTree.svg" name="table" checked={current == ViewMode.Tree} onChange={handleRadioChange} />
      <RadioImage text={t("components:table_selector.table")} value={ViewMode.Table} src="/icons/table.svg" name="table" checked={current == ViewMode.Table} onChange={handleRadioChange} />
      <RadioImage text={t("components:table_selector.actions")} value={ViewMode.Actions} src="/icons/list.svg" name="table" checked={current == ViewMode.Actions} onChange={handleRadioChange} />
    </div>
  );
}
