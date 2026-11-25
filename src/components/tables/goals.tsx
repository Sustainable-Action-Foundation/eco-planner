"use client";

import { AccessLevel, GoalSortBy, LikeFilter, ViewMode } from "@/types/enums";
import { hasEditAccess } from "@/lib/accessChecker";
import { GoalListing } from "@/lib/prisma/generated";
import GoalTable from "./goalTables/goalTable";
import TableSelector from './tableSelector/tableSelector';
import LinkTree from './goalTables/linkTree';
import { useOptimistic, useState, useTransition } from "react";
import { getStoredGoalSortBy, getStoredViewMode, setStoredGoalSortBy } from "./functions/tableFunctions";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import styles from './tables.module.css';
import type { getOneRoadmapIteration } from "@/fetchers";
import type { GoalListLikes } from "@/fetchers/getGoalListLikes";
import { useTranslation } from "react-i18next";
import { IconInfoCircle, IconSearch } from '@tabler/icons-react';
import { useClientState, useIsClient } from "@/functions/useClientState";
import { onlyLiked } from "@/functions/likeFilter";

export default function Goals({
  iteration,
  accessLevel,
  localizableIndicators,
  likes,
}: {
  iteration: NonNullable<Awaited<ReturnType<typeof getOneRoadmapIteration>>>,
  accessLevel?: AccessLevel,
  /** Indicator parameters the curated catalog can measure locally (a national roadmap's goals that can be taken into a local one); enables the filter */
  localizableIndicators?: string[],
  /**
   * Makes the list filterable on liked goals. The filter lives in the page's
   * search params: the page reads it, hands over the likes it selects, and the
   * controls here navigate to the page in another state. Nothing of it is
   * kept in component state, so a link to a filtered list and the browser's
   * back button show what the address says, also for a copy of the page that
   * was kept mounted while hidden.
   */
  likes?: GoalListLikes | null,
}) {
  const { t } = useTranslation("components");
  const router = useRouter();
  const isClient = useIsClient();
  const [, startNavigation] = useTransition();
  // The checkbox answers at once; the list follows when the page has loaded
  const [likedOnly, setLikedOnly] = useOptimistic(!!likes?.active);

  const [viewMode, setViewMode] = useClientState<ViewMode | ''>(ViewMode.Tree, () => getStoredViewMode(iteration.id));
  const [sortBy, setSortBy] = useClientState<GoalSortBy>(GoalSortBy.Default, () => getStoredGoalSortBy() || GoalSortBy.Default);
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [localizableOnly, setLocalizableOnly] = useState<boolean>(false);
  const localizable = new Set(localizableIndicators ?? []);
  const [showUnlisted, setShowUnlisted] = useState<boolean>(false);

  // Unlisted goals are hidden from the regular list; users with edit access get
  // them in a separate tab instead
  const listedGoals = iteration.goals.filter(goal => goal.listing !== GoalListing.UNLISTED);
  const unlistedGoals = hasEditAccess(accessLevel ?? AccessLevel.None)
    ? iteration.goals.filter(goal => goal.listing === GoalListing.UNLISTED)
    : [];
  const activeIteration = {
    ...iteration,
    goals: showUnlisted && unlistedGoals.length > 0 ? unlistedGoals : listedGoals,
  };

  // The likes each shown goal has from those the filter counts; null while the whole list is shown
  const likeCounts = likes?.active ? likes.counts : null;
  const likedGoals = likeCounts ? onlyLiked(activeIteration.goals, likeCounts) : activeIteration.goals;

  let filteredIteration = likeCounts ? { ...activeIteration, goals: likedGoals } : activeIteration;
  if (searchFilter) {
    filteredIteration = {
      ...filteredIteration,
      goals: filteredIteration.goals.filter(goal => {
        if (Object.values(goal).some(value => typeof value === 'string' && value.toLowerCase().includes(searchFilter.toLowerCase()))) {
          return true;
        } else if (goal.data_series && Object.values(goal.data_series).some(value => typeof value === 'string' && value.toLowerCase().includes(searchFilter.toLowerCase()))) {
          return true;
        }
      }),
    };
  }

  if (localizableOnly) {
    filteredIteration = {
      ...filteredIteration,
      goals: filteredIteration.goals.filter(goal => localizable.has(goal.indicator_parameter)),
    };
  }

  return (
    <>
      {unlistedGoals.length > 0 ?
        <nav className="flex gap-50 flex-wrap-wrap margin-bottom-100" aria-label={t("components:goals.unlisted_nav_label")}>
          <button
            type="button"
            className={`button round smooth${!showUnlisted ? ' seagreen color-purewhite font-weight-500' : ''}`}
            onClick={() => setShowUnlisted(false)}
            data-testid="listed-goals-tab"
          >
            {t("components:goals.listed_tab", { count: listedGoals.length })}
          </button>
          <button
            type="button"
            className={`button round smooth${showUnlisted ? ' seagreen color-purewhite font-weight-500' : ''}`}
            onClick={() => setShowUnlisted(true)}
            data-testid="unlisted-goals-tab"
          >
            {t("components:goals.unlisted_tab", { count: unlistedGoals.length })}
          </button>
        </nav>
        : null}
      <menu className={`margin-bottom-100 flex justify-content-space-between align-items-flex-end flex-wrap-wrap gap-100 padding-0 margin-0 ${styles.tableNav}`}>
        <label className="font-weight-bold flex-grow-100">
          {t("components:goals.search")}
          <div className="flex align-items-center margin-top-25 padding-50 smooth focusable">
            <IconSearch strokeWidth={1.5} style={{ minWidth: '24px' }} aria-hidden="true" />
            <input type="search" className="padding-0 margin-inline-50" onChange={(e) => setSearchFilter(e.target.value)} />
          </div>
        </label>
        {localizable.size > 0 ?
          <label className='flex align-items-center gap-50'>
            {t("components:goals.localizable_only_filter")}
            <input checked={localizableOnly} onChange={() => setLocalizableOnly(!localizableOnly)} type='checkbox' />
          </label>
          : null}
        {likes ?
          <label className='flex align-items-center gap-50'>
            {t("components:goals.liked_only_filter")}
            <input
              type='checkbox'
              checked={likedOnly}
              onChange={() => startNavigation(() => {
                setLikedOnly(!likes.active);
                // Replaces: the filter is a state of the page, not a step to go back through
                router.replace(likes.active ? likes.offHref : likes.onHref, { scroll: false });
              })}
              // A click before hydration would tick the box without going anywhere
              disabled={!isClient}
              data-testid="liked-only-toggle"
            />
          </label>
          : null}
        {viewMode === ViewMode.Table && (
          <label className="font-weight-bold">
            {t("components:goals.sort_by")}
            <select
              className="font-weight-500 margin-top-25 block"
              style={{ fontSize: '1rem', minHeight: 'calc(24px + 1rem)' }}
              onChange={(e) => { setSortBy(e.target.value as GoalSortBy); setStoredGoalSortBy(e.target.value as GoalSortBy); }} defaultValue={sortBy}
            >
              <option value={GoalSortBy.Default}>{t("components:goals.sort_default")}</option>
              <option value={GoalSortBy.Alpha}>{t("components:goals.sort_name_descending")}</option>
              <option value={GoalSortBy.AlphaReverse}>{t("components:goals.sort_name_ascending")}</option>
              <option value={GoalSortBy.ActionsFalling}>{t("components:goals.sort_action_count_descending")}</option>
              <option value={GoalSortBy.ActionsRising}>{t("components:goals.sort_action_count_ascending")}</option>
              <option value={GoalSortBy.Interesting}>{t("components:goals.sort_interest")}</option>
            </select>
          </label>
        )}
        <TableSelector id={iteration.id} current={viewMode} setter={setViewMode} />
        { // Only show the button if the user has edit access to the roadmap iteration
          hasEditAccess(accessLevel ?? AccessLevel.None) &&
          <Link className="button round color-purewhite pureblack font-weight-500" href={`/goal/create?iterationId=${iteration.id}`}>{t("components:goals.new_goal")}</Link>
        }
      </menu>

      {likes?.active ?
        <div className="flex gap-50 flex-wrap-wrap align-items-center margin-bottom-100">
          <nav className="flex gap-50 flex-wrap-wrap" aria-label={t("components:goals.likes.scope_label")} data-testid="liked-goals-scope">
            {likes.options.map(option => (
              <Link
                key={option.filter}
                href={option.href}
                replace={true}
                scroll={false}
                // Another state of this page, not somewhere to go: not worth fetching ahead for every scope
                prefetch={false}
                aria-current={option.filter === likes.active ? "true" : undefined}
                data-scope={option.filter}
                title={{
                  [LikeFilter.Mine]: t("components:goals.likes.scope_mine_title"),
                  [LikeFilter.Org]: t("components:goals.likes.scope_org_title"),
                  [LikeFilter.Area]: t("components:goals.likes.scope_area_title", { area: option.name }),
                  [LikeFilter.County]: t("components:goals.likes.scope_area_title", { area: option.name }),
                  [LikeFilter.All]: t("components:goals.likes.scope_all_title"),
                }[option.filter]}
                className={`button round smooth font-size-14px${option.filter === likes.active ? ' seagreen color-purewhite font-weight-500' : ''}`}
              >
                {{
                  [LikeFilter.Mine]: t("components:goals.likes.scope_mine"),
                  [LikeFilter.Org]: option.name ?? t("components:goals.likes.scope_org"),
                  [LikeFilter.Area]: t("components:goals.likes.scope_area", { area: option.name }),
                  [LikeFilter.County]: t("components:goals.likes.scope_area", { area: option.name }),
                  [LikeFilter.All]: t("components:goals.likes.scope_all"),
                }[option.filter]}
              </Link>
            ))}
          </nav>
          <span className="font-size-14px color-gray" data-testid="liked-goals-summary">
            {t("components:goals.likes.summary", { count: likedGoals.length, total: activeIteration.goals.length })}
          </span>
        </div>
        : null}

      {/* TODO: Probably not correct to handle loading as a default state? */}
      {/* TODO: Probably use a skeleton for the loading state */}
      {likeCounts && likedGoals.length === 0 ? (
        <p className="flex gap-50 align-items-center margin-top-0 padding-50 smooth" style={{ border: '1px solid var(--gray-80)' }} data-testid="liked-goals-empty">
          <IconInfoCircle aria-hidden="true" width={20} height={20} style={{ minWidth: '20px' }} />
          <span>{t("components:goals.likes.empty")}</span>
        </p>
      ) : viewMode === ViewMode.Tree ? (
        <LinkTree iteration={filteredIteration} likeCounts={likeCounts ?? undefined} />
      ) : viewMode === ViewMode.Table ? (
        <GoalTable iteration={filteredIteration} sortBy={sortBy} likeCounts={likeCounts ?? undefined} />
      ) :
        <Image
          src='/loaders/3-dots-scale.svg'
          width={64}
          height={64}
          alt={t("components:goals.loading_alt")}
          className='block margin-inline-auto'
        />
      }


    </>
  );
}