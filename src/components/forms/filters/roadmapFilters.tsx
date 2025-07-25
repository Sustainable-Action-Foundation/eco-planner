'use client';

import { RoadmapSortBy } from "@/types";
import { RoadmapType } from "@prisma/client";
import { IconAdjustmentsHorizontal, IconSearch } from "@tabler/icons-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { useTranslation } from "react-i18next";
import { useDebouncedCallback } from "use-debounce";

export default function RoadmapFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = useTranslation(["components", "common"]);

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
    <menu className="flex gap-100 align-items-flex-end padding-0 margin-0 margin-top-300 margin-bottom-100 flex-wrap-wrap">
      <label className="font-weight-600">
        {t("components:roadmap_filters.search_roadmaps")}
        <div className="margin-top-25 flex align-items-center padding-50 smooth focusable">
          <IconSearch style={{minWidth: '24px'}} strokeWidth={1.5} aria-hidden="true" />
          <input type="search" className="padding-0 margin-inline-50" defaultValue={searchParams.get('searchFilter') ?? undefined} onChange={(e) => {
            debouncedUpdateStringParam('searchFilter', e.target.value)
          }} />
        </div>
      </label>
      <label className="font-weight-600">
        {t("components:roadmap_filters.sort_by")}
        <select
          className="font-weight-500 margin-top-25 block"
          style={{ fontSize: '1rem', minHeight: 'calc(24px + 1rem)' }}
          defaultValue={searchParams.get('sortBy') ?? ""} onChange={(e) => { updateStringParam('sortBy', e.target.value) }}
        >
          <option value="">{t("components:roadmap_filters.default")}</option>
          <option value={RoadmapSortBy.Alpha}>{t("components:roadmap_filters.name_descending")}</option>
          <option value={RoadmapSortBy.AlphaReverse}>{t("components:roadmap_filters.name_ascending")}</option>
          <option value={RoadmapSortBy.GoalsFalling}>{t("components:roadmap_filters.goal_count_descending")}</option>
          <option value={RoadmapSortBy.GoalsRising}>{t("components:roadmap_filters.goal_count_ascending")}</option>
        </select>
      </label>
    </menu>

    <fieldset id="roadmapFilters" className="margin-block-100 margin-inline-0 padding-100 fieldset-unset-pseudo-class purewhite smooth"  style={{border: '1px solid var(--gray)'}}>
      <legend className="font-weight-600">{t("common:tsx.show")}</legend>
      {Object.values(RoadmapType).map((thisType, key) => (
        <label className="inline-flex margin-inline-50 align-items-center gap-25" key={key}>
          <input type="checkbox" value={thisType} defaultChecked={searchParams.getAll('typeFilter').includes(thisType)} onChange={(e) => {
            if (e.target.checked) {
              updateArrayParam('typeFilter', e.target.value)
              // setTypeFilter([...typeFilter, (e.target.value as RoadmapType)])
            } else {
              updateArrayParam('typeFilter', e.target.value, true)
              // setTypeFilter(typeFilter.filter((item) => item != e.target.value))
            }
          }} />
          {`${thisType == RoadmapType.NATIONAL ? t("common:scope.national_roadmap") :
            thisType == RoadmapType.REGIONAL ? t("common:scope.regional_roadmap") :
              thisType == RoadmapType.MUNICIPAL ? t("common:scope.municipal_roadmap") :
                thisType == RoadmapType.LOCAL ? t("common:scope.local_roadmap") :
                  thisType == RoadmapType.OTHER ? t("common:scope.other_roadmap") :
                    thisType
            }`}
        </label>
      ))}
    </fieldset>
  </>
}