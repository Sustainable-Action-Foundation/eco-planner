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
import GraphCookie from "../cookies/graphCookie"
import type getOneRoadmap from "@/fetchers/getOneRoadmap.ts"

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
  title,
  roadmap,
  accessLevel,
}: {
  title: string,
  roadmap: NonNullable<Awaited<ReturnType<typeof getOneRoadmap>>>,
  accessLevel?: AccessLevel
}) {
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
      <h2>{title}</h2>
      <menu 
        className={`margin-block-100 padding-top-100 flex justify-content-space-between align-items-flex-end flex-wrap-wrap gap-100 padding-0 margin-0 ${styles.tableNav}`}
        style={{borderTop: '1px solid var(--gray)'}}
      >
        <label className="font-weight-bold flex-grow-100">
          Sök Målbana
          <div className="flex align-items-center margin-top-25 gray-90 padding-50 smooth focusable">
            <Image src='/icons/search.svg' alt="" width={24} height={24} />
            <input type="search" className="padding-0 margin-inline-50" onChange={(e) => setSearchFilter(e.target.value)} />
          </div>
        </label>
        {viewMode == ViewMode.Table && (
          <label className="font-weight-bold">
            Sortera utifrån
            <select 
              className="font-weight-500 margin-top-25 block" 
              style={{fontSize: '1rem', minHeight: 'calc(24px + 1rem)'}}
              onChange={(e) => { setSortBy(e.target.value as GoalSortBy); setStoredGoalSortBy(e.target.value as GoalSortBy) }} defaultValue={sortBy}
            >
              <option value={GoalSortBy.Default}>Standard</option>
              <option value={GoalSortBy.Alpha}>Namn (A-Ö)</option>
              <option value={GoalSortBy.AlphaReverse}>Namn (Ö-A)</option>
              <option value={GoalSortBy.ActionsFalling}>Antal åtgärder (fallande)</option>
              <option value={GoalSortBy.ActionsRising}>Antal åtgärder (stigande)</option>
              <option value={GoalSortBy.Interesting}>Intresse</option>
            </select>
          </label>
        )}
        <TableSelector id={roadmap.id} current={viewMode} setter={setViewMode} />
        { // Only show the button if the user has edit access to the roadmap
          (accessLevel === AccessLevel.Edit || accessLevel === AccessLevel.Author || accessLevel === AccessLevel.Admin) &&
          <Link className="button round color-purewhite pureblack font-weight-500" href={`/goal/create?roadmapId=${roadmap.id}`}>Skapa ny målbana</Link>
        }
        <div className={styles.settings}>
          <input type="checkbox" />
          <Image src="/icons/settings.svg" alt="Inställningar" width="24" height="24" />
        </div>
      </menu>

      <div className={styles.settingsContainer}>
        <GraphCookie />
      </div>

      {/* TODO: Probably not correct to handle loading as a default state? */}
      {/* TODO: Probably use a skeleton for the loading state */}
      {viewMode == ViewMode.Tree ? (
        <LinkTree roadmap={filteredRoadmap} />
      ) : viewMode == ViewMode.Table ? (
        <GoalTable roadmap={filteredRoadmap} sortBy={sortBy} />
      ) : viewMode == ViewMode.Actions ? (
        <ActionTable actions={filteredRoadmap.actions} accessLevel={accessLevel} roadmapId={roadmap.id} />
      ): 
        <Image 
          src='/animations/3-dots-scale.svg' 
          width={64} 
          height={64} 
          alt='Laddar ' 
          className='block margin-inline-auto' 
        />
      }


    </>
  )
}