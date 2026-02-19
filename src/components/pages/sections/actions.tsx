"use client";

import { useMemo, useState, useTransition } from "react"
import styles from "./sections.module.css"
import { Action } from "@/types"
import { IconArrowNarrowRight, IconLayoutGridFilled, IconList, IconPlus, IconSearch, IconUser } from "@tabler/icons-react"
import Link from "next/link"
import Image from "next/image";
import { useDebouncedCallback } from "use-debounce"
import { usePathname, useSearchParams, useRouter } from "next/navigation"
import { useTranslation } from "react-i18next";

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
      [action.name, action.description].some(
        (value) =>
          typeof value === "string" &&
          value.toLowerCase().includes(searchFilter.toLowerCase())
      )
    );
  }, [actions, searchFilter]);

  return (
    <search className="flex flex-wrap-wrap gap-200">
      <menu className={`margin-0 smooth padding-50 flex-grow-100 ${styles['actions-menu']}`} >
        <fieldset className="width-100 fieldset-unset-pseudo-class">
          <legend>{t("pages:actions.show_as")}</legend>

          <div className="radio-select-multiple margin-top-25 width-100" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(50px, 1fr))' }}>
            <label className="flex gap-25 align-items-center line-height-100">
              <IconLayoutGridFilled width={20} height={20} style={{ minWidth: '20px' }} aria-hidden="true" />
              {t('pages:actions.grid')}
              <input
                type="radio"
                name="view-type"
                checked={viewMode === 'grid'}
                onChange={() => setViewMode('grid')}
              />
            </label>
            <label className="flex gap-25 align-items-center line-height-100">
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

      <div className="flex-grow-infinity max-width-100">
        <h2 id="search-title" className="margin-top-0 margin-bottom-50">
          {t("pages:actions.search_actions", { count: actions?.length })}
        </h2>

        <div className="flex flex-wrap-wrap gap-50 align-items-center">
          <div className="flex align-items-center padding-50 smooth focusable flex-grow-infinity">
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

          <hr style={{ alignSelf: 'stretch', borderStyle: 'solid', color: 'var(--gray-80)', borderRight: '0' }} />
          
          <Link 
            href={'/action/create'} 
            className="flex gap-100 flex-grow-100 justify-content-space-between align-items-center smooth seagreen color-purewhite text-decoration-none padding-50 font-weight-500 button white-space-nowrap line-height-100 font-size-14px"
          >
            {t("pages:actions.create_new_action")}
            <IconPlus width={20} height={20} style={{ minWidth: '20px' }} aria-hidden="true" />
          </Link>
        </div>

        <section>
          {actions && actions?.length > 0 ?
            <h3 className="margin-bottom-50 margin-top-200 font-style-italic color-gray font-weight-normal font-size-100">
              {t("pages:actions.shown_results", { count: filteredActions?.length })}
            </h3>
          : null }
          <ul
            className={`
            margin-0
            padding-0
            ${viewMode === 'grid'
                ? styles['actions-grid']
                : styles['actions-list']
              }`}
          >
            {/* 
              TODO: This is semantically incorrect. However as we need to update our html once we fix the treestructure of actions,
              we can accept this untill then. In the future we likely want to separate the HTML for our grid and list views. 
            */}
            {viewMode === 'list' ?
              <li
                style={{ listStyle: 'none', borderBottom: '1px solid var(--gray-20)', borderRadius: '0' }}
                className="smooth padding-bottom-50 margin-bottom-50 margin-top-100"
              >
                <article className="flex align-items-center justify-content-space-between height-100">
                  <h2 className="margin-0 font-weight-500 font-size-100" style={{ color: 'var(--gray-20)' }}>
                    {t("pages:actions.title")}
                  </h2>
                  <span className=" font-weight-500" style={{ color: 'var(--gray-20)' }}>
                    {t("pages:actions.author")}
                  </span>
                </article>
              </li>
              : null}
            {filteredActions?.map(action => (
              <li
                key={action.id}
                className="smooth"
              >
                <article className="flex flex-direction-column height-100">
                  <Link href={`/action/${action.id}`} className="discrete-link padding-block-75 padding-inline-50 block flex-grow-100">
                    <div className={` color-gray font-size-14px ${styles['action-years']}`}>{action.startYear} - {action.endYear}</div>
                    <h2 className={`margin-0 ${styles['action-title']}`}>{action.name}</h2>
                    <p 
                      className={`margin-0 white-space-nowrap text-overflow-ellipsis overflow-hidden ${styles['action-description']}`} 
                      style={{ color: '#292929' }}
                    >
                      {action.description}
                    </p>
                  </Link>
                  
                  <hr className="margin-50 margin-top-0" style={{ color: 'var(--gray-80)', borderBottom: '0', borderStyle: 'solid' }} />

                  <div className="flex justify-content-space-between align-items-center padding-inline-50 padding-bottom-50">
                    <Link href={`/action/${action.id}`} className={`flex gap-25 align-items-center discrete-link font-size-14px ${styles['action-user']}`}>
                      <IconUser width={20} height={20} style={{ maxWidth: '20px' }} aria-label={`${t('pages:actions.author')}:`} />
                      {action.author.username}
                    </Link>
                    <Link href={`/action/${action.id}`} className={`flex gap-25 align-items-center discrete-link font-size-14px ${styles['action-link']}`}>
                      {t('pages:actions.visit_action')}
                      <IconArrowNarrowRight width={20} height={20} style={{ maxWidth: '20px' }} aria-hidden="true" />
                    </Link>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </search>
  )
}
