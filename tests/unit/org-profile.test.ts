import { expect, test } from "playwright/test";

import { normalizeOrgWebsite, orgDescriptionMaxLength, OrgProfileRejection, orgWebsiteLabel, parseOrgProfile } from "../../src/functions/orgProfile";
import { focusPeriodMaxLength, ProcessStep } from "../../src/functions/orgProcess";
import { OrgType } from "../../src/lib/prisma/generated";

/*
 * The org's public profile is written by its managers and shown to everyone,
 * so what the API accepts is pinned here: text only, a real-looking address,
 * and a website that can only be an http(s) link.
 */

test.describe("normalizeOrgWebsite", () => {
  test("keeps http and https URLs, and takes a bare host as https", () => {
    expect(normalizeOrgWebsite("https://boden.se")).toBe("https://boden.se/");
    expect(normalizeOrgWebsite("http://boden.se/klimat?a=1")).toBe("http://boden.se/klimat?a=1");
    expect(normalizeOrgWebsite("  boden.se ")).toBe("https://boden.se/");
    expect(normalizeOrgWebsite("www.boden.se/miljö")).toBe("https://www.boden.se/milj%C3%B6");
  });

  test("refuses other schemes, credentials, hosts without a dot and junk", () => {
    for (const raw of ["javascript:alert(1)", "JAVASCRIPT:alert(1)", "data:text/html,<p>", "ftp://boden.se", "mailto:a@boden.se", "https://user:pw@boden.se", "https://localhost", "boden", "", "   ", "https://bo den.se", `https://boden.se/${"a".repeat(200)}`]) {
      expect(normalizeOrgWebsite(raw), raw).toBeNull();
    }
  });

  test("the link text drops the scheme and a trailing slash", () => {
    expect(orgWebsiteLabel("https://boden.se/")).toBe("boden.se");
    expect(orgWebsiteLabel("http://www.boden.se/klimat")).toBe("www.boden.se/klimat");
  });
});

test.describe("parseOrgProfile", () => {
  test("absent fields are left alone", () => {
    expect(parseOrgProfile({})).toEqual({ ok: true, fields: {} });
    expect(parseOrgProfile({ name: "x" })).toEqual({ ok: true, fields: {} });
  });

  test("valid fields are trimmed and normalized", () => {
    expect(parseOrgProfile({
      description: "  Vi vill bli fossilfria.\nSå här jobbar vi. ",
      orgType: OrgType.MUNICIPAL_COMPANY,
      contactEmail: " klimat@boden.se ",
      website: "boden.se",
    })).toEqual({
      ok: true,
      fields: {
        description: "Vi vill bli fossilfria.\nSå här jobbar vi.",
        orgType: OrgType.MUNICIPAL_COMPANY,
        contactEmail: "klimat@boden.se",
        website: "https://boden.se/",
      },
    });
  });

  test("null and blank clear a field", () => {
    expect(parseOrgProfile({ description: null, orgType: "", contactEmail: "  ", website: null }))
      .toEqual({ ok: true, fields: { description: null, orgType: null, contactEmail: null, website: null } });
  });

  test("a description that is too long, not text, or holds control characters is refused", () => {
    expect(parseOrgProfile({ description: "a".repeat(orgDescriptionMaxLength) }).ok).toBe(true);
    for (const description of ["a".repeat(orgDescriptionMaxLength + 1), 5, ["x"], "bell\u0007"]) {
      expect(parseOrgProfile({ description })).toEqual({ ok: false, rejection: OrgProfileRejection.Description });
    }
  });

  test("an unknown org type is refused", () => {
    for (const orgType of ["KOMMUN", "municipal_company", 3, {}]) {
      expect(parseOrgProfile({ orgType })).toEqual({ ok: false, rejection: OrgProfileRejection.OrgType });
    }
    for (const orgType of Object.values(OrgType)) {
      expect(parseOrgProfile({ orgType })).toEqual({ ok: true, fields: { orgType } });
    }
  });

  test("a contact that isn't one e-mail address is refused", () => {
    for (const contactEmail of ["klimat", "klimat@boden", "a@b.se, c@d.se", "a b@boden.se", "<a@boden.se>", "@boden.se", 7, `${"a".repeat(190)}@boden.se`]) {
      expect(parseOrgProfile({ contactEmail }), String(contactEmail)).toEqual({ ok: false, rejection: OrgProfileRejection.ContactEmail });
    }
  });

  test("a website that isn't an http(s) link is refused", () => {
    for (const website of ["javascript:alert(1)", "ftp://boden.se", "boden", 1]) {
      expect(parseOrgProfile({ website })).toEqual({ ok: false, rejection: OrgProfileRejection.Website });
    }
  });

  test("the focus: one of the five steps and a short one-line period; null and blank clear both", () => {
    for (const focusStep of Object.values(ProcessStep)) {
      expect(parseOrgProfile({ focusStep })).toEqual({ ok: true, fields: { focusStep } });
    }
    expect(parseOrgProfile({ focusStep: ProcessStep.Baseline, focusPeriod: "  hösten 2026 " }))
      .toEqual({ ok: true, fields: { focusStep: ProcessStep.Baseline, focusPeriod: "hösten 2026" } });
    expect(parseOrgProfile({ focusStep: null, focusPeriod: "  " })).toEqual({ ok: true, fields: { focusStep: null, focusPeriod: null } });
    expect(parseOrgProfile({ focusStep: "", focusPeriod: null })).toEqual({ ok: true, fields: { focusStep: null, focusPeriod: null } });
    expect(parseOrgProfile({ focusPeriod: "a".repeat(focusPeriodMaxLength) }).ok).toBe(true);
  });

  test("an unknown step, or a period that is too long, not text or more than a line, is refused", () => {
    for (const focusStep of ["DONE", "baseline", "Baslinje", 3, {}]) {
      expect(parseOrgProfile({ focusStep })).toEqual({ ok: false, rejection: OrgProfileRejection.FocusStep });
    }
    for (const focusPeriod of ["a".repeat(focusPeriodMaxLength + 1), 2026, ["hösten"], "hösten\n2026", "bell\u0007"]) {
      expect(parseOrgProfile({ focusPeriod }), String(focusPeriod)).toEqual({ ok: false, rejection: OrgProfileRejection.FocusPeriod });
    }
  });
});
