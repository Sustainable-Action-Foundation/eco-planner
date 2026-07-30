import { Locales } from "@root/i18n.config";
import type { TFunction } from "i18next";

/**
 * Canonical keys used as `ActionFields.header` values.
 *
 * Actions no longer have fixed description/cost efficiency/... columns; migration
 * 20260720131447 folded them into ActionFields rows (and the org-rework migration
 * canonicalizes those headers to these UPPER_SNAKE keys). The action form seeds
 * new actions with them. The UI translates known keys for display and renders
 * unknown (user-invented) headers verbatim.
 */
export const ActionFieldHeaders = {
  Description: "DESCRIPTION",
  CostEfficiency: "COST_EFFICIENCY",
  ExpectedOutcome: "EXPECTED_OUTCOME",
  // Not seeded by the form: old project manager data was deliberately dropped in the migration
  ProjectManager: "PROJECT_MANAGER",
  RelevantActors: "RELEVANT_ACTORS",
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
    [ActionFieldHeaders.CostEfficiency]: t("forms:action.cost_efficiency", keyOnly),
    [ActionFieldHeaders.ExpectedOutcome]: t("forms:action.expected_outcome", keyOnly),
    [ActionFieldHeaders.ProjectManager]: t("forms:action.project_manager", keyOnly),
    [ActionFieldHeaders.RelevantActors]: t("forms:action.relevant_actors", keyOnly),
    [ActionFieldHeaders.Tag]: t("forms:action.tag", keyOnly),
  };
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
 * Display label for a field header: known canonical keys get their i18n label,
 * anything else (user-invented headers) renders verbatim.
 * The calling component must have the `forms` namespace loaded.
 */
export function actionFieldLabel(header: string, t: TFunction): string {
  const key = headerLabelKeys(t)[header];
  return key ? t(key) : header;
}
