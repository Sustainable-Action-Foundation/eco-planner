'use client';

import { RoadmapType } from "@prisma/client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Fragment, useTransition } from "react";
import { useTranslation } from "react-i18next";

export default function RoadmapFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = useTranslation(["components", "common"]);

  const [_isPending, startTransition] = useTransition();

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
    <menu className="margin-0 padding-0">
      <fieldset id="roadmapFilters" className="padding-0 fieldset-unset-pseudo-class smooth margin-top-100 flex flex-wrap-wrap" style={{ border: '0' }}>
        <legend className="font-weight-600 margin-bottom-25">{`${t("components:roadmap_filters.roadmap_type")}`}</legend>
        {Object.values(RoadmapType).map((thisType, key) => (
          <Fragment key={key}>
            <label className="flex-grow-100 padding-25"> {/* TODO: dislike padding here, also hover effects need to show even if element is selected, also this is buggy for whatever reason */}
              <div className="chip width-100">
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
                        thisType === RoadmapType.ORGANIZATIONAL ? t("common:scope.organizational") :
                          thisType === RoadmapType.OTHER ? t("common:scope.other") :
                            thisType
                  }`}
              </div>
            </label>
          </Fragment>
        ))}
      </fieldset>
    </menu >
  </>
}
