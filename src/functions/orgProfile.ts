// No `server-only` marker: pure, shared by the org API and the management form, and unit tested.
import { focusPeriodMaxLength, ProcessStep } from "@/functions/orgProcess";
import { OrgType } from "@/lib/prisma/generated";

/** Longest description accepted, in characters: a few sentences, not a page */
export const orgDescriptionMaxLength = 1000;
/** The contact and website columns are VARCHAR(191) */
export const orgContactMaxLength = 191;

/** The org's public profile as its managers write it; null clears a field */
export type OrgProfileFields = {
  description: string | null,
  orgType: OrgType | null,
  contactEmail: string | null,
  website: string | null,
  /** The step of the process the org works on now; null leaves it to be derived (see `orgProcess`) */
  focusStep: ProcessStep | null,
  /** When that is, in the managers' own words */
  focusPeriod: string | null,
};

export const OrgProfileRejection = {
  Description: "DESCRIPTION",
  OrgType: "ORG_TYPE",
  ContactEmail: "CONTACT_EMAIL",
  Website: "WEBSITE",
  FocusStep: "FOCUS_STEP",
  FocusPeriod: "FOCUS_PERIOD",
} as const;
export type OrgProfileRejection = (typeof OrgProfileRejection)[keyof typeof OrgProfileRejection];

/** One address, no spaces, something on both sides of one @ and a dot in the domain; deliverability is the manager's business */
const emailPattern = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

/** Trimmed text, or null when nothing is left; undefined for anything that isn't a string or null */
function text(raw: unknown): string | null | undefined {
  if (raw === null) return null;
  if (typeof raw !== "string") return undefined;
  return raw.trim() || null;
}

/**
 * The website as stored: an absolute http(s) URL. A bare "boden.se" is taken as https.
 * Null for anything else (other schemes, credentials in the URL, no dot in the host).
 */
export function normalizeOrgWebsite(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || /\s/.test(trimmed)) return null;
  // A scheme of any kind is kept for the check below to refuse; only a bare host gets https
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(candidate);
  }
  catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password || !url.hostname.includes(".")) return null;
  return url.href.length <= orgContactMaxLength ? url.href : null;
}

/** A website without its scheme and trailing slash, as the link text: `https://boden.se/` → `boden.se` */
export function orgWebsiteLabel(website: string): string {
  return website.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

/**
 * Validates the profile fields present in a request body (`description`, `orgType`,
 * `contactEmail`, `website`, `focusStep`, `focusPeriod`). Absent fields are left out of the result (left alone);
 * null and blank strings clear. The first field that doesn't hold is named instead.
 */
export function parseOrgProfile(body: Record<string, unknown>): { ok: true, fields: Partial<OrgProfileFields> } | { ok: false, rejection: OrgProfileRejection } {
  const fields: Partial<OrgProfileFields> = {};

  if (body.description !== undefined) {
    const description = text(body.description);
    // Control characters other than line breaks have no place in a paragraph of text
    if (description === undefined || (description && (description.length > orgDescriptionMaxLength || /[^\P{Cc}\n\r\t]/u.test(description)))) {
      return { ok: false, rejection: OrgProfileRejection.Description };
    }
    fields.description = description;
  }

  if (body.orgType !== undefined) {
    const orgType = text(body.orgType);
    const known = Object.values(OrgType).find(type => type === orgType);
    if (orgType === undefined || (orgType && !known)) {
      return { ok: false, rejection: OrgProfileRejection.OrgType };
    }
    fields.orgType = known ?? null;
  }

  if (body.contactEmail !== undefined) {
    const contactEmail = text(body.contactEmail);
    if (contactEmail === undefined || (contactEmail && (contactEmail.length > orgContactMaxLength || !emailPattern.test(contactEmail)))) {
      return { ok: false, rejection: OrgProfileRejection.ContactEmail };
    }
    fields.contactEmail = contactEmail;
  }

  if (body.website !== undefined) {
    const website = text(body.website);
    const normalized = website ? normalizeOrgWebsite(website) : null;
    if (website === undefined || (website && !normalized)) {
      return { ok: false, rejection: OrgProfileRejection.Website };
    }
    fields.website = normalized;
  }

  if (body.focusStep !== undefined) {
    const focusStep = text(body.focusStep);
    const known = Object.values(ProcessStep).find(step => step === focusStep);
    if (focusStep === undefined || (focusStep && !known)) {
      return { ok: false, rejection: OrgProfileRejection.FocusStep };
    }
    fields.focusStep = known ?? null;
  }

  if (body.focusPeriod !== undefined) {
    const focusPeriod = text(body.focusPeriod);
    // One short line: no control characters at all, line breaks included
    if (focusPeriod === undefined || (focusPeriod && (focusPeriod.length > focusPeriodMaxLength || /\p{Cc}/u.test(focusPeriod)))) {
      return { ok: false, rejection: OrgProfileRejection.FocusPeriod };
    }
    fields.focusPeriod = focusPeriod;
  }

  return { ok: true, fields };
}
