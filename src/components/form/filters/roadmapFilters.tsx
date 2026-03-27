'use client';

import { RoadmapSortBy } from "@/types";
import { RoadmapType } from "@prisma/client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { useTranslation } from "react-i18next";

export default function RoadmapFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = useTranslation(["components", "common"]);

  const [_isPending, startTransition] = useTransition();

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
    <menu className="margin-0 flex-grow-100 smooth padding-50" style={{ height: 'fit-content', flexBasis: '30ch', border: '1px solid var(--gray-90)', backgroundColor: 'var(--gray-95)' }}> {/* TODO: Place this in a details tag */}
      <label>
        {t("components:roadmap_filters.sort_by")}
        <select
          className="font-weight-500 margin-top-25 block width-100"
          defaultValue={searchParams.get('sortBy') ?? ""} onChange={(e) => { updateStringParam('sortBy', e.target.value) }}
        >
          <option value="">{t("components:roadmap_filters.default")}</option>
          <option value={RoadmapSortBy.Alpha}>{t("components:roadmap_filters.name_descending")}</option>
          <option value={RoadmapSortBy.AlphaReverse}>{t("components:roadmap_filters.name_ascending")}</option>
          <option value={RoadmapSortBy.GoalsFalling}>{t("components:roadmap_filters.goal_count_descending")}</option>
          <option value={RoadmapSortBy.GoalsRising}>{t("components:roadmap_filters.goal_count_ascending")}</option>
        </select>
      </label>
      <fieldset id="roadmapFilters" className="padding-0 fieldset-unset-pseudo-class smooth margin-top-100" style={{ border: '0' }}>
        <legend>{`${t("common:tsx.show")}`}</legend>
        {Object.values(RoadmapType).map((thisType, key) => (
          <label className="flex align-items-center gap-25 margin-block-25" key={key}>
            <input type="checkbox" value={thisType} defaultChecked={searchParams.getAll('typeFilter').includes(thisType)} onChange={(e) => {
              if (e.target.checked) {
                updateArrayParam('typeFilter', e.target.value)
                // setTypeFilter([...typeFilter, (e.target.value as RoadmapType)])
              } else {
                updateArrayParam('typeFilter', e.target.value, true)
                // setTypeFilter(typeFilter.filter((item) => item != e.target.value))
              }
            }} />
            {`${thisType === RoadmapType.NATIONAL ? t("common:scope.national") :
              thisType === RoadmapType.REGIONAL ? t("common:scope.regional") :
                thisType === RoadmapType.MUNICIPAL ? t("common:scope.municipal") :
                  thisType === RoadmapType.LOCAL ? t("common:scope.local") :
                    thisType === RoadmapType.ORGANIZATIONAL ? t("common:scope.organizational_roadmap") :
                      thisType === RoadmapType.OTHER ? t("common:scope.other") :
                        thisType
              }`}
          </label>
        ))}
      </fieldset>
    </menu>
  </>
}