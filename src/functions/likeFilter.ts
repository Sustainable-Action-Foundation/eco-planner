import { LikeFilter } from "@/types/enums";
import type { GoalTree } from "@/types";

/**
 * The search param that turns a roadmap version's goal list into its liked
 * goals and names whose likes count (a `LikeFilter`, lowercase); absent for
 * the whole list. The same param names the scope of the org landing's ranked
 * list, so a link can carry the scope from one to the other.
 */
export const likeFilterParam = "likes";

/** The search param naming the org the likes are seen from, as on the start page; absent for the viewer's own */
export const likeFilterOrgParam = "org";

type SearchParams = { [key: string]: string | string[] | undefined };

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** The `LikeFilter` a `?likes=` value names, whatever its case; null for none or an unknown one */
export function parseLikeFilter(value: string | string[] | undefined): LikeFilter | null {
  const upper = first(value)?.toUpperCase();
  return Object.values(LikeFilter).find(filter => filter === upper) ?? null;
}

/**
 * The filter a viewer starts from among the ones they have: their org's own
 * likes, since the list is there for an org to see what its people want to
 * work on; without an org, the widest one left. Null when they have none.
 */
export function defaultLikeFilter(available: readonly LikeFilter[]): LikeFilter | null {
  return [LikeFilter.Org, LikeFilter.Area, LikeFilter.County, LikeFilter.All, LikeFilter.Mine].find(filter => available.includes(filter)) ?? null;
}

/** Whether the page was asked for liked goals at all, i.e. has a `?likes=` */
export function wantsLikeFilter(value: string | string[] | undefined): boolean {
  return first(value) !== undefined;
}

/**
 * The filter in use for a `?likes=` value: none without the param, the named
 * one when the viewer has it, and otherwise their default, so a link made by
 * someone with other scopes still shows liked goals.
 */
export function resolveLikeFilter(value: string | string[] | undefined, available: readonly LikeFilter[]): LikeFilter | null {
  if (!wantsLikeFilter(value)) return null;
  const requested = parseLikeFilter(value);
  return requested && available.includes(requested) ? requested : defaultLikeFilter(available);
}

/** `path` with the page's search params and the list filtered on `filter`; null for the whole list */
export function likeFilterHref(path: string, searchParams: SearchParams, filter: LikeFilter | null): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (key === likeFilterParam || value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) params.append(key, item);
  }
  if (filter) params.set(likeFilterParam, filter.toLowerCase());
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

/**
 * The goals with a like among the counted ones. The goal tree is built from
 * what is left, so a branch without liked goals is not there at all.
 */
export function onlyLiked<T extends { id: string }>(goals: T[], likeCounts: Record<string, number>): T[] {
  return goals.filter(goal => (likeCounts[goal.id] ?? 0) > 0);
}

/** How many goals a goal tree, or a branch of one, holds */
export function countTreeGoals(tree: GoalTree): number {
  let count = 0;
  for (const node of Object.values(tree)) {
    // A goal has an id; anything else is a branch
    count += typeof node.id === "string" ? 1 : countTreeGoals(node as GoalTree);
  }
  return count;
}
