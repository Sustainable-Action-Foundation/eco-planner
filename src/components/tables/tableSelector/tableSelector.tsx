import 'client-only';
import type { ChangeEvent, Dispatch, SetStateAction } from 'react';
import RadioImage from './radioImage';
import { ViewMode } from "@/types/enums";
import { setStoredViewMode } from '../functions/tableFunctions';
import { useTranslation } from 'react-i18next';
import { IconListTree, IconTableFilled } from '@tabler/icons-react';
import { useIsClient } from '@/functions/useClientState';

export default function TableSelector({ id, current, setter }: { id: string, current: ViewMode | "", setter: Dispatch<SetStateAction<ViewMode | "">> }) {
  const { t } = useTranslation("components");
  // A choice made before hydration would be undone by it, so the radios wait
  const isClient = useIsClient();

  const handleRadioChange = (event: ChangeEvent<HTMLInputElement>) => {
    setStoredViewMode(event.target.value, id);
    if (Object.values(ViewMode).includes(event.target.value as ViewMode)) {
      setter(event.target.value as ViewMode);
    }
    else {
      console.warn("Invalid view mode");
      setter("");
    }
  };

  return (
    <div className='flex align-items-center gap-25'>
      <RadioImage value={ViewMode.Tree} name="table" checked={current === ViewMode.Tree} onChange={handleRadioChange} disabled={!isClient}>
        {t("components:table_selector.tree")}
        <IconListTree aria-hidden="true" style={{ minWidth: '24px' }} />
      </RadioImage>
      <RadioImage value={ViewMode.Table} name="table" checked={current === ViewMode.Table} onChange={handleRadioChange} disabled={!isClient}>
        {t("components:table_selector.table")}
        <IconTableFilled aria-hidden="true" style={{ minWidth: '24px' }} />
      </RadioImage>
    </div>
  );
}
