import { GoalListing } from "@/lib/prisma/generated";
import { hasEditAccess } from "@/lib/accessChecker";
import { HiddenRoadmaps } from "@/types/enums";
import type { AccessLevel } from "@/types/enums";

/*
 * Listing rules, in one place. "Unlisted" never affects access (a direct link
 * works for anyone who may read the roadmap); it only decides whether a goal
 * shows up in lists, counts and other goals' parent/child/sibling lookups for
 * users who can't edit it. The query-side counterpart is `listedGoalsWHERE`
 * in `@/lib/accessFilters`. Versions have no listing tier: drafts are an
 * access matter (see accessChecker) and published versions are always listed.
 * Roadmaps can be hidden: left out of listings and pickers but reachable by URL
 * (query side: `listedRoadmapsWHERE`).
 */

/** Whether a goal belongs in listings for a user with the given access to its version. */
export function isGoalListed(goal: { listing: GoalListing }, accessLevel: AccessLevel): boolean {
  if (goal.listing === GoalListing.UNLISTED) return hasEditAccess(accessLevel);
  return true;
}

/** Whether a roadmap belongs in a listing, given the user's access to it and which hidden roadmaps the listing includes. */
export function isRoadmapListed(roadmap: { hidden: boolean }, accessLevel: AccessLevel, hidden: HiddenRoadmaps): boolean {
  if (!roadmap.hidden || hidden === HiddenRoadmaps.Include) return true;
  return hidden === HiddenRoadmaps.Writable && hasEditAccess(accessLevel);
}

/** The search param of the roadmap listings' "show hidden" toggle (`?showHidden=true`) */
export const showHiddenParam = "showHidden";
