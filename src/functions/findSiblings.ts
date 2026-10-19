import { GoalListing } from "@/lib/prisma/generated";

/** What sibling matching reads from a goal */
type SiblingMatchable = {
  id: string,
  indicator_parameter: string,
  listing?: GoalListing,
  data_series: { unit: string | null } | null,
};

/** The indicator parameter's segments without a leading "Key" or "Demand", which don't affect sibling relations */
export function siblingPathSegments(indicatorParameter: string): string[] {
  const segments = indicatorParameter.split("\\");
  if (segments[0] === "Key" || segments[0] === "Demand") {
    segments.shift();
  }
  return segments;
}

/**
 * The indicator parameter prefixes every sibling of a goal starts with (the parent path, bare and
 * behind "Key"/"Demand"), for narrowing candidates in the query; null when any goal on the same
 * level could be one (top-level goals). `findSiblings` still makes the exact match.
 */
export function siblingIndicatorPrefixes(indicatorParameter: string): string[] | null {
  const segments = siblingPathSegments(indicatorParameter);
  if (segments.length < 2) return null;
  const parentPath = `${segments.slice(0, -1).join("\\")}\\`;
  return [parentPath, `Key\\${parentPath}`, `Demand\\${parentPath}`];
}

/**
 * Goals in the same roadmap version that sit next to `goal` in the indicator tree: same level,
 * same parent path, same unit, and not unlisted. The goal itself is not its own sibling.
 */
export default function findSiblings<T extends SiblingMatchable>(
  candidates: T[],
  goal: SiblingMatchable,
): T[] {
  const siblings: T[] = [];

  const goalParameters = siblingPathSegments(goal.indicator_parameter);

  for (const sibling of candidates) {
    // We do not include the goal itself among it's sibings
    if (sibling.id === goal.id) {
      continue;
    }

    // Unlisted goals are excluded from other goals' sibling listings
    if (sibling.listing === GoalListing.UNLISTED) {
      continue;
    }

    // Goals can be siblings despite one of them having a "Key" and the other a "Demand" parameter
    const siblingParameters = siblingPathSegments(sibling.indicator_parameter);

    let isSibling = true;
    // Goals with different data units are not siblings
    // TODO: Use mathjs for comparison
    if (goal.data_series?.unit !== sibling.data_series?.unit) {
      isSibling = false;
    }
    // Goals on different levels are not siblings
    if (isSibling) {
      if (goalParameters.length !== siblingParameters.length) {
        isSibling = false;
      }
    }
    // Goals with different parameters (except the last one) are not siblings
    if (isSibling) {
      for (let i = 0; i < goalParameters.length - 1; i++) {
        if (goalParameters[i] !== siblingParameters[i]) {
          isSibling = false;
          break;
        }
      }
    }
    if (isSibling) {
      siblings.push(sibling);
    }
  }

  return siblings;
}
