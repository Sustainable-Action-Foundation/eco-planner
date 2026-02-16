"use client";

import { useEffect, useState, useTransition } from "react"
import styles from "../app/actions/page.module.css"
import { Action } from "@/types"
import { IconArrowNarrowRight, IconLayoutGridFilled, IconList, IconPlus, IconSearch, IconUser } from "@tabler/icons-react"
import Link from "next/link"
import { useDebouncedCallback } from "use-debounce"
import { usePathname, useSearchParams, useRouter } from "next/navigation"

// TODO:
// - Listview should probably be default
// - Does styling for theese cards make sense?
// - Add description?
// - I18n
// - Style using modules
// - Improve listviewstyling
// - Search by other fields than name (e.g author, years...)
// - Probably memoise instead of mutating actions prop
// - Rename searchFilter -> search/filter (no url camelcase preferably)
export default function Actions({ actions, searchParamsProp }: { actions: Action[] | null, searchParamsProp: { [key: string]: string | string[] | undefined } }) {
  const router = useRouter();
  const debouncedUpdateStringParam = useDebouncedCallback(updateStringParam, 300);
  const [_isPending, startTransition] = useTransition();
  const pathname = usePathname();
  const searchParams = useSearchParams();

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

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const searchFilter = searchParamsProp['searchFilter'] ? (Array.isArray(searchParamsProp['searchFilter']) ? searchParamsProp['searchFilter'][0] : searchParamsProp['searchFilter']) : '';

  if (searchFilter && actions) {
    actions = actions.filter((action) => {
      if (Object.values(action).some((value) => {
        if (typeof value === 'string') {
          return value.toLowerCase().includes(searchFilter.toLowerCase())
        } else {
          return false;
        }
      })) {
        return true;
      }
    });
  }

  useEffect(() => {
    console.log(actions)
  }, [actions])

  return (
    <div className="grid gap-200" style={{ gridTemplateColumns: 'auto 1fr' }}>
      <menu className="margin-0 smooth padding-50" style={{width: '30ch', backgroundColor: 'var(--gray-95)', border: '1px solid var(--gray-90)', marginTop: '100px', height: 'fit-content'}}> {/* TODO: Magic number */}
        <div className="width-100">{/* TODO: Need some label */}
          <div className="radio-select-multiple margin-top-25 width-100" style={{gridTemplateColumns: 'repeat(auto-fit, minmax(50px, 1fr))'}}>
            <label className="flex gap-25 align-items-center" style={{ lineHeight: '1' }}>
              <IconLayoutGridFilled width={20} height={20} style={{ minWidth: '20px' }} />
              Rutnät
              <input
                type="radio"
                name="view-type"
                checked={viewMode === 'grid'}
                onChange={() => setViewMode('grid')}
              />
            </label>

            <label className="flex gap-25 align-items-center" style={{ lineHeight: '1' }}>
              <IconList width={20} height={20} style={{ minWidth: '20px' }} />
              Lista
              <input
                type="radio"
                name="view-type"
                checked={viewMode === 'list'}
                onChange={() => setViewMode('list')}
              />
            </label>
          </div>
        </div>
        <h1 className="padding-bottom-50 margin-block-100 font-weight-500" style={{fontSize: '1.25rem', borderBottom: '1px solid var(--gray)'}}>Filter</h1> {/* TODO: Check semantics of this */}
      </menu>

      <div>
        <h1 id="search-title" className="margin-top-300 margin-bottom-50">Sök bland {actions?.length} åtgärder</h1>
        <div className="margin-bottom-100 padding-bottom-100 flex gap-100 align-items-stretch" style={{ borderBottom: '1px solid var(--gray-80)' }}>
          <div className="flex align-items-center padding-50 smooth focusable flex-grow-100">
            <IconSearch strokeWidth={1.5} width={20} height={20} style={{ minWidth: '20px' }} />
            <input aria-labelledby="search-title" type="search" className="padding-0 margin-inline-50" defaultValue={searchParams.get('searchFilter') ?? undefined} onChange={(e) => {
              debouncedUpdateStringParam('searchFilter', e.target.value)
            }} />
          </div>
          <hr style={{ borderRight: '0', color: 'var(--gray-80)', borderStyle: 'solid' }} />
          <Link href={'/action/create'} className="flex gap-100 align-items-center smooth seagreen color-purewhite text-decoration-none padding-inline-75 padding-block-50 font-weight-500 button" style={{ lineHeight: '1', fontSize: '14px' }}>
            Skapa ny åtgärd
            <IconPlus width={20} height={20} style={{ minWidth: '20px' }} />
          </Link>
        </div>
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
      </div>
    </div>
  )
}
