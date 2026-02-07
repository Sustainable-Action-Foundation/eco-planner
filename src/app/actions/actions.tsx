'use client'

import { useState } from "react"
import styles from "./page.module.css"
import { Action } from "@/types"

export default function Actions({ actions }: { actions: Action[] | null }) {

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  return (
    <>
      <menu className="padding-0 flex gap-100">
        <label>
          <input
            className="margin-right-25"
            type="radio"
            name="view-type"
            checked={viewMode === 'grid'}
            onChange={() => setViewMode('grid')}
          />
          Grid
        </label>

        <label>
          <input
            className="margin-right-25"
            type="radio"
            name="view-type"
            checked={viewMode === 'list'}
            onChange={() => setViewMode('list')}
          />
          List
        </label>
      </menu>

      <div
        className={
          viewMode === 'grid'
            ? styles['actions-grid']
            : styles['actions-list']
        }
      >
        {actions?.map(action => (
          <div key={action.id}>
            {action.name}
            {action.author.username}
            {action.comments.length}
            {new Date(action.createdAt).toDateString()}
            {action.description}
            {action.costEfficiency}
            {action.effects.length}
            {action.startYear} - {action.endYear}
            {action.expectedOutcome}
            {action.isEfficiency} - {action.isSufficiency} - {action.isRenewables}
            {action.projectManager}
            {action.relevantActors}
            {action.roadmap.metaRoadmap.name}
            {new Date(action.updatedAt).toDateString()}
          </div>
        ))}
      </div>
    </>
  )
}
