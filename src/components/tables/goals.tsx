"use client"

import { AccessLevel } from '@/types'
import GoalTable from "./goalTables/goalTable"
import TableSelector from './tableSelector/tableSelector'
import LinkTree from './goalTables/linkTree'
import ActionTable from "./actions"
import { useEffect, useState } from "react"
import { getStoredGoalSortBy, getStoredViewMode, setStoredGoalSortBy } from "./functions/tableFunctions"
import Link from "next/link"
import Image from "next/image"
import styles from './tables.module.css'
import type getOneRoadmap from "@/fetchers/getOneRoadmap.ts"
import { useTranslation } from "react-i18next"
import { IconSearch } from '@tabler/icons-react'

/** Enum for the different view modes for the goal table. */
export enum ViewMode {
  Table = "TABLE",
  Tree = "TREE",
  Actions = "ACTIONS"
};

export enum GoalSortBy {
  Default = "",
  Alpha = "ALPHA",
  AlphaReverse = "ALPHA REVERSE",
  ActionsFalling = "HIGH FIRST",
  ActionsRising = "LOW FIRST",
  Interesting = "INTEREST",
}

export default function Goals({
  roadmap,
  accessLevel,
}: {
  roadmap: NonNullable<Awaited<ReturnType<typeof getOneRoadmap>>>,
  accessLevel?: AccessLevel
}) {
  const { t } = useTranslation("components");

  const [viewMode, setViewMode] = useState<ViewMode | ''>('');
  const [sortBy, setSortBy] = useState<GoalSortBy>(GoalSortBy.Default);
  const [searchFilter, setSearchFilter] = useState<string>('');

  useEffect(() => {
    setViewMode(getStoredViewMode(roadmap.id));
    setSortBy(getStoredGoalSortBy());
  }, [roadmap.id]);

  let filteredRoadmap = roadmap;
  if (searchFilter) {
    filteredRoadmap = {
      ...roadmap,
      goals: roadmap.goals.filter(goal => {
        if (Object.values(goal).some(value => typeof value === 'string' && value.toLowerCase().includes(searchFilter.toLowerCase()))) {
          return true;
        } else if (goal.dataSeries && Object.values(goal.dataSeries).some(value => typeof value === 'string' && value.toLowerCase().includes(searchFilter.toLowerCase()))) {
          return true;
        }
      }),
    }
  }

  return (
    <>
      <menu className={`margin-bottom-100 flex justify-content-space-between align-items-flex-end flex-wrap-wrap gap-100 padding-0 margin-0 ${styles.tableNav}`}>
        <label className="font-weight-bold flex-grow-100">
          {t("components:goals.search")}
          <div className="flex align-items-center margin-top-25 gray-90 padding-50 smooth focusable">
            <IconSearch strokeWidth={1.5} style={{minWidth: '24px'}} aria-hidden="true" />
            <input type="search" className="padding-0 margin-inline-50" onChange={(e) => setSearchFilter(e.target.value)} />
          </div>
        </label>
        {viewMode == ViewMode.Table && (
          <label className="font-weight-bold">
            {t("components:goals.sort_by")}
            <select
              className="font-weight-500 margin-top-25 block"
              style={{ fontSize: '1rem', minHeight: 'calc(24px + 1rem)' }}
              onChange={(e) => { setSortBy(e.target.value as GoalSortBy); setStoredGoalSortBy(e.target.value as GoalSortBy) }} defaultValue={sortBy}
            >
              <option value={GoalSortBy.Default}>{t("components:goals.sort_default")}</option>
              <option value={GoalSortBy.Alpha}>{t("components:goals.sort_name_descending")}</option>
              <option value={GoalSortBy.AlphaReverse}>{t("components:goals.sort_name_ascending")}</option>
              <option value={GoalSortBy.ActionsFalling}>{t("components:goals.sort_action_count_descending")}</option>
              <option value={GoalSortBy.ActionsRising}>{t("components:goals.sort_action_count_ascending")}</option>
              <option value={GoalSortBy.Interesting}>{t("components:goals.sort_interest")}</option>
            </select>
          </label>
        )}
        <TableSelector id={roadmap.id} current={viewMode} setter={setViewMode} />
        { // Only show the button if the user has edit access to the roadmap
          (accessLevel === AccessLevel.Edit || accessLevel === AccessLevel.Author || accessLevel === AccessLevel.Admin) &&
          <Link className="button round color-purewhite pureblack font-weight-500" href={`/goal/create?roadmapId=${roadmap.id}`}>{t("components:goals.new_goal")}</Link>
        }
      </menu>

      {/* TODO: Probably not correct to handle loading as a default state? */}
      {/* TODO: Probably use a skeleton for the loading state */}
      {viewMode == ViewMode.Tree ? (
        <LinkTree roadmap={filteredRoadmap} />
      ) : viewMode == ViewMode.Table ? (
        <GoalTable roadmap={filteredRoadmap} sortBy={sortBy} />
      ) : viewMode == ViewMode.Actions ? (
        <ActionTable actions={filteredRoadmap.actions} accessLevel={accessLevel} roadmapId={roadmap.id} />
      ) :
        <Image
          src='/animations/3-dots-scale.svg'
          width={64}
          height={64}
          alt={t("components:goals.loading_alt")}
          className='block margin-inline-auto'
        />
      }


    </>
  )
}