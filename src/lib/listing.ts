import { GoalListing, IterationStatus } from "@/lib/prisma/generated";
import { hasEditAccess } from "@/lib/accessChecker";
import type { AccessLevel } from "@/types/enums";

/*
 * Listing rules, in one place. "Unlisted" never affects access (a direct link
 * works for anyone who may read the roadmap); it only decides whether an item
 * shows up in lists, counts and other items' parent/child/sibling lookups for
 * users who can't edit it. The query-side counterparts are
 * `listedRoadmapIterationsWHERE` / `listedGoalsWHERE` in `@/lib/accessFilters`.
 */

/** Whether a roadmap version belongs in listings for a user with the given access to it. */
export function isIterationListed(iteration: { status: IterationStatus }, accessLevel: AccessLevel): boolean {
  if (iteration.status === IterationStatus.DRAFT) return hasEditAccess(accessLevel);
  if (iteration.status === IterationStatus.UNLISTED) return hasEditAccess(accessLevel);
  return true;
}

/** Whether a goal belongs in listings for a user with the given access to its version. */
export function isGoalListed(goal: { listing: GoalListing }, accessLevel: AccessLevel): boolean {
  if (goal.listing === GoalListing.UNLISTED) return hasEditAccess(accessLevel);
  return true;
}
