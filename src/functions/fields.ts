import { Locales } from "@root/i18n.config";
import { ActionFieldType } from "@/lib/prisma/generated";
import type { TFunction } from "i18next";

/**
 * Canonical keys used as `ActionFields.header` values.
 *
 * Actions no longer have fixed description/cost efficiency/... columns; migration
 * 20260720131447 folded them into ActionFields rows (and the org-rework migration
 * canonicalizes those headers to UPPER_SNAKE keys). Only the headers with
 * special-case handling remain canonical: DESCRIPTION (dedicated textarea,
 * og:description) and TAG (chips). The other migrated headers (COST_EFFICIENCY,
 * EXPECTED_OUTCOME, PROJECT_MANAGER, RELEVANT_ACTORS) are ordinary user headers
 * and render verbatim like any other.
 */
export const ActionFieldHeaders = {
  Description: "DESCRIPTION",
  Tag: "TAG",
} as const;
export type ActionFieldHeaders = (typeof ActionFieldHeaders)[keyof typeof ActionFieldHeaders];

/**
 * The i18n keys labeling the canonical headers. The keys are resolved through
 * `t()` forced to the test language (cimode returns the key itself, with its
 * namespace appended), so i18n tooling can statically find them as used.
 */
function headerLabelKeys(t: TFunction): Record<string, string> {
  const keyOnly = { lng: Locales.test, appendNamespaceToCIMode: true } as const;
  return {
    [ActionFieldHeaders.Description]: t("forms:action.action_description", keyOnly),
    [ActionFieldHeaders.Tag]: t("forms:action.tag", keyOnly),
  };
}

/**
 * The semantic type each canonical header's values carry: descriptions are
 * paragraphs, tags are short values. User-invented headers default to
 * {@link ActionFieldType.PARAGRAPH}.
 */
const canonicalHeaderTypes: Record<string, ActionFieldType> = {
  [ActionFieldHeaders.Description]: ActionFieldType.PARAGRAPH,
  [ActionFieldHeaders.Tag]: ActionFieldType.SHORT,
};

/** The type a field with the given header starts out as (the user may override it) */
export function defaultActionFieldType(header: string): ActionFieldType {
  return canonicalHeaderTypes[header] ?? ActionFieldType.PARAGRAPH;
}

/** Coerces an untrusted value (API input) to a valid ActionFieldType, falling back to PARAGRAPH */
export function parseActionFieldType(value: unknown): ActionFieldType {
  return Object.values(ActionFieldType).includes(value as ActionFieldType)
    ? value as ActionFieldType
    : ActionFieldType.PARAGRAPH;
}

/**
 * Groups fields by header, preserving the order headers first appear in.
 * List-ness is structural: a group with several values renders as a list when its
 * type supports it (any type but PARAGRAPH); the group's type is its first field's.
 */
export function groupActionFields(fields: { header: string, value: string, type: ActionFieldType }[]): { header: string, type: ActionFieldType, values: string[] }[] {
  const groups: { header: string, type: ActionFieldType, values: string[] }[] = [];
  for (const field of fields) {
    const group = groups.find(g => g.header === field.header);
    if (group) {
      group.values.push(field.value);
    } else {
      groups.push({ header: field.header, type: field.type, values: [field.value] });
    }
  }
  return groups;
}

/** The first value among the fields with the given canonical header, if any */
export function getActionFieldValue(fields: { header: string, value: string }[] | undefined, header: string): string | undefined {
  return fields?.find(field => field.header === header)?.value;
}

/** An action's description now lives in its `DESCRIPTION`-headed field */
export function getActionDescription(fields: { header: string, value: string }[] | undefined): string | undefined {
  return getActionFieldValue(fields, ActionFieldHeaders.Description);
}

/**
 * Splits pasted text into list items if it looks like a simple CSV: values separated
 * by commas, semicolons, tabs, or newlines (e.g. a pasted spreadsheet column).
 * Items are trimmed, surrounding quotes are stripped, and empties are dropped.
 * A single-item result means the text carried no delimiters and should be treated
 * as a plain paste.
 */
export function parseCsvList(text: string): string[] {
  return text
    .split(/[\n\r\t;,]+/)
    .map(item => item.trim().replace(/^(["'])(.*)\1$/, "$2").trim())
    .filter(item => item !== "");
}

/**
 * Display label for a field header: known canonical keys get their i18n label,
 * anything else (user-invented headers) renders verbatim.
 * The calling component must have the `forms` namespace loaded.
 */
export function actionFieldLabel(header: string, t: TFunction): string {
  const key = headerLabelKeys(t)[header];
  return key ? t(key) : header;
}
