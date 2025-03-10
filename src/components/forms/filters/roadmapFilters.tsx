'use client';

import { RoadmapSortBy } from "@/types";
import { RoadmapType } from "@prisma/client";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useContext, useTransition } from "react";
import { useDebouncedCallback } from "use-debounce";
import { createDict } from "../forms.dict.ts";
import { LocaleContext } from "@/app/context/localeContext.tsx";

export default function RoadmapFilters() {
  const locale = useContext(LocaleContext);
  const dict = createDict(locale).filters.roadmapFilters;

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [_isPending, startTransition] = useTransition();

  const debouncedUpdateStringParam = useDebouncedCallback(updateStringParam, 300);

  function updateStringParam(key: string, value: string) {
    const newParams = new URLSearchParams(searchParams);

    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }

    startTransition(() => {
      router.replace(`${pathname}?${newParams.toString()}`)
    })
  }

  function updateArrayParam(key: string, value: string, remove?: boolean) {
    const newParams = new URLSearchParams(searchParams);

    if (remove) {
      newParams.delete(key, value);
    } else {
      newParams.append(key, value);
    }

    startTransition(() => {
      router.replace(`${pathname}?${newParams.toString()}`)
    })
  }

  return <>
    <menu className="flex gap-100 align-items-flex-end padding-0 margin-0 margin-top-300 margin-bottom-100 ">
      <label className="font-weight-bold container-text">
        {dict.menu.searchRoadmaps}
        <div className="margin-top-25 flex align-items-center gray-90 padding-50 smooth focusable">
          <Image src='/icons/search.svg' alt="" width={24} height={24} />
          <input type="search" className="padding-0 margin-inline-50" defaultValue={searchParams.get('searchFilter') ?? undefined} onChange={(e) => {
            debouncedUpdateStringParam('searchFilter', e.target.value)
          }} />
        </div>
      </label>
      <label className="font-weight-bold">
        {dict.menu.sortBy}
        <select
          className="font-weight-500 margin-top-25"
          style={{ fontSize: '1rem', minHeight: 'calc(24px + 1rem)' }}
          defaultValue={searchParams.get('sortBy') ?? ""} onChange={(e) => { updateStringParam('sortBy', e.target.value) }}
        >
          <option value="">{dict.menu.sortingOptions.default}</option>
          <option value={RoadmapSortBy.Alpha}>{dict.menu.sortingOptions.alpha}</option>
          <option value={RoadmapSortBy.AlphaReverse}>{dict.menu.sortingOptions.alphaReverse}</option>
          <option value={RoadmapSortBy.GoalsFalling}>{dict.menu.sortingOptions.goalsFalling}</option>
          <option value={RoadmapSortBy.GoalsRising}>{dict.menu.sortingOptions.goalsRising}</option>
        </select>
      </label>
      <label className='flex align-items-center gap-50 padding-50 font-weight-bold button smooth transparent'>
        <span style={{ lineHeight: '1', }}>{dict.menu.filter}</span>
        <div className='position-relative grid place-items-center'>
          <input type="checkbox" className="position-absolute width-100 height-100 hidden" />
          <Image src="/icons/filter.svg" alt="" width="24" height="24" />
        </div>
      </label>
    </menu>

    <menu id="roadmapFilters" className="margin-block-100 margin-inline-0 padding-100 gray-90 smooth">
      <b>{dict.roadmapFiltersMenu.show}</b>
      {Object.values(RoadmapType).map((thisType, key) => (
        <label className="flex align-items-center gap-25 margin-block-50" key={key}>
          <input type="checkbox" value={thisType} defaultChecked={searchParams.getAll('typeFilter').includes(thisType)} onChange={(e) => {
            if (e.target.checked) {
              updateArrayParam('typeFilter', e.target.value)
              // setTypeFilter([...typeFilter, (e.target.value as RoadmapType)])
            } else {
              updateArrayParam('typeFilter', e.target.value, true)
              // setTypeFilter(typeFilter.filter((item) => item != e.target.value))
            }
          }} />
          {`${thisType == RoadmapType.NATIONAL ? `${dict.roadmapFiltersMenu.filterOptions.roadmapTypes.national}` :
            thisType == RoadmapType.REGIONAL ? `${dict.roadmapFiltersMenu.filterOptions.roadmapTypes.regional}` :
              thisType == RoadmapType.MUNICIPAL ? `${dict.roadmapFiltersMenu.filterOptions.roadmapTypes.municipal}` :
                thisType == RoadmapType.LOCAL ? `${dict.roadmapFiltersMenu.filterOptions.roadmapTypes.local}` :
                  thisType == RoadmapType.OTHER ? `${dict.roadmapFiltersMenu.filterOptions.roadmapTypes.other}` :
                    thisType
            } ${dict.roadmapFiltersMenu.filterOptions.roadmaps}`}
        </label>
      ))}
    </menu>
  </>
}