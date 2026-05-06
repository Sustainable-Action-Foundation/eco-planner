"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React, { startTransition } from "react";
import { RoadmapSortBy } from "@/types";
import { useTranslation } from "react-i18next";

export default function SortRoadmaps() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = useTranslation(["components"]);

  function updateStringParam(key: string, value: string) {
    const newParams = new URLSearchParams(searchParams);

    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }

    startTransition(() => {
      router.replace(`${pathname}?${newParams.toString()}`);
    });
  }


  return (
    <label className="flex gap-50 align-items-center white-space-nowrap font-size-14px">
      {t("components:roadmap_filters.sort_by")}: {/* TODO: Remove */}
      <select
        className="font-size-14px secondary-neutral-action"
        defaultValue={searchParams.get('sortBy') ?? ""} onChange={(e) => { updateStringParam('sortBy', e.target.value); }}
        style={{paddingRight: 'calc(1rem + 20px)', '--padding': '.5rem'} as React.CSSProperties}
      >
        <option value="">{t("components:roadmap_filters.default")}</option>
        <option value={RoadmapSortBy.Alpha}>{t("components:roadmap_filters.name_descending")}</option>
        <option value={RoadmapSortBy.AlphaReverse}>{t("components:roadmap_filters.name_ascending")}</option>
        <option value={RoadmapSortBy.GoalsFalling}>{t("components:roadmap_filters.goal_count_descending")}</option>
        <option value={RoadmapSortBy.GoalsRising}>{t("components:roadmap_filters.goal_count_ascending")}</option>
      </select>
    </label>
  );
}