import type { TFunction } from "i18next";
import { RoadmapType } from "@/lib/prisma/generated";

/**
 * What a goal is called in listings: its name, or the last segment of its
 * LEAP indicator parameter when it has none (imported scenarios name nothing).
 */
export function goalDisplayName(goal: { name: string | null, indicator_parameter: string }): string {
  return goal.name || indicatorParameterLeaf(goal.indicator_parameter);
}

/**
 * The display name suffixed with the goal's level, so national goals and their
 * local copies are told apart: "Antal bilar | nationell nivå" on a national
 * roadmap, "Antal bilar | Boden" on one tied to a geo area. Roadmaps with
 * neither get the bare display name. Display-only — never store it.
 */
export function goalTitleWithLevel(
  t: TFunction,
  goal: { name: string | null, indicator_parameter: string },
  roadmap: { type: RoadmapType, geo_area: { name: string } | null },
): string {
  const name = goalDisplayName(goal);
  if (roadmap.type === RoadmapType.NATIONAL) {
    return t("common:goal_title.national_level", { name });
  }
  if (roadmap.geo_area?.name) {
    return t("common:goal_title.area_level", { name, area: roadmap.geo_area.name });
  }
  return name;
}

/**
 * The name to store: trimmed, and null when blank so an unnamed goal keeps
 * falling back to its indicator parameter (an empty string would render as
 * nothing). `undefined` stays `undefined`, leaving the stored name alone.
 */
export function normalizeGoalName(name: string | null | undefined): string | null | undefined {
  if (name === undefined) return undefined;
  const trimmed = name?.trim() ?? "";
  return trimmed || null;
}

/** `Key\Landtransporter\Personbilar\Elbilar\Antal bilar` → `Antal bilar` */
export function indicatorParameterLeaf(indicatorParameter: string): string {
  return indicatorParameter.split("\\").filter(Boolean).at(-1) ?? indicatorParameter;
}

/** The segments above the leaf, for context: `Landtransporter › Personbilar › Elbilar` (the leading "Key" is dropped). */
export function indicatorParameterContext(indicatorParameter: string): string {
  const segments = indicatorParameter.split("\\").filter(Boolean).slice(0, -1);
  if (segments[0] === "Key") segments.shift();
  return segments.join(" › ");
}
