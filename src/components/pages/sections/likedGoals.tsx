import LikeGoalButton from "@/components/buttons/likeGoalButton";
import LikeAspectLegend from "@/components/likeAspectLegend";
import PendingLink from "@/components/generic/links/pendingLink";
import { getLikedGoals, getLikeScopes, rankByAspect } from "@/fetchers/getGoalLikes";
import { LikeAspect, LikeScope } from "@/types/enums";
import { isLikeAspect, likeAspectDescription, likeAspectLabel } from "@/functions/likeAspect";
import { goalDisplayName, indicatorParameterContext } from "@/functions/goalName";
import serveTea from "@/lib/i18nServer";
import { IconCopyCheck, IconInfoCircle } from "@tabler/icons-react";
import Link from "next/link";
import styles from "./likedGoals.module.css" with { type: "css" };
import type { LikedGoal } from "@/fetchers/getGoalLikes";

/** The search param naming the list's scope (a `LikeScope`, lowercase); absent for the org's own */
export const likeScopeParam = "likes";
/** The search param narrowing the list to one `LikeAspect`; absent for all goals */
export const likeAspectParam = "aspect";

type SearchParams = { [key: string]: string | string[] | undefined };

/** The `LikeAspect` the search params ask for, if a listed one */
export function likeAspectFromParams(searchParams: SearchParams): LikeAspect | null {
  const value = searchParams[likeAspectParam];
  const first = Array.isArray(value) ? value[0] : value;
  const upper = first?.toUpperCase();
  return isLikeAspect(upper) ? upper : null;
}

/** `path` with the page's search params, some of them changed (null drops one) */
function hrefWith(path: string, searchParams: SearchParams, changes: Record<string, string | null>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (key in changes || value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) params.append(key, item);
  }
  for (const [key, value] of Object.entries(changes)) {
    if (value !== null) params.set(key, value);
  }
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

/**
 * The org landing page's ranked list of the goals the org's members have
 * liked (see `getLikedGoals`): which goals the org wants to work on. An org
 * placed in a geo area can widen the list to everyone in the area (see
 * `getLikeScopes`), to prioritize together with the other organizations
 * there. A goal of another org can be copied into one of the org's roadmaps
 * from here, the same way as from the goal's own page, and a goal the org
 * already has a copy of says so, so adoption is visible in the overview.
 */
export default async function LikedGoals({
  orgId,
  scope: requestedScope,
  searchParams,
  canCreateGoals,
}: {
  /** The org whose members' likes are listed */
  orgId: string,
  /** Whose likes to count; falls back to the org's own when the org lacks the scope */
  scope: LikeScope,
  /** The page's search params, kept by the scope and aspect links */
  searchParams: SearchParams,
  /** Whether the user can add goals to some roadmap version of the org, i.e. copy from the list */
  canCreateGoals: boolean,
}) {
  const t = await serveTea(["pages", "common"]);
  const scopes = await getLikeScopes(orgId);
  const current = scopes.find(option => option.scope === requestedScope) ?? scopes[0];
  const goals = await getLikedGoals(orgId, current.scope);

  /** The page as it is, with the list in another scope */
  function scopeHref(scope: LikeScope): string {
    return hrefWith("/", searchParams, { [likeScopeParam]: scope === LikeScope.Org ? null : scope.toLowerCase() });
  }

  return <>
    <h2 className="margin-top-0 margin-bottom-50 font-weight-600">
      {t("pages:home.liked_goals.title")}
    </h2>
    <p className="margin-top-0 margin-bottom-100 color-gray">
      {current.area
        ? t("pages:home.liked_goals.description_area", { area: current.area.name })
        : t("pages:home.liked_goals.description")}
    </p>

    {scopes.length > 1 ?
      <nav className="flex gap-50 flex-wrap-wrap margin-bottom-100" aria-label={t("pages:home.liked_goals.scope_label")} data-testid="liked-goals-scope">
        {scopes.map(option => (
          <Link
            key={option.scope}
            href={scopeHref(option.scope)}
            // The list is far down the page; stay there
            scroll={false}
            aria-current={option.scope === current.scope ? "true" : undefined}
            data-scope={option.scope}
            className={`button round smooth font-size-14px${option.scope === current.scope ? ' seagreen color-purewhite font-weight-500' : ''}`}
          >
            {option.area
              ? t("pages:home.liked_goals.scope_area", { area: option.area.name })
              : t("pages:home.liked_goals.scope_org")}
          </Link>
        ))}
      </nav>
      : null}

    {/* The likes overview of each area the org belongs to, pooling all its orgs */}
    {scopes.some(option => option.area) ?
      <p className="flex gap-50 flex-wrap-wrap margin-top-0 margin-bottom-100 font-size-14px" data-testid="liked-goals-overview">
        {scopes.flatMap(option => option.area ? [
          <Link key={option.area.code} href={`/likes/${option.area.code}`} data-area={option.area.code}>
            {t("pages:home.liked_goals.overview_link", { area: option.area.name })}
          </Link>,
        ] : [])}
      </p>
      : null}

    <LikedGoalList
      goals={goals}
      path="/"
      searchParams={searchParams}
      orgId={orgId}
      canCreateGoals={canCreateGoals}
      showOrgCount={!!current.area}
      emptyText={current.area ? t("pages:home.liked_goals.empty_area", { area: current.area.name }) : t("pages:home.liked_goals.empty")}
    />
  </>;
}

/**
 * A ranked list of liked goals with a filter on the aspects the likes carry
 * (`?aspect=`, see `LikeAspect`): only the aspects some goal in the list was
 * liked with are offered. Filtered, the list keeps the goals liked with the
 * aspect, ranked by how many likes carry it.
 */
export async function LikedGoalList({
  goals: allGoals,
  path,
  searchParams,
  orgId,
  canCreateGoals,
  showOrgCount,
  emptyText,
}: {
  goals: LikedGoal[],
  /** The page's path, for the filter links */
  path: string,
  searchParams: SearchParams,
  /** The org the list is seen from, for copies and foreign goals; null for none */
  orgId: string | null,
  canCreateGoals: boolean,
  showOrgCount: boolean,
  /** Shown when nobody in scope liked anything */
  emptyText: string,
}) {
  const t = await serveTea(["pages", "common"]);
  const aspect = likeAspectFromParams(searchParams);
  const goals = rankByAspect(allGoals, aspect);
  const offered = Object.values(LikeAspect).filter(item => item === aspect || allGoals.some(goal => (goal.aspectCounts[item] ?? 0) > 0));

  return <>
    {offered.length > 0 ? <>
      <nav className="flex gap-25 flex-wrap-wrap align-items-center margin-bottom-50" aria-label={t("pages:home.liked_goals.aspect_filter_label")} data-testid="liked-goals-aspect">
        <span className="font-size-14px color-gray margin-right-25">{t("pages:home.liked_goals.aspect_filter_label")}:</span>
        {[null, ...offered].map(item => (
          <Link
            key={item ?? "all"}
            href={hrefWith(path, searchParams, { [likeAspectParam]: item })}
            scroll={false}
            aria-current={item === aspect ? "true" : undefined}
            data-aspect={item ?? ""}
            title={item ? likeAspectDescription(t, item) : undefined}
            className={`button round smooth font-size-14px padding-block-25${item === aspect ? ' seagreen color-purewhite font-weight-500' : ''}`}
          >
            {item ? likeAspectLabel(t, item) : t("pages:home.liked_goals.aspect_all")}
          </Link>
        ))}
      </nav>
      <LikeAspectLegend t={t} className="margin-bottom-100" />
    </> : null}

    {goals.length === 0 ?
      <p className="flex gap-50 align-items-center margin-top-0 margin-bottom-100 padding-50 smooth" style={{ border: '1px solid var(--gray-80)' }} data-testid="liked-goals-empty">
        <IconInfoCircle aria-hidden="true" width={20} height={20} style={{ minWidth: '20px' }} />
        <span>{aspect && allGoals.length > 0 ? t("pages:home.liked_goals.empty_aspect", { aspect: likeAspectLabel(t, aspect) }) : emptyText}</span>
      </p>
      :
      <ol className="margin-0 padding-0 flex flex-direction-column gap-50" style={{ listStyle: 'none' }} data-testid="liked-goals">
        {goals.map((goal, index) => <LikedGoalRow key={goal.id} goal={goal} rank={index + 1} orgId={orgId} canCreateGoals={canCreateGoals} showOrgCount={showOrgCount} highlight={aspect} />)}
      </ol>
    }
  </>;
}

async function LikedGoalRow({ goal, rank, orgId, canCreateGoals, showOrgCount, highlight }: {
  goal: LikedGoal,
  rank: number,
  orgId: string | null,
  canCreateGoals: boolean,
  /** Area-wide lists say how many organizations stand behind the likes */
  showOrgCount: boolean,
  /** The aspect the list is filtered on, marked among the row's aspects */
  highlight: LikeAspect | null,
}) {
  const t = await serveTea(["pages", "common"]);
  const aspects = Object.values(LikeAspect).filter(aspect => (goal.aspectCounts[aspect] ?? 0) > 0);
  const name = goalDisplayName({ name: goal.name, indicator_parameter: goal.indicatorParameter });
  const context = indicatorParameterContext(goal.indicatorParameter);
  const isForeign = goal.org.id !== orgId;

  return (
    <li className="smooth padding-50 flex gap-100 align-items-center flex-wrap-wrap" style={{ border: '1px solid var(--gray-80)' }} data-testid="liked-goal" data-goal-id={goal.id}>
      <span className="font-weight-600 color-gray" style={{ minWidth: '2ch', textAlign: 'right' }} aria-label={t("pages:home.liked_goals.rank", { rank })}>{rank}</span>

      <div className="flex-grow-100" style={{ minWidth: '200px' }}>
        <Link href={`/goal/${goal.id}`} className="color-pureblack font-weight-500">{name}</Link>
        <small className="block color-gray">
          {context ? `${context} · ` : ""}
          {t("common:roadmap_version_name", { name: goal.roadmap.name, version: goal.roadmap.version })}
          {isForeign ? ` · ${goal.org.name}` : ""}
        </small>
        {goal.copies.length > 0 ?
          <small className="display-inline-flex align-items-center gap-25 margin-top-25 color-gray" data-testid="liked-goal-copied" title={goal.copies.map(copy => goalDisplayName({ name: copy.name, indicator_parameter: copy.indicatorParameter })).join(", ")}>
            <IconCopyCheck aria-hidden="true" width={16} height={16} style={{ minWidth: '16px', color: 'var(--seagreen)' }} />
            {t("pages:home.liked_goals.copied", { count: goal.copies.length })}
          </small>
          : null}
        {aspects.length > 0 ?
          <ul className={`margin-0 margin-top-25 padding-0 ${styles.aspects}`} aria-label={t("pages:home.liked_goals.aspects_label")} data-testid="liked-goal-aspects">
            {aspects.map(aspect => (
              <li
                key={aspect}
                className={`${styles.aspect}${aspect === highlight ? ` ${styles.highlight}` : ""}`}
                title={likeAspectDescription(t, aspect)}
                data-aspect={aspect}
              >
                {t("pages:home.liked_goals.aspect_count", { aspect: likeAspectLabel(t, aspect), count: goal.aspectCounts[aspect] })}
              </li>
            ))}
          </ul>
          : null}
      </div>

      <LikeGoalButton goalId={goal.id} liked={goal.likedByViewer} likeCount={goal.likeCount} aspects={goal.viewerAspects} layout="row" />
      {showOrgCount ?
        <small className="color-gray" data-testid="liked-goal-org-count">
          {t("pages:home.liked_goals.org_count", { count: goal.orgCount })}
        </small>
        : null}
      {goal.totalLikeCount > goal.likeCount ?
        <small className="color-gray" title={t("pages:home.liked_goals.total_likes_title")}>
          {t("pages:home.liked_goals.total_likes", { count: goal.totalLikeCount })}
        </small>
        : null}

      {isForeign && canCreateGoals ?
        <PendingLink
          href={`/goal/create?from=${encodeURIComponent(goal.id)}`}
          className="font-size-14px font-weight-500 display-inline-flex align-items-center gap-25"
          iconSize={16}
        >
          {t("pages:home.liked_goals.copy")}
        </PendingLink>
        : null}
    </li>
  );
}
