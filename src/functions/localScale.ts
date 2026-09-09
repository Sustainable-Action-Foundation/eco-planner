import type { DateValues, ISOIshDate } from "@/types";

/**
 * Scaling a goal's trajectory to a local series (see `GoalPrefill.localReference`
 * and the "local scale" suggested method): the two are joined at the year of
 * the local series' latest value, so the copy starts from the local level and
 * follows the goal's development from there. Pure functions, shared by the
 * goal prefill (which stores the anchor in the recipe) and the landing page
 * previews (which draw the result).
 */

export type LocalAnchor = {
  /** The year of the local series' latest value */
  year: number;
  /** The local series' latest value */
  localValue: number;
  /** The goal's value that year (or the nearest year it has) */
  goalValue: number;
};

/** Null when either series is empty. */
export function localAnchor(local: DateValues, goal: DateValues): LocalAnchor | null {
  const latest = Object.keys(local).sort().at(-1) as ISOIshDate | undefined;
  const goalYears = Object.entries(goal).map(([date, value]) => ({ year: new Date(date).getUTCFullYear(), value }));
  if (latest === undefined || goalYears.length === 0) return null;

  const year = new Date(latest).getUTCFullYear();
  const nearest = goalYears.reduce((best, candidate) => Math.abs(candidate.year - year) < Math.abs(best.year - year) ? candidate : best);
  return { year, localValue: local[latest], goalValue: nearest.value };
}

/**
 * `local(latest) * goal / goal(year)` over the goal's whole range; what the
 * suggested method evaluates to. Null when there is no anchor or the goal is
 * zero in the anchor year (nothing to scale from).
 */
export function scaleToLocal(goal: DateValues, local: DateValues): DateValues | null {
  const anchor = localAnchor(local, goal);
  if (!anchor || anchor.goalValue === 0) return null;

  const factor = anchor.localValue / anchor.goalValue;
  return Object.fromEntries(Object.entries(goal).map(([date, value]) => [date, value * factor])) as DateValues;
}
