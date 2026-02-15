'use client'

import { useState } from "react"
import styles from "./page.module.css"
import { Action } from "@/types"
import { IconArrowNarrowRight, IconGrid3x3, IconLayoutGridFilled, IconList, IconPlus, IconSearch, IconTable, IconTableFilled, IconUser } from "@tabler/icons-react"
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
      <menu className="padding-0 flex align-items-flex-end gap-100 flex-wrap-wrap padding-bottom-100 margin-bottom-100">
        <label className="flex-grow-100">
          Sök
          <div className="flex align-items-center margin-top-25 padding-50 smooth focusable">
            <IconSearch width={1.5} style={{minWidth: '24px'}} />
            <input type="search" className="padding-0 margin-inline-50" />
          </div>
        </label>
        <div className="flex-grow-100">
          Visa som
          <div className="radio-select-multiple margin-top-25" style={{ width: 'min(300px, 100%)', minWidth: 'calc(125px * 2)' }}> {/* TODO: Some magic number stuff going on here */}
            <label className="flex gap-25 align-items-center" style={{ lineHeight: '1' }}>
              <IconLayoutGridFilled style={{minWidth: '24px'}} />
              Rutnät
              <input
                type="radio"
                name="view-type"
                checked={viewMode === 'grid'}
                onChange={() => setViewMode('grid')}
              />
            </label>

            <label className="flex gap-25 align-items-center" style={{ lineHeight: '1' }}>
              <IconList style={{minWidth: '24px'}} />
              Förenklad lista
              <input
                type="radio"
                name="view-type"
                checked={viewMode === 'list'}
                onChange={() => setViewMode('list')}
              />
            </label>
          </div>
        </div>
        <Link href={'/action/create'} className="flex gap-50 align-items-center smooth neutral-action" style={{fontSize: '14px', marginTop: 'calc(21px + .25rem + 5px)', alignSelf: 'flex-start'}}> {/* TODO: Some more magic number stuff going on here */}
          Skapa ny åtgärd
          <IconPlus width={20} height={20} style={{minWidth: '20px'}} strokeWidth={1.5} />
        </Link>
      </menu>

      <ul
        className={`
        margin-top-0  
        ${viewMode === 'grid'
            ? styles['actions-grid']
            : styles['actions-list']
          }`}
      >
        {actions?.map(action => (
          <li
            key={action.id}
            className="smooth padding-0 padding-top-0"
          >
            <article>
              <Link href={`/action/${action.id}`} className="discrete-link padding-top-75 padding-inline-50 block">
                <div style={{ color: 'gray', fontSize: '14px' }}>{action.startYear} - {action.endYear}</div>
                <h2 className="margin-0" style={{ fontSize: '1.15rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{action.name}</h2>
                <hr className="margin-top-75" style={{ borderColor: 'var(--gray-80)', borderTop: '0' }} />
              </Link>
              <div className="flex justify-content-space-between align-items-center padding-inline-50 padding-bottom-50">
                <Link href={`/action/${action.id}`} className="flex gap-25 align-items-center discrete-link" style={{ fontSize: '14px' }}>
                  <IconUser width={20} height={20} style={{ maxWidth: '20px' }} />
                  {action.author.username}
                </Link>
                <Link href={`/@${action.author.username}`} className="flex gap-25 align-items-center discrete-link" style={{ fontSize: '14px' }}>
                  Gå till färdplan {/* TODO: I18n, also poor accesibility */}
                  <IconArrowNarrowRight width={20} height={20} style={{ maxWidth: '20px' }} />
                </Link>
              </div> 
            </article>
          </li>
        ))}
      </ul>
    </>
  )
}
