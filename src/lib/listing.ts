import { GoalListing } from "@/lib/prisma/generated";
import { hasEditAccess } from "@/lib/accessChecker";
import type { AccessLevel } from "@/types/enums";

/*
 * Listing rules, in one place. "Unlisted" never affects access (a direct link
 * works for anyone who may read the roadmap); it only decides whether a goal
 * shows up in lists, counts and other goals' parent/child/sibling lookups for
 * users who can't edit it. The query-side counterpart is `listedGoalsWHERE`
 * in `@/lib/accessFilters`. Versions have no listing tier: drafts are an
 * access matter (see accessChecker) and published versions are always listed.
 */

/** Whether a goal belongs in listings for a user with the given access to its version. */
export function isGoalListed(goal: { listing: GoalListing }, accessLevel: AccessLevel): boolean {
  if (goal.listing === GoalListing.UNLISTED) return hasEditAccess(accessLevel);
  return true;
}
