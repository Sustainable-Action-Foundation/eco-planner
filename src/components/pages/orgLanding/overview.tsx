import "server-only";
import { getOrgManagement } from "@/fetchers";
import { getLikedGoals, getLikeScopes } from "@/fetchers/getGoalLikes";
import { getAreaOrgs, getOrgActivity, getOrgComments, getOrgCounts, OrgEventKind } from "@/fetchers/getOrgOverview";
import type { OrgComment, OrgEvent } from "@/fetchers/getOrgOverview";
import { getOrgPeople } from "@/fetchers/getOrgPeople";
import { goalDisplayName } from "@/functions/goalName";
import { OrgGap, orgGaps, ProfileField } from "@/functions/orgGaps";
import type { OrgGapItem } from "@/functions/orgGaps";
import { OrgTab, orgLandingPath } from "@/functions/orgLanding";
import { orgTypeLabel } from "@/functions/orgTypeLabel";
import { displayName } from "@/functions/personName";
import truncateText from "@/functions/truncateText";
import { iterationPath } from "@/functions/versionSlug";
import { managesOrg } from "@/lib/accessChecker";
import serveTea from "@/lib/i18nServer";
import { showHiddenParam } from "@/lib/listing";
import { OrgRole } from "@/lib/prisma/generated";
import { LikeScope } from "@/types/enums";
import type { TFunction } from "i18next";
import Link from "next/link";
import styles from "./orgLanding.module.css" with { type: "css" };
import type { WorkingViewProps } from "./types";

type OverviewProps = Pick<WorkingViewProps, "org" | "accessContext" | "allRoadmaps">;

/** Goals of other orgs the org's members have liked that no goal of the org is derived from yet */
async function likedWithoutGoal(orgId: string): Promise<{ liked: number, withoutGoal: number }> {
  const liked = await getLikedGoals(orgId, LikeScope.Org);
  return { liked: liked.length, withoutGoal: liked.filter(goal => goal.org.id !== orgId && goal.copies.length === 0).length };
}

/** "Gaps and suggestions": what the org's data says is missing (see `orgGaps`), each with one link to where it is fixed */
export async function Gaps({ org, accessContext, allRoadmaps }: OverviewProps) {
  const [t, people, likes] = await Promise.all([
    serveTea(["pages", "common"]),
    getOrgPeople(org.id),
    likedWithoutGoal(org.id),
  ]);
  const gaps = orgGaps({
    manages: managesOrg(accessContext, org.id),
    visibleRoadmapCount: allRoadmaps.filter(roadmap => !roadmap.hidden).length,
    hiddenRoadmapCount: allRoadmaps.filter(roadmap => roadmap.hidden).length,
    likedWithoutGoalCount: likes.withoutGoal,
    hasArea: !!org.geoArea,
    profile: { description: !!org.description, orgType: !!org.orgType, contact: !!org.contactEmail, banner: !!org.bannerUpdatedAt },
    memberCount: people.memberCount,
    membersWithoutLikes: people.membersWithoutLikes,
  });

  const fieldNames: Record<ProfileField, string> = {
    [ProfileField.Description]: t("pages:org_landing.gaps.field_description"),
    [ProfileField.OrgType]: t("pages:org_landing.gaps.field_org_type"),
    [ProfileField.Contact]: t("pages:org_landing.gaps.field_contact"),
    [ProfileField.Banner]: t("pages:org_landing.gaps.field_banner"),
  };
  const manageHref = `/org/${org.id}/groups`;

  function describe(item: OrgGapItem): { title: string, text: string, href: string, link: string } {
    switch (item.gap) {
      case OrgGap.NoVisibleRoadmap: {
        return item.hiddenRoadmapCount > 0
          ? {
            title: t("pages:org_landing.gaps.no_roadmap_title"),
            text: t("pages:org_landing.gaps.no_roadmap_hidden", { count: item.hiddenRoadmapCount }),
            href: orgLandingPath(org.id, { tab: OrgTab.Roadmaps, params: { [showHiddenParam]: "true" } }),
            link: t("pages:org_landing.gaps.no_roadmap_show_hidden"),
          }
          : {
            title: t("pages:org_landing.gaps.no_roadmap_title"),
            text: t("pages:org_landing.gaps.no_roadmap"),
            href: "/roadmap/create",
            link: t("pages:home.create_roadmap"),
          };
      }
      case OrgGap.LikedWithoutGoal: {
        return {
          title: t("pages:org_landing.gaps.liked_title", { count: item.count }),
          text: t("pages:org_landing.gaps.liked"),
          href: orgLandingPath(org.id, { tab: OrgTab.Liked }),
          link: t("pages:org_landing.gaps.liked_link"),
        };
      }
      case OrgGap.NoArea: {
        return {
          title: t("pages:org_landing.working.no_area_title"),
          text: t("pages:org_landing.gaps.no_area"),
          href: manageHref,
          link: t("pages:org_landing.working.set_area"),
        };
      }
      case OrgGap.EmptyProfile: {
        return {
          title: t("pages:org_landing.gaps.profile_title"),
          text: t("pages:org_landing.gaps.profile", { fields: item.missing.map(field => fieldNames[field]).join(", ") }),
          href: manageHref,
          link: t("pages:org_landing.public.about_fill_in"),
        };
      }
      case OrgGap.MembersWithoutLikes: {
        return {
          title: t("pages:org_landing.gaps.members_title", { count: item.count, total: item.memberCount }),
          text: t("pages:org_landing.gaps.members"),
          href: orgLandingPath(org.id, { tab: OrgTab.Members }),
          link: t("pages:org_landing.gaps.members_link"),
        };
      }
      default: {
        const exhaustive: never = item;
        return exhaustive;
      }
    }
  }

  return <>
    <h2 id="org-gaps-title" className="margin-top-0 margin-bottom-50 font-size-125 font-weight-600">{t("pages:org_landing.gaps.title")}</h2>
    {gaps.length === 0 ?
      <p className="margin-0 color-gray" data-testid="org-gaps-empty">{t("pages:org_landing.gaps.empty")}</p>
      :
      <ul className={styles.rows} data-testid="org-gaps">
        {gaps.map(item => {
          const gap = describe(item);
          return (
            <li key={item.gap} data-gap={item.gap}>
              <span style={{ flex: '1 1 30ch' }}>
                <strong className="block">{gap.title}</strong>
                <span className="color-gray">{gap.text}</span>
              </span>
              <Link href={gap.href} className="button round smooth font-size-14px white-space-nowrap">{gap.link}</Link>
            </li>
          );
        })}
      </ul>}
  </>;
}

/** "The state of things": the org in four numbers */
export async function KeyNumbers({ org, allRoadmaps }: OverviewProps) {
  const [t, people, counts, likes] = await Promise.all([
    serveTea(["pages", "common"]),
    getOrgPeople(org.id),
    getOrgCounts(org.id),
    likedWithoutGoal(org.id),
  ]);

  return <>
    <h2 id="org-numbers-title" className="margin-top-0 margin-bottom-50 font-size-125 font-weight-600">{t("pages:org_landing.numbers.title")}</h2>
    <dl className={styles.numbers} data-testid="org-numbers">
      {people.memberCount !== null ? <div><dt>{t("pages:org_landing.numbers.members")}</dt><dd data-testid="org-number-members">{people.memberCount}</dd></div> : null}
      <div><dt>{t("pages:org_landing.numbers.liked")}</dt><dd data-testid="org-number-liked">{likes.liked}</dd></div>
      <div><dt>{t("pages:org_landing.numbers.roadmaps")}</dt><dd data-testid="org-number-roadmaps">{allRoadmaps.filter(roadmap => !roadmap.hidden).length}</dd></div>
      <div><dt>{t("pages:org_landing.numbers.actions")}</dt><dd data-testid="org-number-actions">{counts.actions}</dd></div>
    </dl>
  </>;
}

function commentTargetLink(t: TFunction, target: OrgComment["target"]): { href: string, label: string } {
  switch (target.type) {
    case "goal": {
      return { href: `/goal/${target.id}`, label: t("pages:profile.comment_on_goal", { name: goalDisplayName({ name: target.name, indicator_parameter: target.indicatorParameter }) }) };
    }
    case "action": {
      return { href: `/action/${target.id}`, label: t("pages:profile.comment_on_action", { name: target.name }) };
    }
    case "roadmapIteration": {
      return { href: iterationPath(target.roadmapId, target.version), label: t("pages:profile.comment_on_roadmap_version", { name: target.name, version: target.version }) };
    }
    case "roadmap": {
      return { href: `/roadmap/${target.id}`, label: t("pages:profile.comment_on_roadmap", { name: target.name }) };
    }
    default: {
      const exhaustive: never = target;
      return exhaustive;
    }
  }
}

function eventLine(t: TFunction, event: OrgEvent): { text: string, href: string | null } {
  switch (event.kind) {
    case OrgEventKind.Roadmap: {
      return { text: t("pages:org_landing.activity.roadmap", { name: event.roadmap.name }), href: `/roadmap/${event.roadmap.id}` };
    }
    case OrgEventKind.Version: {
      return {
        text: event.draft
          ? t("pages:org_landing.activity.draft", { name: event.roadmap.name, version: event.version })
          : t("pages:org_landing.activity.version", { name: event.roadmap.name, version: event.version }),
        href: iterationPath(event.roadmap.id, event.version),
      };
    }
    case OrgEventKind.Goals: {
      return event.count === 1
        ? { text: t("pages:org_landing.activity.goal", { name: goalDisplayName({ name: event.goal.name, indicator_parameter: event.goal.indicatorParameter }), roadmap: event.roadmap.name }), href: `/goal/${event.goal.id}` }
        : { text: t("pages:org_landing.activity.goals", { count: event.count, roadmap: event.roadmap.name }), href: iterationPath(event.roadmap.id, event.version) };
    }
    case OrgEventKind.Action: {
      return { text: t("pages:org_landing.activity.action", { name: event.action.name }), href: `/action/${event.action.id}` };
    }
    case OrgEventKind.Comment: {
      const target = commentTargetLink(t, event.target);
      return { text: t("pages:org_landing.activity.comment", { target: target.label }), href: target.href };
    }
    case OrgEventKind.Likes: {
      return {
        text: t("pages:org_landing.activity.likes", { members: t("pages:org_landing.activity.likes_members", { count: event.members }), goals: t("pages:org_landing.activity.likes_goals", { count: event.goals }) }),
        href: null,
      };
    }
    default: {
      const exhaustive: never = event;
      return exhaustive;
    }
  }
}

/** "Lately": the newest things that happened in the org (see `getOrgActivity`) */
export async function RecentActivity({ org }: OverviewProps) {
  const [t, events] = await Promise.all([serveTea(["pages", "common"]), getOrgActivity(org.id)]);

  return <>
    <h2 id="org-activity-title" className="margin-top-0 margin-bottom-50 font-size-125 font-weight-600">{t("pages:org_landing.activity.title")}</h2>
    {events.length === 0 ?
      <p className="margin-0 color-gray" data-testid="org-activity-empty">{t("pages:org_landing.activity.empty")}</p>
      :
      <ol className={styles.rows} data-testid="org-activity">
        {events.map((event, index) => {
          const line = eventLine(t, event);
          return (
            <li key={index} style={{ display: 'block' }} data-kind={event.kind}>
              <time className="block font-size-14px color-gray" dateTime={event.at.toISOString()}>
                {t("pages:org_landing.activity.date", { date: event.at, formatParams: { date: { dateStyle: "medium" } } })}
              </time>
              {line.href ? <Link href={line.href} className="color-pureblack">{line.text}</Link> : <span>{line.text}</span>}
            </li>
          );
        })}
      </ol>}
    <p className="margin-bottom-0">
      <Link href={orgLandingPath(org.id, { tab: OrgTab.Comments })}>{t("pages:org_landing.activity.all_comments")}</Link>
    </p>
  </>;
}

/**
 * The other orgs placed in the same area, with how many goals each one's members have
 * liked among those the viewer can see. Shared by both views; renders nothing for an
 * org without an area or alone in it.
 */
export async function AreaOrgs({ org, asVisitor, working }: { org: WorkingViewProps["org"], asVisitor: boolean, working: boolean }) {
  if (!org.geoArea) return null;
  const area = org.geoArea;
  const scopes = await getLikeScopes(org.id);
  const [t, orgs, liked] = await Promise.all([
    serveTea(["pages", "common"]),
    getAreaOrgs(area.code),
    scopes.some(option => option.scope === LikeScope.Area) ? getLikedGoals(org.id, LikeScope.Area, { asVisitor }) : [],
  ]);
  const others = orgs
    .filter(other => other.id !== org.id)
    .map(other => ({ ...other, liked: liked.filter(goal => goal.orgIds.includes(other.id)).length }))
    .sort((a, b) => b.liked - a.liked || a.name.localeCompare(b.name, "sv"));
  if (others.length === 0) return null;

  return (
    <section className={working ? styles.card : "margin-block-300"} aria-labelledby="org-area-title" data-testid="org-area-orgs">
      <h2 id="org-area-title" className={`margin-top-0 margin-bottom-50 font-weight-600${working ? " font-size-125" : ""}`}>
        {working ? t("pages:org_landing.area_orgs.title_working", { area: area.name }) : t("pages:org_landing.area_orgs.title_public", { area: area.name })}
      </h2>
      <ul className={styles.rows}>
        {others.map(other => (
          <li key={other.id}>
            <Link href={orgLandingPath(other.id)} className="color-pureblack font-weight-500">{other.name}</Link>
            <span className="color-gray font-size-14px">
              {[
                other.orgType ? orgTypeLabel(t, other.orgType) : null,
                other.liked > 0 ? t("pages:org_landing.area_orgs.liked", { count: other.liked }) : null,
              ].filter(Boolean).join(" · ")}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The comments tab: what has been written on the org's roadmaps, goals and actions, newest first */
export async function CommentsTab({ org }: OverviewProps) {
  const [t, comments] = await Promise.all([serveTea(["pages", "common"]), getOrgComments(org.id)]);

  return (
    <section aria-labelledby="org-comments-title">
      <h2 id="org-comments-title" className="margin-top-0 margin-bottom-100 font-weight-600">{t("pages:org_landing.tabs.comments")}</h2>
      {comments.length === 0 ?
        <p className={`${styles.empty} margin-0`} data-testid="org-comments-empty">{t("pages:org_landing.comments.empty")}</p>
        :
        <ul className={styles.rows} data-testid="org-comments">
          {comments.map(comment => {
            const target = commentTargetLink(t, comment.target);
            return (
              <li key={comment.id} style={{ display: 'block' }}>
                <Link href={target.href} className="font-weight-500 color-pureblack">{target.label}</Link>
                <p className="margin-0" style={{ wordBreak: 'break-word' }}>{truncateText(comment.text, 300)}</p>
                <small className="block color-gray">
                  {comment.author ? `${displayName(comment.author)} · ` : ""}
                  <time dateTime={comment.createdAt.toISOString()}>
                    {t("pages:org_landing.activity.date", { date: comment.createdAt, formatParams: { date: { dateStyle: "medium" } } })}
                  </time>
                </small>
              </li>
            );
          })}
        </ul>}
    </section>
  );
}

/**
 * The members tab, for those who manage the org: who is in it and in what role.
 * Roles and groups are changed on the management page, which this links to.
 */
export async function MembersTab({ org }: OverviewProps) {
  const [t, management] = await Promise.all([serveTea(["pages", "common"]), getOrgManagement(org.id)]);
  // Managers only (the tab isn't offered to others); nothing for anyone who got here anyway
  if (!management) return null;
  const members = management.members.filter(member => member.role !== OrgRole.GUEST);

  return (
    <section aria-labelledby="org-members-title">
      <div className="flex gap-100 flex-wrap-wrap align-items-center justify-content-space-between margin-bottom-100">
        <h2 id="org-members-title" className="margin-0 font-weight-600">{t("pages:org_groups.member_count", { count: members.length })}</h2>
        <Link href={`/org/${org.id}/groups`} className="button round smooth">{t("pages:org_landing.members.manage")}</Link>
      </div>
      <div className={styles.tableBox}>
        <table aria-labelledby="org-members-title" data-testid="org-members">
          <thead>
            <tr>
              <th scope="col">{t("pages:org_landing.members.name")}</th>
              <th scope="col">{t("pages:org_landing.members.role")}</th>
            </tr>
          </thead>
          <tbody>
            {members.map(member => (
              <tr key={member.membershipId}>
                <td>{member.name}</td>
                <td>{member.role === OrgRole.MANAGER ? t("pages:org_groups.roles.manager") : t("pages:org_groups.roles.member")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** The count after a tab's name: liked goals, or members (for those who may know) */
export async function TabCount({ orgId, tab }: { orgId: string, tab: OrgTab }) {
  let count: number | null = null;
  if (tab === OrgTab.Liked) count = (await getLikedGoals(orgId, LikeScope.Org)).length;
  if (tab === OrgTab.Members) count = (await getOrgPeople(orgId)).memberCount;
  return count === null ? null : <> ({count})</>;
}
