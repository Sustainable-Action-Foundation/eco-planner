"use client";

import { useMemo, useState, useTransition } from "react"
import styles from "../app/actions/page.module.css"
import { Action } from "@/types"
import { IconArrowNarrowRight, IconLayoutGridFilled, IconList, IconPlus, IconSearch, IconUser } from "@tabler/icons-react"
import Link from "next/link"
import Image from "next/image";
import { useDebouncedCallback } from "use-debounce"
import { usePathname, useSearchParams, useRouter } from "next/navigation"
import { useTranslation } from "react-i18next";

// TODO:
// - Style using modules
// - Improve listviewstyling
// - Update folder structure
export default function Actions({
  actions,
  searchParamsProp
}: {
  actions: Action[] | null,
  searchParamsProp: { [key: string]: string | string[] | undefined }
}) {

  const { t } = useTranslation("pages");

  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [_isPending, startTransition] = useTransition();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const searchFilter = searchParamsProp['search'] ? (Array.isArray(searchParamsProp['search']) ? searchParamsProp['search'][0] : searchParamsProp['search']) : '';

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

  const slowDebounce = useDebouncedCallback(update, 300);
  const mediumDebounce = useDebouncedCallback(update, 150);
  const fastDebounce = useDebouncedCallback(update, 50);

  function update(key: string, value: string) {
    updateStringParam(key, value);
    setIsLoading(false);
  }

  const debouncedUpdateStringParam = (key: string, value: string) => {
    if (value.length < 3) fastDebounce(key, value);
    else if (value.length < 6) mediumDebounce(key, value);
    else slowDebounce(key, value);
  };

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
    <div className="flex flex-wrap-wrap gap-200">
      <menu className="margin-0 smooth padding-50 flex-grow-100" style={{ flexBasis: '30ch', backgroundColor: 'var(--gray-95)', border: '1px solid var(--gray-90)', height: 'fit-content' }}>
        <fieldset className="width-100 fieldset-unset-pseudo-class"> 
          <legend>{t("pages:actions.show_as")}</legend>
          <div className="radio-select-multiple margin-top-25 width-100" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(50px, 1fr))' }}>
            <label className="flex gap-25 align-items-center" style={{ lineHeight: '1' }}>
              <IconLayoutGridFilled width={20} height={20} style={{ minWidth: '20px' }} aria-hidden="true" />
              {t('pages:actions.grid')}
              <input
                type="radio"
                name="view-type"
                checked={viewMode === 'grid'}
                onChange={() => setViewMode('grid')}
              />
            </label>

            <label className="flex gap-25 align-items-center" style={{ lineHeight: '1' }}>
              <IconList width={20} height={20} style={{ minWidth: '20px' }} aria-hidden="true" />
              {t('pages:actions.list')}
              <input
                type="radio"
                name="view-type"
                checked={viewMode === 'list'}
                onChange={() => setViewMode('list')}
              />
            </label>
          </div>
        </fieldset>
        {/*<h2 className="padding-bottom-50 margin-block-100 font-weight-500" style={{ fontSize: '1.25rem', borderBottom: '1px solid var(--gray)' }}>{t('pages:actions.filter')}</h2>  */}
      </menu>

      <div style={{ maxWidth: '100%', flexGrow: 'calc(infinity * 1)' }}>
        <h2 id="search-title" className="margin-top-0 margin-bottom-50">{t("pages:actions.search_actions", { count: actions?.length })}</h2>
        <div className="flex flex-wrap-wrap-reverse gap-50 align-items-center">
          <div className="flex align-items-center padding-50 smooth focusable" style={{ flexGrow: 'calc(infinity * 1)' }}>
            <IconSearch strokeWidth={1.5} width={20} height={20} style={{ minWidth: '20px' }} aria-hidden="true" />
            <input
              aria-labelledby="search-title"
              type="text" // NOTE: No need to use search according to MDN
              className="padding-0 margin-inline-50"
              defaultValue={searchParams.get('search') ?? undefined}
              onChange={(e) => {
                setIsLoading(true);
                debouncedUpdateStringParam('search', e.target.value);
              }}
            />
            {isLoading && <Image src={'/loaders/3-dots-move.svg'} width={16} height={16} alt='' aria-live="polite" />}
          </div>
          <hr style={{ alignSelf: 'stretch', borderStyle: 'solid', color: 'var(--gray-80)', borderRight: '0', flexShrink: '1' }} />
          <Link href={'/action/create'} className="flex gap-100 flex-grow-100 justify-content-space-between align-items-center smooth seagreen color-purewhite text-decoration-none padding-50 font-weight-500 button" style={{ lineHeight: '1', fontSize: '14px', whiteSpace: "nowrap" }}>
            {t("pages:actions.create_new_action")}
            <IconPlus width={20} height={20} style={{ minWidth: '20px' }} aria-hidden="true" />
          </Link>
        </div>
        <p className="margin-top-25 margin-bottom-200" style={{ fontStyle: 'italic', color: 'gray' }}>{t("pages:actions.shown_results", { count: filteredActions?.length })}</p> {/* TODO: This looks bad when wrapping but whatever */}
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
              <article className="flex flex-direction-column" style={{ height: '100%' }}>
                <Link href={`/action/${action.id}`} className="discrete-link padding-block-75 padding-inline-50 block flex-grow-100">
                  <div className={`${styles['action-years']}`}>{action.startYear} - {action.endYear}</div>
                  <h2 className={`margin-0 ${styles['action-title']}`}>{action.name}</h2>
                  <p className="margin-0" style={{ whiteSpace: "nowrap", textOverflow: 'ellipsis', overflow: 'hidden', color: '#292929' }}>{action.description}</p>
                </Link>
                <hr className="margin-top-75" style={{ color: 'var(--gray-80)', borderBottom: '0', borderStyle: 'solid', margin: '.5rem', marginTop: '0' }} />
                <div className="flex justify-content-space-between align-items-center padding-inline-50 padding-bottom-50">
                  <Link href={`/action/${action.id}`} className={`flex gap-25 align-items-center discrete-link ${styles['action-user']}`} style={{ fontSize: '14px' }}>
                    <IconUser width={20} height={20} style={{ maxWidth: '20px' }} aria-label={`${t('pages:actions.author')}:`} />
                    {action.author.username}
                  </Link>
                  <Link href={`/action/${action.id}`} className={`flex gap-25 align-items-center discrete-link ${styles['action-link']}`} style={{ fontSize: '14px' }}>
                    {t('pages:actions.visit_action')}
                    <IconArrowNarrowRight width={20} height={20} style={{ maxWidth: '20px' }} aria-hidden="true" />
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
