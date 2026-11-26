import "server-only";
import { getLikedGoals, getLikeScopes } from "@/fetchers/getGoalLikes";
import { goalDisplayName, indicatorParameterContext } from "@/functions/goalName";
import { OrgTab, orgLandingPath } from "@/functions/orgLanding";
import serveTea from "@/lib/i18nServer";
import { LikeScope } from "@/types/enums";
import { likeScopeParam } from "@/components/pages/sections/likedGoals";
import Link from "next/link";
import styles from "./orgLanding.module.css" with { type: "css" };

/** How many goals the short lists show; the full ranking is a link away */
const topCount = 6;

/**
 * The public view's "this is what we want to affect": the most liked goals in the
 * org's area, all organizations together (the org's own when it has no area), over
 * the goals the viewer can see.
 */
export async function PublicTopLiked({ orgId, asVisitor, canOpenAreaOverview }: {
  orgId: string,
  asVisitor: boolean,
  /** Whether to link to the area's full likes overview, which is for members of its orgs */
  canOpenAreaOverview: boolean,
}) {
  const t = await serveTea(["pages", "common"]);
  const scopes = await getLikeScopes(orgId);
  const current = scopes.find(option => option.scope === LikeScope.Area) ?? scopes[0];
  const goals = await getLikedGoals(orgId, current.scope, { asVisitor });

  return <>
    <p className="margin-top-0 margin-bottom-100 color-gray">
      {current.area
        ? t("pages:org_landing.public.liked_description_area", { area: current.area.name })
        : t("pages:org_landing.public.liked_description")}
    </p>
    {goals.length === 0 ?
      <p className={styles.empty} data-testid="org-top-liked-empty">{t("pages:org_landing.public.liked_empty")}</p>
      : <>
        <ol className={styles.rows} data-testid="org-top-liked">
          {goals.slice(0, topCount).map(goal => {
            const context = indicatorParameterContext(goal.indicatorParameter);
            return (
              <li key={goal.id} style={{ justifyContent: 'flex-start' }} data-goal-id={goal.id}>
                <span className={styles.count} aria-hidden="true">{goal.likeCount}</span>
                <span>
                  <Link href={`/goal/${goal.id}`} className="color-pureblack font-weight-500">
                    {goalDisplayName({ name: goal.name, indicator_parameter: goal.indicatorParameter })}
                  </Link>
                  <small className="block color-gray">
                    {context ? `${context} · ` : ""}
                    {t("pages:org_landing.liked_by", { count: goal.likeCount })}
                  </small>
                </span>
              </li>
            );
          })}
        </ol>
        {current.area && canOpenAreaOverview ?
          <p className="margin-bottom-0">
            <Link href={`/likes/${current.area.code}`}>{t("pages:org_landing.public.liked_all", { count: goals.length, area: current.area.name })}</Link>
          </p>
          : null}
      </>}
  </>;
}

/**
 * The working view's overview table of the most liked goals, for the org or its
 * whole area (`?likes=`, the same param the full list uses).
 */
export async function WorkingTopLiked({ orgId, scope: requestedScope }: { orgId: string, scope: LikeScope }) {
  const t = await serveTea(["pages", "common"]);
  // The overview offers the org and its own area; the county stays on the full list
  const scopes = (await getLikeScopes(orgId)).filter(option => option.scope !== LikeScope.County);
  const current = scopes.find(option => option.scope === requestedScope) ?? scopes[0];
  const goals = await getLikedGoals(orgId, current.scope);

  return <>
    <div className="flex gap-100 flex-wrap-wrap align-items-center justify-content-space-between margin-bottom-100">
      <h2 className="margin-0 font-size-125 font-weight-600" id="org-top-liked-title">{t("pages:org_landing.working.liked_title")}</h2>
      {scopes.length > 1 ?
        <nav className="flex gap-50 flex-wrap-wrap" aria-label={t("pages:org_landing.working.liked_scope_label")} data-testid="org-top-liked-scope">
          {scopes.map(option => (
            <Link
              key={option.scope}
              href={orgLandingPath(orgId, option.scope === LikeScope.Org ? {} : { params: { [likeScopeParam]: option.scope.toLowerCase() } })}
              scroll={false}
              aria-current={option.scope === current.scope ? "true" : undefined}
              data-scope={option.scope}
              className={`button round smooth font-size-14px padding-block-25${option.scope === current.scope ? ' seagreen color-purewhite font-weight-500' : ''}`}
            >
              {option.area
                ? t("pages:org_landing.working.liked_scope_area", { area: option.area.name })
                : t("pages:org_landing.working.liked_scope_org")}
            </Link>
          ))}
        </nav>
        : null}
    </div>

    {goals.length === 0 ?
      <p className={`${styles.empty} margin-0`} data-testid="org-top-liked-empty">
        {current.area ? t("pages:home.liked_goals.empty_area", { area: current.area.name }) : t("pages:home.liked_goals.empty")}
      </p>
      : <>
        <div className={styles.tableBox}>
          <table aria-labelledby="org-top-liked-title" data-testid="org-top-liked">
            <thead>
              <tr>
                <th scope="col">{t("pages:org_landing.working.liked_goal")}</th>
                <th scope="col">{t("pages:org_landing.working.liked_category")}</th>
                <th scope="col" className={styles.number}>{t("pages:org_landing.working.liked_count")}</th>
              </tr>
            </thead>
            <tbody>
              {goals.slice(0, topCount).map(goal => (
                <tr key={goal.id} data-goal-id={goal.id}>
                  <td>
                    <Link href={`/goal/${goal.id}`} className="color-pureblack font-weight-500">
                      {goalDisplayName({ name: goal.name, indicator_parameter: goal.indicatorParameter })}
                    </Link>
                  </td>
                  <td>{indicatorParameterContext(goal.indicatorParameter)}</td>
                  <td className={styles.number}>{goal.likeCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="margin-bottom-0">
          <Link href={orgLandingPath(orgId, { tab: OrgTab.Liked, params: current.scope === LikeScope.Org ? {} : { [likeScopeParam]: current.scope.toLowerCase() } })}>
            {t("pages:org_landing.working.liked_all", { count: goals.length })}
          </Link>
        </p>
      </>}
  </>;
}
