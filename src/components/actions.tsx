"use client";

import { useEffect, useMemo, useState, useTransition } from "react"
import styles from "../app/actions/page.module.css"
import { Action } from "@/types"
import { IconArrowNarrowRight, IconLayoutGridFilled, IconList, IconPlus, IconSearch, IconUser } from "@tabler/icons-react"
import Link from "next/link"
import Image from "next/image";
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
export default function Actions({ actions, searchParamsProp }: { actions: Action[] | null, searchParamsProp: { [key: string]: string | string[] | undefined } }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const debouncedUpdateStringParam = useDebouncedCallback(
    (key: string, value: string) => {
      updateStringParam(key, value);
      setIsLoading(false); // debounce finished
    },
    300
  );
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
  const searchFilter = searchParamsProp['search'] ? (Array.isArray(searchParamsProp['search']) ? searchParamsProp['search'][0] : searchParamsProp['search']) : '';

  const filteredActions = useMemo(() => {
    if (!searchFilter || !actions) return actions;

    return actions.filter((action) =>
      Object.values(action).some(
        (value) =>
          typeof value === "string" &&
          value.toLowerCase().includes(searchFilter.toLowerCase())
      )
    );
  }, [actions, searchFilter]);

  return (
    <div className="grid gap-200" style={{ gridTemplateColumns: 'auto 1fr' }}>
      <menu className="margin-0 smooth padding-50" style={{ width: '30ch', backgroundColor: 'var(--gray-95)', border: '1px solid var(--gray-90)', marginTop: '40px', height: 'fit-content' }}> {/* TODO: Magic number */}
        <div className="width-100">{/* TODO: Need some label */}
          <div className="radio-select-multiple margin-top-25 width-100" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(50px, 1fr))' }}>
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
        <h2 className="padding-bottom-50 margin-block-100 font-weight-500" style={{ fontSize: '1.25rem', borderBottom: '1px solid var(--gray)' }}>Filter</h2> {/* TODO: Check semantics of this */}
      </menu>

      <div>
        <h2 id="search-title" className="margin-top-0 margin-bottom-50">Sök bland {actions?.length} åtgärder</h2>
        <div className="margin-bottom-100 padding-bottom-100 flex gap-100 align-items-stretch" style={{ borderBottom: '1px solid var(--gray-80)' }}>
          <div className="flex align-items-center padding-50 smooth focusable flex-grow-100">
            <IconSearch strokeWidth={1.5} width={20} height={20} style={{ minWidth: '20px' }} />
            <input
              aria-labelledby="search-title"
              type="text" // No need to use search according to MDN
              className="padding-0 margin-inline-50"
              defaultValue={searchParams.get('search') ?? undefined}
              onChange={(e) => {
                setIsLoading(true); 
                debouncedUpdateStringParam('search', e.target.value);
              }}
            />
            {isLoading && <Image src={'/loaders/3-dots-move.svg'} width={16} height={16} alt='' aria-live="polite" />}
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
          {filteredActions?.map(action => (
            <li
              key={action.id}
              className="smooth padding-0 padding-top-0"
            >
              <article>
                <Link href={`/action/${action.id}`} className="discrete-link padding-top-75 padding-inline-50 block">
                  <div className={`${styles['action-years']}`}>{action.startYear} - {action.endYear}</div>
                  <h2 className={`margin-0 ${styles['action-title']}`}>{action.name}</h2>
                  <hr className="margin-top-75" style={{ borderColor: 'var(--gray-80)', borderTop: '0' }} />
                </Link>
                <div className="flex justify-content-space-between align-items-center padding-inline-50 padding-bottom-50">
                  <Link href={`/action/${action.id}`} className={`flex gap-25 align-items-center discrete-link ${styles['action-user']}`} style={{ fontSize: '14px' }}>
                    <IconUser width={20} height={20} style={{ maxWidth: '20px' }} />
                    {action.author.username}
                  </Link>
                  <Link href={`/action/${action.id}`} className={`flex gap-25 align-items-center discrete-link ${styles['action-link']}`} style={{ fontSize: '14px' }}>
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
