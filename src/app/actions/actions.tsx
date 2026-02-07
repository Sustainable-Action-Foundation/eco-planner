'use client'

import { useState } from "react"
import styles from "./page.module.css"
import { Action } from "@/types"
import { IconArrowNarrowRight, IconUser } from "@tabler/icons-react"
import Link from "next/link"

// TODO:
// - Listview should probably be default
// - Does styling for theese cards make sense?
// - Add description?
// - I18n
// - Style using modules
// - Improve listviewstyling

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
          <article
            key={action.id}
            className="smooth padding-50 padding-top-0"
            style={{backgroundColor: 'white', border: '1px solid var(--gray-80)'}}
          >
            <Link href={`/action/${action.id}`} className="discrete-link padding-top-75 block">
              <div style={{color: 'gray', fontSize: '14px'}}>{action.startYear} - {action.endYear}</div>
              <h2 className="margin-0" style={{fontSize: '1.15rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{action.name}</h2>
              <hr className="margin-top-75" style={{borderColor: 'var(--gray-80)', borderTop: '0'}} />
            </Link>
            <div className="flex justify-content-space-between align-items-center">
              <Link href={`/action/${action.id}`} className="flex gap-25 align-items-center discrete-link" style={{fontSize: '14px'}}>
                <IconUser width={20} height={20} style={{maxWidth: '20px'}} />
                {action.author.username}
              </Link>
              <Link href={`/@${action.author.username}`} className="flex gap-25 align-items-center discrete-link" style={{fontSize: '14px'}}>
                Gå till färdplan {/* TODO: I18n, also poor accesibility */}
                <IconArrowNarrowRight width={20} height={20} style={{maxWidth: '20px'}} />
              </Link>
            </div>
            {/* <p>{action.description}</p>  TODO: Should use tiptap */}
            
            {/*
            Antal kommentarer: {action.comments.length}<br/>
            Skapad: {new Date(action.createdAt).toDateString()}<br/>
            Kostnadseffektivitet: {action.costEfficiency}<br/>
            Antal effekter: {action.effects.length}<br/>
            Förväntat utfall: {action.expectedOutcome}<br/>
            Effiency/suffiency/renewables: {action.isEfficiency} - {action.isSufficiency} - {action.isRenewables}<br/>
            Projektledare: {action.projectManager}<br/>
            Relevanta aktörer: {action.relevantActors}<br/>
            Färdplan: {action.roadmap.metaRoadmap.name}<br/>
            Senast uppdaterad: {new Date(action.updatedAt).toDateString()}<br/>  */}
          </article>
        ))}
      </div>
    </>
  )
}
