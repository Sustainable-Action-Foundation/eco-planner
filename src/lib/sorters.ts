import dataSeriesInterest from "@/functions/weightedAverageDelta";
import { Action, Comment, DataSeries, Goal, MetaRoadmap, RoadmapType } from "@prisma/client";

// Used for alphabetical sorting, we use Swedish locale and ignore case, but it can be changed here
const collator = new Intl.Collator('sv', { numeric: true, sensitivity: 'accent', caseFirst: 'upper' });

/**
 * Sorts meta roadmaps by type (national first), then alphabetically by name
 */
export function metaRoadmapSorter(a: MetaRoadmap, b: MetaRoadmap) {
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
 * Sorts roadmaps by type (national first), then alphabetically by name
 */
export function roadmapSorter(a: { metaRoadmap: MetaRoadmap }, b: { metaRoadmap: MetaRoadmap }) {
  // Higher priority roadmaps are first in the values array, so we reverse it to
  // account for the fact that indexOf() returns -1 if the element is not found, which
  // should be considered lower priority than any other index
  const values = Object.values(RoadmapType);
  values.reverse();
  const aIndex = values.indexOf(a.metaRoadmap.type);
  const bIndex = values.indexOf(b.metaRoadmap.type);
  // Larger index means higher priority (closer to national level)
  // Negative return values means a is placed before b in the sorted array
  if (aIndex > bIndex) {
    return -1;
  } else if (aIndex < bIndex) {
    return 1;
  } else {
    return collator.compare(a.metaRoadmap.name, b.metaRoadmap.name);
  }
}

/**
 * Sorts roadmaps alphabetically by name, A-Z
 */
export function roadmapSorterAZ(a: {} & { metaRoadmap: MetaRoadmap }, b: {} & { metaRoadmap: MetaRoadmap }) {
  return collator.compare(a.metaRoadmap.name, b.metaRoadmap.name);
}

/**
 * Sorts roadmaps by their number of goals (more goals first), with name as a tiebreaker
 */
export function roadmapSorterGoalAmount(a: { _count: { goals: number } } & { metaRoadmap: MetaRoadmap }, b: { _count: { goals: number } } & { metaRoadmap: MetaRoadmap }) {
  if (a._count.goals > b._count.goals) {
    return -1;
  } else if (a._count.goals < b._count.goals) {
    return 1;
  } else {
    return collator.compare(a.metaRoadmap.name, b.metaRoadmap.name)
  }
}

/**
 * Sorts goals alphabetically, with those with a set name placed before those with inferred names.
 * If no name is provided, the indicator parameter is used instead.
 */
export function goalSorter(a: Goal, b: Goal) {
  if (a.name && !b.name) {
    return -1;
  } else if (b.name && !a.name) {
    return 1;
  } else {
    return collator.compare(a.name || a.indicatorParameter, b.name || b.indicatorParameter);
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
    return -collator.compare(a.name || a.indicatorParameter, b.name || b.indicatorParameter);
  }
}

/**
 * Sorts goals by their number of actions (most actions first).
 */
export function goalSorterActionAmount(a: Goal & { _count: { effects: number } }, b: Goal & { _count: { effects: number } }) {
  if (a._count.effects > b._count.effects) {
    return -1;
  } else if (a._count.effects < b._count.effects) {
    return 1;
  } else {
    return 0
  }
}

/**
 * Sorts goals by their number of actions (fewest actions first).
 */
export function goalSorterActionAmountReverse(a: Goal & { _count: { effects: number } }, b: Goal & { _count: { effects: number } }) {
  if (a._count.effects < b._count.effects) {
    return -1;
  } else if (a._count.effects > b._count.effects) {
    return 1;
  } else {
    return 0
  }
}

/**
 * Sorts goals by how "interesting" their data series are
 */
export function goalSorterInterest(a: Goal & { dataSeries: DataSeries | null }, b: Goal & { dataSeries: DataSeries | null }) {
  if (a.dataSeries == null && b.dataSeries == null) {
    return 0;
  } else if (a.dataSeries != null && b.dataSeries == null) {
    return -1;
  } else if (a.dataSeries == null && b.dataSeries != null) {
    return 1;
  } else {
    // Higher interest gets sorted first
    return (dataSeriesInterest(b.dataSeries!) - dataSeriesInterest(a.dataSeries!))
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
export function effectSorter(a: { action: { name: string } }, b: { action: { name: string } }) {
  return collator.compare(a.action.name, b.action.name);
}

/**
 * Sorts actions by start year, then by end year, then by name
 */
export function actionGraphSorter(a: { x: string, y: number[] }, b: { x: string, y: number[] }) {
  // Start year
  if ((a.y[0] || 0) < (b.y[0] || 0)) {
    return -1;
  } else if ((a.y[0] || 0) > (b.y[0] || 0)) {
    return 1;
  } else {
    // End year
    if ((a.y[1] || 0) < (b.y[1] || 0)) {
      return -1;
    } else if ((a.y[1] || 0) > (b.y[1] || 0)) {
      return 1;
    } else {
      // Name
      return collator.compare(a.x, b.x);
    }
  }
}

/**
 * Sorts effects by action start year, then by action end year, then by action name
 */
export function effectGraphSorter(a: { action: { name: string, startYear: number, endYear: number } }, b: { action: { name: string, startYear: number, endYear: number } }) {
  // Start year
  if (a.action.startYear < b.action.startYear) {
    return -1;
  } else if (a.action.startYear > b.action.startYear) {
    return 1;
  } else {
    // End year
    if (a.action.endYear < b.action.endYear) {
      return -1;
    } else if (a.action.endYear > b.action.endYear) {
      return 1;
    } else {
      // Name
      return collator.compare(a.action.name, b.action.name);
    }
  }
}

/**
 * Sorts comments by time created, newest first.
 * Since unstable_cache returns stringified dates we need to convert them to Date objects first.
 */
export function commentSorter(a: Comment, b: Comment) {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

/**
 * Sorts areas alphabetically by name, but putting the national area (code: "00") first
 */
export function areaSorter(a: [name: string, code: string], b: [name: string, code: string]) {
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
