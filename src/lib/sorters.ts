import dataSeriesInterest from "@/functions/weightedAverageDelta";
import { RoadmapType } from "@/lib/prisma/generated";
import type { Action, Goal } from "@/types";

// Used for alphabetical sorting, we use Swedish locale and ignore case, but it can be changed here
const collator = new Intl.Collator('sv', { numeric: true, sensitivity: 'accent', caseFirst: 'upper' });

/**
 * Sorts roadmaps by type (national first), then alphabetically by name
 */
export function roadmapSorter<T extends { type: RoadmapType, name: string }>(a: T, b: T) {
  // Higher priority roadmaps are first in the values array, so we reverse it to
  // account for the fact that indexOf() returns -1 if the element is not found, which
  // should be considered lower priority than any other index
  const values = Object.values(RoadmapType);
  values.reverse();
  const aIndex = values.indexOf(a.type);
  const bIndex = values.indexOf(b.type);
  // Larger index means higher priority (closer to national level)
  if (aIndex > bIndex) {
    return -1;
  } else if (aIndex < bIndex) {
    return 1;
  } else {
    return collator.compare(a.name, b.name);
  }
}

/**
 * Sorts roadmap iterations by their roadmap's type (national first), then alphabetically by roadmap name, then by version (higher first)
 */
export function roadmapIterationSorter<T extends { roadmap: { type: RoadmapType, name: string }, version: number }>(a: T, b: T) {
  // Higher priority roadmaps are first in the values array, so we reverse it to
  // account for the fact that indexOf() returns -1 if the element is not found, which
  // should be considered lower priority than any other index
  const values = Object.values(RoadmapType);
  values.reverse();
  const aIndex = values.indexOf(a.roadmap.type);
  const bIndex = values.indexOf(b.roadmap.type);
  // Larger index means higher priority (closer to national level)
  // Negative return values means a is placed before b in the sorted array
  if (aIndex > bIndex) {
    return -1;
  }
  else if (aIndex < bIndex) {
    return 1;
  }
  else if (collator.compare(a.roadmap.name, b.roadmap.name) === 0) {
    // If the roadmaps have the same name, sort by version (higher version first)
    return b.version - a.version;
  }
  else {
    return collator.compare(a.roadmap.name, b.roadmap.name);
  }
}

/**
 * Sorts roadmaps alphabetically by name, A-Z
 */
export function roadmapSorterAZ<T extends { roadmap: { name: string } }>(a: T, b: T) {
  return collator.compare(a.roadmap.name, b.roadmap.name);
}

/**
 * Sorts roadmaps by their number of goals (more goals first), with name as a tiebreaker
 */
export function roadmapSorterGoalAmount<T extends { roadmap: { name: string }, _count: { goals: number } }>(a: T, b: T) {
  if (a._count.goals > b._count.goals) {
    return -1;
  } else if (a._count.goals < b._count.goals) {
    return 1;
  } else {
    return collator.compare(a.roadmap.name, b.roadmap.name);
  }
}

/**
 * Sorts goals alphabetically, with those with a set name placed before those with inferred names.
 * If no name is provided, the indicator parameter is used instead.
 */
export function goalSorter<T extends { name: string | null, indicator_parameter: string }>(a: T, b: T) {
  if (a.name && !b.name) {
    return -1;
  } else if (b.name && !a.name) {
    return 1;
  } else {
    return collator.compare(a.name || a.indicator_parameter, b.name || b.indicator_parameter);
  }
}

/**
 * Sorts goals in reverse alphabetical order, with those with a set name placed before those with inferred names.
 * If no name is provided, the indicator parameter is used instead.
 */
export function goalSorterReverse(a: Goal, b: Goal) {
  if (a.name && !b.name) {
    return -1;
  } else if (b.name && !a.name) {
    return 1;
  } else {
    return -collator.compare(a.name || a.indicator_parameter, b.name || b.indicator_parameter);
  }
}

/**
 * Sorts goals by their indicator parameter, mainly alphabetically but with some special cases
 * If the parameters start the same way, the shorter one is placed first in order to place links (leaves) before branches in a tree (see: goalsToTree.ts and linkTree.tsx)
 * @example "Example\\Parameter\\B" is placed before "Example\\Parameter\\A\\Test" because of length, even though "B" comes after "A" alphabetically
 * @example "Example\\Test\\A" and "Example\\Parameter\\A\\Test" are sorted alphabetically because they don't have enough common parameters at the start
 */
export function goalSorterTree<T extends { indicator_parameter: string }>(a: T, b: T) {
  const aLength = a.indicator_parameter.split('\\').length;
  const bLength = b.indicator_parameter.split('\\').length;
  const minLength = Math.min(aLength, bLength);
  // Truncate the strings to be one section shorter than the shortest string
  const aTrunc = a.indicator_parameter.split('\\').slice(0, (minLength - 1 || 1)).join('\\');
  const bTrunc = b.indicator_parameter.split('\\').slice(0, (minLength - 1 || 1)).join('\\');
  // Compare the truncated strings and sort by length if they are the same
  if (aTrunc === bTrunc) {
    return aLength - bLength || collator.compare(a.indicator_parameter, b.indicator_parameter);
  }
  return collator.compare(a.indicator_parameter, b.indicator_parameter);
}

/**
 * Sorts goals by their number of actions (most actions first).
 */
export function goalSorterActionAmount<T extends { _count: { effects: number } }>(a: T, b: T) {
  if (a._count.effects > b._count.effects) {
    return -1;
  } else if (a._count.effects < b._count.effects) {
    return 1;
  } else {
    return 0;
  }
}

/**
 * Sorts goals by their number of actions (fewest actions first).
 */
export function goalSorterActionAmountReverse<T extends { _count: { effects: number } }>(a: T, b: T) {
  if (a._count.effects < b._count.effects) {
    return -1;
  } else if (a._count.effects > b._count.effects) {
    return 1;
  } else {
    return 0;
  }
}

/**
 * Sorts goals by how "interesting" their data series are
 */
export function goalSorterInterest<T extends { data_series: { values: { timestamp: Date; value: number; }[], unit: string | null; id: string; } | null }>(a: T, b: T) {
  if (a.data_series == null && b.data_series == null) {
    return 0;
  } else if (a.data_series != null && b.data_series == null) {
    return -1;
  } else if (a.data_series == null && b.data_series != null) {
    return 1;
  } else {
    // Should never be null here, but included for type safety
    if (a.data_series == null || b.data_series == null) {
      return 0;
    }
    // Higher interest gets sorted first
    const aInterest = dataSeriesInterest({
      ...a.data_series,
      values: a.data_series.values.map(v => ({ ...v, data_series_id: "" })),
    });
    const bInterest = dataSeriesInterest({
      ...b.data_series,
      values: b.data_series.values.map(v => ({ ...v, data_series_id: "" })),
    });
    return bInterest - aInterest;
  }
}

/**
 * Sorts actions alphabetically by name
 */
export function actionSorter(a: Action, b: Action) {
  return collator.compare(a.name, b.name);
}

/**
 * Sorts effects alphabetically based on the name of the action
 */
export function effectSorter<T extends { action: { name: string } }>(a: T, b: T) {
  return collator.compare(a.action.name, b.action.name);
}

/**
 * Sorts actions by start year, then by end year, then by name
 * Unclear parameter names to enable sorting of ApexAxisChartSeries['data']
 */
export function actionGraphSorter<T extends { x: string, y: number[] }>(a: T, b: T) {
  // Start year
  if ((a.y[0] || 0) < (b.y[0] || 0)) {
    return -1;
  }
  else if ((a.y[0] || 0) > (b.y[0] || 0)) {
    return 1;
  }
  // End year
  else if ((a.y[1] || 0) < (b.y[1] || 0)) {
    return -1;
  }
  else if ((a.y[1] || 0) > (b.y[1] || 0)) {
    return 1;
  }
  else {
    // Name
    return collator.compare(a.x, b.x);
  }
}

/**
 * Sorts effects by action start year, then by action end year, then by action name
 */
export function effectGraphSorter<T extends { action: { name: string, startYear: number, endYear: number } }>(a: T, b: T) {
  // Start year
  if (a.action.startYear < b.action.startYear) {
    return -1;
  }
  else if (a.action.startYear > b.action.startYear) {
    return 1;
  }
  // End year
  else if (a.action.endYear < b.action.endYear) {
    return -1;
  }
  else if (a.action.endYear > b.action.endYear) {
    return 1;
  }
  else {
    // Name
    return collator.compare(a.action.name, b.action.name);
  }
}

/**
 * Sorts comments by time created, newest first.
 * Since `'use cache'` returns stringified dates we need to convert them to Date objects first.
 */
export function commentSorter<T extends { created_at: Date | string }>(a: T, b: T) {
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

/**
 * Sorts areas alphabetically by name, but putting the national area (code: "00") first
 */
export function areaSorter<T extends [name: string, code: string]>(a: T, b: T) {
  if (a[1] === "00" && b[1] === "00") {
    return collator.compare(a[0], b[0]);
  }
  else if (a[1] === "00") {
    return -1;
  } else if (b[1] === "00") {
    return 1;
  } else {
    return collator.compare(a[0], b[0]);
  }
}
