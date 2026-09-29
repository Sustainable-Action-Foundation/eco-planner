import LikeGoalButton from "@/components/buttons/likeGoalButton";
import PendingLink from "@/components/generic/links/pendingLink";
import { getLikedGoals, getLikeScopes } from "@/fetchers/getGoalLikes";
import { LikeScope } from "@/types/enums";
import { goalDisplayName, indicatorParameterContext } from "@/functions/goalName";
import serveTea from "@/lib/i18nServer";
import { IconCopyCheck, IconInfoCircle } from "@tabler/icons-react";
import Link from "next/link";
import type { LikedGoal } from "@/fetchers/getGoalLikes";

/** The search param naming the list's scope (a `LikeScope`, lowercase); absent for the org's own */
export const likeScopeParam = "likes";

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
  /** The page's search params, kept by the scope links */
  searchParams: { [key: string]: string | string[] | undefined },
  /** Whether the user can add goals to some roadmap version of the org, i.e. copy from the list */
  canCreateGoals: boolean,
}) {
  const t = await serveTea(["pages", "common"]);
  const scopes = await getLikeScopes(orgId);
  const current = scopes.find(option => option.scope === requestedScope) ?? scopes[0];
  const goals = await getLikedGoals(orgId, current.scope);

  /** The page as it is, with the list in another scope */
  function scopeHref(scope: LikeScope): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (key === likeScopeParam || value === undefined) continue;
      for (const item of Array.isArray(value) ? value : [value]) params.append(key, item);
    }
    if (scope !== LikeScope.Org) params.set(likeScopeParam, scope.toLowerCase());
    const query = params.toString();
    return query ? `/?${query}` : "/";
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

    {goals.length === 0 ?
      <p className="flex gap-50 align-items-center margin-top-0 margin-bottom-100 padding-50 smooth" style={{ border: '1px solid var(--gray-80)' }} data-testid="liked-goals-empty">
        <IconInfoCircle aria-hidden="true" width={20} height={20} style={{ minWidth: '20px' }} />
        <span>{current.area ? t("pages:home.liked_goals.empty_area", { area: current.area.name }) : t("pages:home.liked_goals.empty")}</span>
      </p>
      :
      <ol className="margin-0 padding-0 flex flex-direction-column gap-50" style={{ listStyle: 'none' }} data-testid="liked-goals">
        {goals.map((goal, index) => <LikedGoalRow key={goal.id} goal={goal} rank={index + 1} orgId={orgId} canCreateGoals={canCreateGoals} showOrgCount={!!current.area} />)}
      </ol>
    }
  </>;
}

async function LikedGoalRow({ goal, rank, orgId, canCreateGoals, showOrgCount }: {
  goal: LikedGoal,
  rank: number,
  orgId: string,
  canCreateGoals: boolean,
  /** Area-wide lists say how many organizations stand behind the likes */
  showOrgCount: boolean,
}) {
  const t = await serveTea(["pages", "common"]);
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
      </div>

      <LikeGoalButton goalId={goal.id} liked={goal.likedByViewer} likeCount={goal.likeCount} />
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
