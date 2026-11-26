import "server-only";
import { getUserAccessContext } from "@/fetchers/getUserAccessContext";
import { boundedFill, uncachedFallback } from "@/fetchers/cacheFallback";
import { listedActionsWHERE, listedGoalsWHERE, listedRoadmapsWHERE, readableAccessControlWHERE, visibleCommentsWHERE, visibleRoadmapIterationsWHERE } from "@/lib/accessFilters";
import { currentIteration } from "@/functions/orgReport";
import { prisma } from "@/lib/prisma";
import { GoalListing, IterationStatus, OrgRole } from "@/lib/prisma/generated";
import type { OrgType } from "@/lib/prisma/generated";
import type { Prisma } from "@PRISMA-NAMESPACE-ONLY";
import type { UserAccessContext } from "@/types";
import { HiddenRoadmaps } from "@/types/enums";
import { cacheTag } from "next/cache";

/** What the viewer can see of the org's work, in numbers: the landing's process and key figures */
export type OrgCounts = {
  /**
   * Goals in the org's listed roadmaps, as the roadmap lists these numbers are shown next to
   * count them: each roadmap's current version only, and unlisted goals left out for everyone
   */
  goals: number,
  /** Of those, the ones with a baseline */
  goalsWithBaseline: number,
  /** Of those, the ones an action has an effect on */
  goalsWithActions: number,
  /** The org's actions, as its action list shows them */
  actions: number,
};

const noCounts: OrgCounts = { goals: 0, goalsWithBaseline: 0, goalsWithActions: 0, actions: 0 };

/**
 * Counts of the org's goals and actions, over what the requesting user may see:
 * hidden roadmaps and drafts only count for those who can write to them, so the
 * numbers never reveal more than the lists do.
 * @param options.asVisitor What a visitor without a login gets, whoever asks (the public view's preview)
 */
export async function getOrgCounts(orgId: string, options: { asVisitor?: boolean } = {}): Promise<OrgCounts> {
  const accessContext = options.asVisitor ? null : await getUserAccessContext();
  return uncachedFallback(() => getCachedOrgCounts(orgId, accessContext), noCounts, "Error fetching org counts", { orgId });
}

async function getCachedOrgCounts(orgId: string, accessContext: UserAccessContext | null): Promise<OrgCounts> {
  'use cache';
  cacheTag('database', 'goal', 'action', 'roadmap', 'roadmapIteration');

  return boundedFill("getCachedOrgCounts", async () => {
    const listedRoadmap = listedRoadmapsWHERE(accessContext, HiddenRoadmaps.Exclude);
    const iterations = await prisma.roadmapIterations.findMany({
      where: {
        AND: [
          visibleRoadmapIterationsWHERE(accessContext),
          { roadmap: { AND: [{ access_control: { org_id: orgId } }, listedRoadmap] } },
        ],
      },
      select: { id: true, roadmap_id: true, version: true, status: true },
    });
    // One version per roadmap, the one the roadmap lists show it as (see `currentIteration`).
    // Older versions hold the same goals once more and would count them twice.
    const current = Object.values(Object.groupBy(iterations, iteration => iteration.roadmap_id))
      .flatMap(versions => currentIteration(versions ?? []) ?? []);
    const goals: Prisma.GoalsWhereInput = {
      // Displayed counts exclude unlisted goals (see roadmapInclusionSelection)
      listing: { not: GoalListing.UNLISTED },
      roadmap_iteration_id: { in: current.map(iteration => iteration.id) },
    };

    const [goalCount, goalsWithBaseline, goalsWithActions, actions] = await Promise.all([
      prisma.goals.count({ where: goals }),
      prisma.goals.count({ where: { ...goals, baseline_id: { not: null } } }),
      prisma.goals.count({ where: { ...goals, effects: { some: {} } } }),
      // Same filter as the org's action list (getActionSummaries)
      prisma.actions.count({ where: listedActionsWHERE(accessContext, orgId) }),
    ]);

    return { goals: goalCount, goalsWithBaseline, goalsWithActions, actions };
  });
}

/** An org placed in an area, as the landing's "organizations in the area" lists show it */
export type AreaOrg = { id: string, name: string, orgType: OrgType | null };

/** The orgs placed in exactly this area, by name. Org names and areas are public (every org has a public view). */
export async function getAreaOrgs(areaCode: string): Promise<AreaOrg[]> {
  return uncachedFallback(() => getCachedAreaOrgs(areaCode), [], "Error fetching area orgs", { areaCode });
}

async function getCachedAreaOrgs(areaCode: string): Promise<AreaOrg[]> {
  'use cache';
  cacheTag('database', 'org');

  return boundedFill("getCachedAreaOrgs", async () => {
    const orgs = await prisma.orgs.findMany({
      where: { geo_area_code: areaCode },
      select: { id: true, name: true, org_type: true },
      orderBy: { name: 'asc' },
    });
    return orgs.map(org => ({ id: org.id, name: org.name, orgType: org.org_type }));
  });
}

/** A comment written on something of the org */
export type OrgComment = {
  id: string,
  createdAt: Date,
  text: string,
  /** Null when the author's account is gone */
  author: { username: string, first_name: string | null, last_name: string | null } | null,
  target:
    | { type: "goal", id: string, name: string | null, indicatorParameter: string }
    | { type: "action", id: string, name: string }
    | { type: "roadmapIteration", roadmapId: string, name: string, version: number }
    | { type: "roadmap", id: string, name: string },
};

/** What a comment was written on, and when: all the activity list needs (no author, so no `user` tag there) */
const orgCommentTargetSelection = {
  id: true,
  created_at: true,
  action: { select: { id: true, name: true } },
  goal: { select: { id: true, name: true, indicator_parameter: true } },
  roadmap_iteration: { select: { version: true, roadmap: { select: { id: true, name: true } } } },
  roadmap: { select: { id: true, name: true } },
} satisfies Prisma.CommentsSelect;

const orgCommentSelection = {
  ...orgCommentTargetSelection,
  comment_text: true,
  author: { select: { username: true, first_name: true, last_name: true } },
} satisfies Prisma.CommentsSelect;

/** Matches the comments on the org's roadmaps, versions, goals and actions that the user may see */
function orgCommentsWHERE(orgId: string, accessContext: UserAccessContext | null): Prisma.CommentsWhereInput {
  const ownedRoadmap: Prisma.RoadmapsWhereInput = { access_control: { org_id: orgId } };
  return {
    AND: [
      visibleCommentsWHERE(accessContext),
      {
        OR: [
          { action: { org_id: orgId } },
          { goal: { roadmap_iteration: { roadmap: ownedRoadmap } } },
          { roadmap_iteration: { roadmap: ownedRoadmap } },
          { roadmap: ownedRoadmap },
        ],
      },
    ],
  };
}

function commentTarget(comment: Prisma.CommentsGetPayload<{ select: typeof orgCommentTargetSelection }>): OrgComment["target"] | null {
  if (comment.goal) return { type: "goal", id: comment.goal.id, name: comment.goal.name, indicatorParameter: comment.goal.indicator_parameter };
  if (comment.action) return { type: "action", id: comment.action.id, name: comment.action.name };
  if (comment.roadmap_iteration) return { type: "roadmapIteration", roadmapId: comment.roadmap_iteration.roadmap.id, name: comment.roadmap_iteration.roadmap.name, version: comment.roadmap_iteration.version };
  if (comment.roadmap) return { type: "roadmap", id: comment.roadmap.id, name: comment.roadmap.name };
  return null;
}

export const OrgEventKind = {
  Roadmap: "ROADMAP",
  Version: "VERSION",
  Goals: "GOALS",
  Action: "ACTION",
  Comment: "COMMENT",
  Likes: "LIKES",
} as const;
export type OrgEventKind = (typeof OrgEventKind)[keyof typeof OrgEventKind];

/** Something that happened in the org, read off the creation time of what it left behind */
export type OrgEvent = { at: Date } & (
  | { kind: typeof OrgEventKind.Roadmap, roadmap: { id: string, name: string } }
  | { kind: typeof OrgEventKind.Version, roadmap: { id: string, name: string }, version: number, draft: boolean }
  /** Goals added to one roadmap version on one day (imports and copies add many at once) */
  | { kind: typeof OrgEventKind.Goals, roadmap: { id: string, name: string }, version: number, count: number, goal: { id: string, name: string | null, indicatorParameter: string } }
  | { kind: typeof OrgEventKind.Action, action: { id: string, name: string } }
  | { kind: typeof OrgEventKind.Comment, target: OrgComment["target"] }
  /** The likes the org's members gave on one day */
  | { kind: typeof OrgEventKind.Likes, members: number, goals: number }
);

/** How many events the overview shows */
const eventLimit = 10;
/** Rows read per kind before grouping by day; enough for the latest ten days of anything */
const eventScan = 200;

/**
 * The latest things that happened in the org, newest first, over what the requesting
 * user may see. There is no activity log: this is derived from creation timestamps, so
 * it knows about new roadmaps, versions, goals, actions, comments and likes, and nothing
 * about edits, hiding or who joined when.
 */
export async function getOrgActivity(orgId: string): Promise<OrgEvent[]> {
  const accessContext = await getUserAccessContext();
  return uncachedFallback(() => getCachedOrgActivity(orgId, accessContext), [], "Error fetching org activity", { orgId });
}

/** The day an event belongs to, in Swedish time, for grouping */
function dayOf(date: Date): string {
  return date.toLocaleDateString("sv-SE", { timeZone: "Europe/Stockholm" });
}

async function getCachedOrgActivity(orgId: string, accessContext: UserAccessContext | null): Promise<OrgEvent[]> {
  'use cache';
  cacheTag('database', 'roadmap', 'roadmapIteration', 'goal', 'action', 'goalLike', 'org');

  return boundedFill("getCachedOrgActivity", async () => {
    const listedRoadmap: Prisma.RoadmapsWhereInput = { AND: [{ access_control: { org_id: orgId } }, listedRoadmapsWHERE(accessContext, HiddenRoadmaps.Exclude)] };
    const visibleIteration: Prisma.RoadmapIterationsWhereInput = { AND: [visibleRoadmapIterationsWHERE(accessContext), { roadmap: listedRoadmap }] };
    const newest = { created_at: 'desc' } as const;

    const [roadmaps, versions, goals, actions, comments, likes] = await Promise.all([
      prisma.roadmaps.findMany({
        where: { AND: [listedRoadmap, { access_control: readableAccessControlWHERE(accessContext) }] },
        select: { id: true, name: true, created_at: true },
        orderBy: newest,
        take: eventLimit,
      }),
      // A roadmap's first version comes with the roadmap itself
      prisma.roadmapIterations.findMany({
        where: { AND: [visibleIteration, { version: { gt: 1 } }] },
        select: { version: true, status: true, created_at: true, roadmap: { select: { id: true, name: true } } },
        orderBy: newest,
        take: eventLimit,
      }),
      prisma.goals.findMany({
        where: { roadmap_iteration: visibleIteration, AND: [listedGoalsWHERE(accessContext)] },
        select: { id: true, name: true, indicator_parameter: true, created_at: true, roadmap_iteration: { select: { id: true, version: true, roadmap: { select: { id: true, name: true } } } } },
        orderBy: newest,
        take: eventScan,
      }),
      // Same filter as the org's action list (getActionSummaries)
      prisma.actions.findMany({
        where: listedActionsWHERE(accessContext, orgId),
        select: { id: true, name: true, created_at: true },
        orderBy: newest,
        take: eventLimit,
      }),
      prisma.comments.findMany({
        where: orgCommentsWHERE(orgId, accessContext),
        select: orgCommentTargetSelection,
        orderBy: newest,
        take: eventLimit,
      }),
      prisma.goalLikes.findMany({
        where: {
          user: { memberships: { some: { org_id: orgId, role: { not: OrgRole.GUEST } } } },
          goal: { roadmap_iteration: visibleRoadmapIterationsWHERE(accessContext), AND: [listedGoalsWHERE(accessContext)] },
        },
        select: { user_id: true, goal_id: true, created_at: true },
        orderBy: newest,
        take: eventScan,
      }),
    ]);

    const events: OrgEvent[] = [
      ...roadmaps.map(roadmap => ({ kind: OrgEventKind.Roadmap, at: roadmap.created_at, roadmap: { id: roadmap.id, name: roadmap.name } })),
      ...versions.map(version => ({ kind: OrgEventKind.Version, at: version.created_at, roadmap: version.roadmap, version: version.version, draft: version.status === IterationStatus.DRAFT })),
      ...actions.map(action => ({ kind: OrgEventKind.Action, at: action.created_at, action: { id: action.id, name: action.name } })),
      ...comments.flatMap(comment => {
        const target = commentTarget(comment);
        return target ? [{ kind: OrgEventKind.Comment, at: comment.created_at, target }] : [];
      }),
    ];

    // Rows come newest first, so the first of a group carries its latest time
    const goalGroups = new Map<string, Extract<OrgEvent, { kind: typeof OrgEventKind.Goals }>>();
    for (const goal of goals) {
      const key = `${dayOf(goal.created_at)}:${goal.roadmap_iteration.id}`;
      const group = goalGroups.get(key);
      if (group) group.count += 1;
      else goalGroups.set(key, {
        kind: OrgEventKind.Goals,
        at: goal.created_at,
        roadmap: goal.roadmap_iteration.roadmap,
        version: goal.roadmap_iteration.version,
        count: 1,
        goal: { id: goal.id, name: goal.name, indicatorParameter: goal.indicator_parameter },
      });
    }
    events.push(...goalGroups.values());

    const likeGroups = new Map<string, { at: Date, users: Set<string>, goals: Set<string> }>();
    for (const like of likes) {
      const key = dayOf(like.created_at);
      const group = likeGroups.get(key) ?? { at: like.created_at, users: new Set<string>(), goals: new Set<string>() };
      group.users.add(like.user_id);
      group.goals.add(like.goal_id);
      likeGroups.set(key, group);
    }
    events.push(...[...likeGroups.values()].map(group => ({ kind: OrgEventKind.Likes, at: group.at, members: group.users.size, goals: group.goals.size })));

    return events.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, eventLimit);
  });
}

/** How many comments the comments tab lists */
const commentLimit = 100;

/**
 * The comments written on the org's roadmaps, versions, goals and actions, newest first.
 * Comments on things the requesting user can't see are left out, so no name leaks.
 */
export async function getOrgComments(orgId: string): Promise<OrgComment[]> {
  const accessContext = await getUserAccessContext();
  return uncachedFallback(() => getCachedOrgComments(orgId, accessContext), [], "Error fetching org comments", { orgId });
}

/** The comment API revalidates the tag of the commented object's type; the object APIs cover renames, deletes and sharing changes */
async function getCachedOrgComments(orgId: string, accessContext: UserAccessContext | null): Promise<OrgComment[]> {
  'use cache';
  cacheTag('database', 'user', 'roadmap', 'roadmapIteration', 'goal', 'action', 'org');

  return boundedFill("getCachedOrgComments", async () => {
    const comments = await prisma.comments.findMany({
      where: orgCommentsWHERE(orgId, accessContext),
      select: orgCommentSelection,
      orderBy: [{ created_at: 'desc' }, { id: 'asc' }],
      take: commentLimit,
    });
    return comments.flatMap(comment => {
      const target = commentTarget(comment);
      return target ? [{ id: comment.id, createdAt: comment.created_at, text: comment.comment_text, author: comment.author, target }] : [];
    });
  });
}
