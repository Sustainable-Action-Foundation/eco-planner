"use client"

import { DataSeries, Goal, Roadmap } from "@prisma/client"
import { AccessLevel } from '@/types'
import GoalTable from "./goalTables/goalTable"
import TableSelector from './tableSelector/tableSelector'
import LinkTree from './goalTables/linkTree'
import { useEffect, useState } from "react"
import { getStoredViewMode } from "./functions/tableFunctions"
import Link from "next/link"
import Image from "next/image"
import styles from './tables.module.css'
import GraphCookie from "../cookies/graphCookie"

/** Enum for the different view modes for the goal table. */
export enum ViewMode {
  Table = "TABLE",
  Tree = "TREE",
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
  title: String,
  roadmap: Roadmap & {
    goals: (Goal & {
      _count: { actions: number }
      dataSeries: DataSeries | null,
      author: { id: string, username: string },
    })[],
    metaRoadmap: { name: string, id: string },
    author: { id: string, username: string },
  },
  accessLevel?: AccessLevel
}) {
  const [viewMode, setViewMode] = useState<ViewMode | "">("")
  const [sortBy, setSortBy] = useState<GoalSortBy>(GoalSortBy.Default)

  useEffect(() => {
    setViewMode(getStoredViewMode(roadmap.id))
  }, [roadmap.id]);

  return (
    <>
      <label htmlFor="goalTable" className={`display-flex justify-content-space-between align-items-center flex-wrap-wrap ${styles.tableNav}`}>
        <h2>{title}</h2>
        {viewMode == ViewMode.Table && (<label className="margin-y-100 font-weight-bold">
          Sortera utifrån:
          <select className="font-weight-bold margin-y-50 block" onChange={(e) => { setSortBy(e.target.value as GoalSortBy) }}>
            <option value={GoalSortBy.Default}>Standard</option>
            <option value={GoalSortBy.Alpha}>Namn (A-Ö)</option>
            <option value={GoalSortBy.AlphaReverse}>Namn (Ö-A)</option>
            <option value={GoalSortBy.ActionsFalling}>Antal målbanor (fallande)</option>
            <option value={GoalSortBy.ActionsRising}>Antal målbanor (stigande)</option>
          </select>
        </label>)}
        <nav className='display-flex align-items-center gap-100'>
          <TableSelector id={roadmap.id} current={viewMode} setter={setViewMode} />
          { // Only show the button if the user has edit access to the roadmap
            (accessLevel === AccessLevel.Edit || accessLevel === AccessLevel.Author || accessLevel === AccessLevel.Admin) &&
            <Link className="button round color-purewhite pureblack" style={{ fontWeight: '500' }} href={`/roadmap/${roadmap.id}/goal/createGoal`}>Skapa ny målbana</Link>
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

      {viewMode == ViewMode.Table && (
        <GoalTable roadmap={roadmap} sortBy={sortBy} />
      )}
      {viewMode == ViewMode.Tree && (
        <LinkTree roadmap={roadmap} />
      )}
      {(viewMode != ViewMode.Table && viewMode != ViewMode.Tree) && (
        <p>
          Laddar vyn... Om vyn inte laddar efter någon sekund, testa att byta vy med knapparna uppe till höger.
        </p>
      )}
    </>
  )
}