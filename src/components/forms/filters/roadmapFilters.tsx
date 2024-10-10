'use client';

import { RoadmapSortBy } from "@/types";
import { RoadmapType } from "@prisma/client";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { useDebouncedCallback } from "use-debounce";

export default function RoadmapFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [isPending, startTransition] = useTransition();

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
      newParams.delete(key);
    } else {
      newParams.append(key, value);
    }

    startTransition(() => {
      router.replace(`${pathname}?${newParams.toString()}`)
    })
  }

  return <>
    <section>
      <section className="margin-block-100 padding-block-50" style={{ borderBottom: '2px solid var(--gray-90)' }}>
        <label className="font-weight-bold margin-block-25 container-text">
          Sök färdplan
          <div className="margin-block-50 flex align-items-center gray-90 padding-50 smooth focusable">
            <Image src='/icons/search.svg' alt="" width={24} height={24} />
            <input type="search" className="padding-0 margin-inline-50" defaultValue={searchParams.get('searchFilter') ?? undefined} onChange={(e) => {
              debouncedUpdateStringParam('searchFilter', e.target.value)
            }} />
          </div>
        </label>
        <div className="flex gap-100 align-items-center justify-content-space-between">
          <label className="margin-block-100 font-weight-bold">
            Sortera på:
            <select className="font-weight-bold margin-block-50 block" defaultValue={searchParams.get('sortBy') ?? undefined} onChange={(e) => { updateStringParam('sortBy', e.target.value) }}>
              <option value="">Standard</option>
              <option value={RoadmapSortBy.Alpha}>Namn (A-Ö)</option>
              <option value={RoadmapSortBy.AlphaReverse}>Namn (Ö-A)</option>
              <option value={RoadmapSortBy.GoalsFalling}>Antal målbanor (fallande)</option>
              <option value={RoadmapSortBy.GoalsRising}>Antal målbanor (stigande)</option>
            </select>
          </label>
          <label className='flex align-items-center gap-50 padding-50 font-weight-bold button smooth transparent'>
            <span style={{ lineHeight: '1', }}>Filtrera</span>
            <div className='position-relative grid place-items-center'>
              <input type="checkbox" className="position-absolute width-100 height-100 hidden" />
              <Image src="/icons/filter.svg" alt="" width="24" height="24" />
            </div>
          </label>
        </div>
      </section>
      <section id="roadmapFilters" className="margin-block-200 padding-100 gray-90 rounded">
        <b>Visa</b>
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
            {`${thisType == RoadmapType.NATIONAL ? "Nationella" :
              thisType == RoadmapType.REGIONAL ? "Regionala" :
                thisType == RoadmapType.MUNICIPAL ? "Kommunala" :
                  thisType == RoadmapType.LOCAL ? "Lokala" :
                    thisType == RoadmapType.OTHER ? "Övriga" :
                      thisType
              } färdplaner`}
          </label>
        ))}
      </section>
    </section>
  </>
}