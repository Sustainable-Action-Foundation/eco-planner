"use client"

import { DataSeries, Goal, Roadmap } from "@prisma/client"
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
  roadmap: Roadmap & {
    goals: (Goal & {
      _count: { effects: number }
      dataSeries: DataSeries | null,
      author: { id: string, username: string },
    })[],
    actions: any,
    metaRoadmap: { name: string, id: string },
    author: { id: string, username: string },
  },
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
      <section>
        <section className="margin-block-100 padding-block-50" style={{ borderBottom: '2px solid var(--gray-90)' }}>
          <label className="font-weight-bold margin-block-25 container-text">
            Sök Målbana
            <div className="margin-block-50 flex align-items-center gray-90 padding-50 smooth focusable">
              <Image src='/icons/search.svg' alt="" width={24} height={24} />
              <input type="search" className="padding-0 margin-inline-50" onChange={(e) => setSearchFilter(e.target.value)} />
            </div>
          </label>
          {viewMode == ViewMode.Table && (
            <div className="flex gap-100 align-items-center justify-content-space-between">
              <label className="margin-block-100 font-weight-bold">
                Sortera utifrån:
                <select className="font-weight-bold margin-block-50 block" onChange={(e) => { setSortBy(e.target.value as GoalSortBy); setStoredGoalSortBy(e.target.value as GoalSortBy) }} defaultValue={sortBy}>
                  <option value={GoalSortBy.Default}>Standard</option>
                  <option value={GoalSortBy.Alpha}>Namn (A-Ö)</option>
                  <option value={GoalSortBy.AlphaReverse}>Namn (Ö-A)</option>
                  <option value={GoalSortBy.ActionsFalling}>Antal åtgärder (fallande)</option>
                  <option value={GoalSortBy.ActionsRising}>Antal åtgärder (stigande)</option>
                  <option value={GoalSortBy.Interesting}>Intresse</option>
                </select>
              </label>
            </div>
          )}
        </section>
      </section>
      <label htmlFor="goalTable" className={`display-flex justify-content-space-between align-items-center flex-wrap-wrap ${styles.tableNav}`}>
        <h2>{title}</h2>
        <nav className='display-flex align-items-center gap-100'>
          <TableSelector id={roadmap.id} current={viewMode} setter={setViewMode} />
          { // Only show the button if the user has edit access to the roadmap
            (accessLevel === AccessLevel.Edit || accessLevel === AccessLevel.Author || accessLevel === AccessLevel.Admin) &&
            <Link className="button round color-purewhite pureblack" style={{ fontWeight: '500' }} href={`/goal/createGoal?roadmapId=${roadmap.id}`}>Skapa ny målbana</Link>
          }
          <div className={styles.settings}>
            <input type="checkbox" />
            <Image src="/icons/settings.svg" alt="Inställningar" width="24" height="24" />
          </div>
        </nav>
      </label>

      <div className={styles.settingsContainer}>
        <GraphCookie />
      </div>

      {viewMode == ViewMode.Tree && (
        <LinkTree roadmap={filteredRoadmap} />
      )}
      {viewMode == ViewMode.Table && (
        <GoalTable roadmap={filteredRoadmap} sortBy={sortBy} />
      )}
      {viewMode == ViewMode.Actions && (
        <ActionTable actions={filteredRoadmap.actions} />
      )}
      {(viewMode != ViewMode.Table && viewMode != ViewMode.Tree) && (
        <p>
          Laddar vyn... Om vyn inte laddar efter någon sekund, testa att byta vy med knapparna uppe till höger.
        </p>
      )}
    </>
  )
}