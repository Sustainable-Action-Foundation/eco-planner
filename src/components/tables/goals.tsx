"use client";

import { AccessLevel, GoalSortBy, ViewMode } from "@/types/enums";
import { hasEditAccess } from "@/lib/accessChecker";
import GoalTable from "./goalTables/goalTable";
import TableSelector from './tableSelector/tableSelector';
import LinkTree from './goalTables/linkTree';
import { useState } from "react";
import { getStoredGoalSortBy, getStoredViewMode, setStoredGoalSortBy } from "./functions/tableFunctions";
import Link from "next/link";
import Image from "next/image";
import styles from './tables.module.css';
import type { getOneRoadmapIteration } from "@/fetchers";
import { useTranslation } from "react-i18next";
import { IconSearch } from '@tabler/icons-react';

export default function Goals({
  iteration,
  accessLevel,
}: {
  iteration: NonNullable<Awaited<ReturnType<typeof getOneRoadmapIteration>>>,
  accessLevel?: AccessLevel
}) {
  const { t } = useTranslation("components");

  const [viewMode, setViewMode] = useState<ViewMode | ''>(getStoredViewMode(iteration.id));
  const [sortBy, setSortBy] = useState<GoalSortBy>(getStoredGoalSortBy() || GoalSortBy.Default);
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [recipeOnly, setRecipeOnly] = useState<boolean>(false);
  const [showUnlisted, setShowUnlisted] = useState<boolean>(false);

  // Unlisted goals are hidden from the regular list; users with edit access get
  // them in a separate tab instead
  const listedGoals = iteration.goals.filter(goal => !goal.is_unlisted);
  const unlistedGoals = hasEditAccess(accessLevel ?? AccessLevel.None)
    ? iteration.goals.filter(goal => goal.is_unlisted)
    : [];
  const activeIteration = {
    ...iteration,
    goals: showUnlisted && unlistedGoals.length > 0 ? unlistedGoals : listedGoals,
  };

  let filteredIteration = activeIteration;
  if (searchFilter) {
    filteredIteration = {
      ...activeIteration,
      goals: activeIteration.goals.filter(goal => {
        if (Object.values(goal).some(value => typeof value === 'string' && value.toLowerCase().includes(searchFilter.toLowerCase()))) {
          return true;
        } else if (goal.data_series && Object.values(goal.data_series).some(value => typeof value === 'string' && value.toLowerCase().includes(searchFilter.toLowerCase()))) {
          return true;
        }
      }),
    };
  }

  if (recipeOnly) {
    filteredIteration = {
      ...activeIteration,
      goals: activeIteration.goals.filter(goal => {
        // Every data series now has a recipe; manually entered series use an inline recipe tagged `meta.isManual`
        const recipe = goal.data_series?.recipe_used?.recipe;
        const isManual = (
          typeof recipe === 'object'
          && recipe !== null
          && !Array.isArray(recipe)
          && (recipe as { meta?: { isManual?: boolean } }).meta?.isManual === true
        );
        return !!goal.data_series?.recipe_used && !isManual;
      }),
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
        <label className='flex align-items-center gap-50'>
          {t("components:goals.recipe_only_filter")}
          <input checked={recipeOnly} onChange={() => setRecipeOnly(!recipeOnly)} type='checkbox' />
        </label>
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

      {/* TODO: Probably not correct to handle loading as a default state? */}
      {/* TODO: Probably use a skeleton for the loading state */}
      {viewMode === ViewMode.Tree ? (
        <LinkTree iteration={filteredIteration} />
      ) : viewMode === ViewMode.Table ? (
        <GoalTable iteration={filteredIteration} sortBy={sortBy} />
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