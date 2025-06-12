"use client"

import React, { ChangeEvent, Dispatch, SetStateAction } from 'react';
import RadioImage from './radioImage';
import { ViewMode } from '../goals';
import { setStoredViewMode } from '../functions/tableFunctions';
import { useTranslation } from "react-i18next";
import { IconList, IconListTree, IconTableFilled } from '@tabler/icons-react';

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
      <RadioImage value={ViewMode.Tree} name="table" checked={current == ViewMode.Tree} onChange={handleRadioChange}>
        {t("components:table_selector.tree")}
        <IconListTree  aria-hidden="true" style={{minWidth: '24px'}} />
      </RadioImage>
      <RadioImage value={ViewMode.Table} name="table" checked={current == ViewMode.Table} onChange={handleRadioChange}>
        {t("components:table_selector.table")}
        <IconTableFilled aria-hidden="true" style={{minWidth: '24px'}}/>
      </RadioImage>
      <RadioImage value={ViewMode.Actions} name="table" checked={current == ViewMode.Actions} onChange={handleRadioChange}>
        {t("components:table_selector.actions")}
        <IconList aria-hidden="true" style={{minWidth: '24px'}}/>
      </RadioImage>
    </div>
  );
}
