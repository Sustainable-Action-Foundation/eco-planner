'use client';

import { RoadmapType } from "@/lib/prisma/generated";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Fragment, useEffect, useState, useTransition } from "react";
import { useTranslation } from "react-i18next";
import { useDebouncedCallback } from "use-debounce";

export default function RoadmapFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = useTranslation(["components", "common"]);

  const [_isPending, startTransition] = useTransition();

  const [selectedFilterTypes, setSelectedFiltersTypes] = useState<Array<string>>(
    searchParams.getAll('typeFilter'),
  );

  // Need this useffect to sync local state if URL changes via links or backbuttons
  useEffect(() => {
    setSelectedFiltersTypes(searchParams.getAll('typeFilter'));
  }, [searchParams]);

  // Removes current params and replaces them with our string array from  the usestate
  const debouncedUrlSync = useDebouncedCallback((selectedFilterTypes: Array<string>) => {
    const newParams = new URLSearchParams(window.location.search);
    newParams.delete('typeFilter');
    selectedFilterTypes.forEach(filterType => newParams.append('typeFilter', filterType));

    startTransition(() => {
      router.replace(`${pathname}?${newParams.toString()}`, { scroll: false });
    });
  }, 300);

  // Update usestate immediately when toggling a checkbox
  // Then debounce when actually updating the URL params
  // We do this so that we can update all changed toogle states simultaneously as it 
  // debouncing each individual toggle could create issues when syncing URL params with local state. 
  const handleToggle = (value: string, checked: boolean) => {
    const nextState = checked
      ? [...selectedFilterTypes, value]
      : selectedFilterTypes.filter(filterType => filterType !== value);
    setSelectedFiltersTypes(nextState);

    debouncedUrlSync(nextState);
  };

  return <>
    <menu className="margin-0 padding-0">
      <fieldset id="roadmapFilters" className="padding-0 fieldset-unset-pseudo-class smooth margin-top-150 flex flex-wrap-wrap gap-50" style={{ border: '0' }}>
        <legend className="margin-bottom-100" style={{textShadow: '0 0 black'}}>{`${t("components:roadmap_filters.roadmap_type")}`}</legend>
        {Object.values(RoadmapType).map((filterType, key) => (
          <Fragment key={key}>
            <label className="chip flex-grow-100">
              <input 
                type="checkbox" 
                value={filterType} 
                checked={selectedFilterTypes.includes(filterType)}
                onChange={(e) => handleToggle(filterType, e.target.checked)}
              />
              {t("common:scope." + filterType.toLowerCase())}
            </label>
          </Fragment>
        ))}
      </fieldset>
    </menu >
  </>;
}
