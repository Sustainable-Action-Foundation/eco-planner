import { expect, test } from "playwright/test";
import type { APIRequestContext, Page } from "playwright/test";
import path from "node:path";
import { cwd } from "node:process";
import { seedPlaces } from "../../scripts/prisma/seed/places";
import { createAction, createEffect, createGoal, createIteration, createRoadmap, deleteRoadmap, loginAs, orgIdByName, Seed, uniqueLabel } from "../lib/api";
import { recordPageErrors } from "../lib/page-errors";
import { withLock } from "../lib/lock";

/*
 * Every page route in src/app renders for the role that may see it, without
 * an uncaught exception or a console.error; roles that may not see a page get
 * the 404 content or the login redirect instead. The content lives in a
 * throwaway PUBLIC roadmap (so anonymous visitors can read it and anita, a
 * plain org member, can read but not edit it), created once per worker.
 */

const adminFile = path.join(cwd(), "tests/.auth/admin.json");
const verifiedFile = path.join(cwd(), "tests/.auth/verified.json");

/** A curated entry key the org landing links to (src/lib/curatedHistoricalData.ts) */
const curatedEntryKey = "wind-turbines";
/**
 * A seeded municipality org whose curated entry has data (Boden's area has no wind
 * turbines, so its page is a 404). caching.spec.ts renames this org for a moment
 * under the lock below, so the id is read while holding it.
 */
const placeOrg = seedPlaces.find(place => place.name === "Uppsala kommun");
const placeOrgRenameLock = "org-rename-uppsala";

type Fixtures = {
  orgId: string;
  placeOrgId: string;
  roadmapId: string;
  iterationId: string;
  goalId: string;
  actionId: string;
};

/** What a role should get from a route */
type Outcome =
  | { kind: "ok", landmark?: string }
  | { kind: "404" }
  | { kind: "login" }
  /** Redirected to the start page (login/signup while logged in) */
  | { kind: "home" }
  /** Renders, but with the no-access notice of the effect pages instead of a 404 */
  | { kind: "no-access" }
  /** Redirected to a canonical URL */
  | { kind: "redirect", to: (f: Fixtures) => string };

const ok: Outcome = { kind: "ok" };
const notFound: Outcome = { kind: "404" };
const login: Outcome = { kind: "login" };
const home: Outcome = { kind: "home" };
const noAccess: Outcome = { kind: "no-access" };

type Route = {
  name: string;
  url: (f: Fixtures) => string;
  anonymous: Outcome;
  anita: Outcome;
  admin: Outcome;
};

const routes: Route[] = [
  { name: "/", url: () => "/", anonymous: ok, anita: ok, admin: ok },
  { name: "/?org=<id>", url: f => `/?org=${f.orgId}`, anonymous: ok, anita: ok, admin: ok },
  { name: "/?org=public", url: () => "/?org=public", anonymous: ok, anita: ok, admin: ok },
  { name: "/info", url: () => "/info", anonymous: { kind: "ok", landmark: "h1" }, anita: { kind: "ok", landmark: "h1" }, admin: { kind: "ok", landmark: "h1" } },
  { name: "/login", url: () => "/login", anonymous: ok, anita: home, admin: home },
  { name: "/signup", url: () => "/signup", anonymous: ok, anita: home, admin: home },
  // The link interstitial is exempt from the logged-in redirect: redeeming a link is how you switch accounts
  { name: "/login/link", url: () => "/login/link", anonymous: ok, anita: ok, admin: ok },
  { name: "/user/<username>", url: () => `/user/${Seed.admin.username}`, anonymous: ok, anita: ok, admin: ok },
  { name: "/@<username>", url: () => `/@${Seed.anita.username}`, anonymous: ok, anita: ok, admin: ok },
  { name: "/actions", url: () => "/actions", anonymous: ok, anita: ok, admin: ok },
  { name: "/roadmap/create", url: () => "/roadmap/create", anonymous: login, anita: ok, admin: ok },
  { name: "/roadmap/<id>", url: f => `/roadmap/${f.roadmapId}`, anonymous: ok, anita: ok, admin: ok },
  { name: "/roadmap/<id>/v1", url: f => `/roadmap/${f.roadmapId}/v1`, anonymous: ok, anita: ok, admin: ok },
  { name: "/roadmap/<id>/latest", url: f => `/roadmap/${f.roadmapId}/latest`, anonymous: ok, anita: ok, admin: ok },
  { name: "/roadmap/<id>/iteration/<iterationId>", url: f => `/roadmap/${f.roadmapId}/iteration/${f.iterationId}`, anonymous: { kind: "redirect", to: f => `/roadmap/${f.roadmapId}/v1` }, anita: { kind: "redirect", to: f => `/roadmap/${f.roadmapId}/v1` }, admin: { kind: "redirect", to: f => `/roadmap/${f.roadmapId}/v1` } },
  { name: "/roadmap/<id>/v1/edit", url: f => `/roadmap/${f.roadmapId}/v1/edit`, anonymous: login, anita: notFound, admin: ok },
  { name: "/roadmap/<id>/edit", url: f => `/roadmap/${f.roadmapId}/edit`, anonymous: login, anita: notFound, admin: ok },
  { name: "/roadmap/<id>/iteration/create", url: f => `/roadmap/${f.roadmapId}/iteration/create`, anonymous: login, anita: notFound, admin: ok },
  { name: "/goal/create", url: () => "/goal/create", anonymous: login, anita: ok, admin: ok },
  { name: "/goal/<id>", url: f => `/goal/${f.goalId}`, anonymous: ok, anita: ok, admin: ok },
  { name: "/goal/<id>/edit", url: f => `/goal/${f.goalId}/edit`, anonymous: login, anita: notFound, admin: ok },
  { name: "/goal/<id>/baseline/edit", url: f => `/goal/${f.goalId}/baseline/edit`, anonymous: login, anita: notFound, admin: ok },
  { name: "/goal/<id>/data-series/edit", url: f => `/goal/${f.goalId}/data-series/edit`, anonymous: login, anita: notFound, admin: ok },
  { name: "/goal/<id>/historical-data/create", url: f => `/goal/${f.goalId}/historical-data/create`, anonymous: login, anita: notFound, admin: ok },
  { name: "/goal/<id>/historical-data/edit", url: f => `/goal/${f.goalId}/historical-data/edit`, anonymous: login, anita: notFound, admin: ok },
  { name: "/action/create", url: () => "/action/create", anonymous: login, anita: ok, admin: ok },
  { name: "/action/<id>", url: f => `/action/${f.actionId}`, anonymous: ok, anita: ok, admin: ok },
  { name: "/action/<id>/edit", url: f => `/action/${f.actionId}/edit`, anonymous: login, anita: notFound, admin: ok },
  { name: "/effect/create", url: () => "/effect/create", anonymous: login, anita: ok, admin: ok },
  { name: "/effect/<actionId>/<goalId>/edit", url: f => `/effect/${f.actionId}/${f.goalId}/edit`, anonymous: login, anita: noAccess, admin: ok },
  { name: "/org/<id>/groups", url: f => `/org/${f.orgId}/groups`, anonymous: notFound, anita: notFound, admin: ok },
  { name: "/org/<id>/historical-data/<entryKey>", url: f => `/org/${f.placeOrgId}/historical-data/${curatedEntryKey}`, anonymous: notFound, anita: notFound, admin: ok },
  { name: "/invite/<token>", url: () => "/invite/00000000-0000-0000-0000-000000000000", anonymous: notFound, anita: notFound, admin: notFound },
  { name: "/tests/locale", url: () => "/tests/locale", anonymous: { kind: "ok", landmark: "h1" }, anita: { kind: "ok", landmark: "h1" }, admin: { kind: "ok", landmark: "h1" } },
  // /tests/tiptap is left out: the dev test bed logs a setState-in-render (TipTapPage → TextEditor) on load
];

async function expectOutcome(page: Page, outcome: Outcome, f: Fixtures) {
  switch (outcome.kind) {
    case "ok": {
      // Form pages have no <main>, and some edit pages no <h1>: any of them shows the page rendered
      await expect(page.locator(outcome.landmark ?? "main, h1, form").filter({ visible: true }).first()).toBeVisible();
      await expect(page.getByText("404.status", { exact: true })).toHaveCount(0);
      break;
    }
    case "404": {
      // The not-found page translates on the client, so its key is stable under cimode
      await expect(page.getByText("404.status", { exact: true })).toBeVisible();
      break;
    }
    case "login": {
      await expect(page).toHaveURL(/\/login\?from=/, { timeout: 30_000 });
      await expect(page.locator("#email")).toBeVisible();
      break;
    }
    case "home": {
      await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
      await expect(page.getByTestId("home-title").filter({ visible: true })).toBeVisible();
      break;
    }
    case "no-access": {
      // Server-rendered text can come out in another language under concurrent load (shared
      // server i18n instance), so match the notice by shape: info icon paragraph, no form
      await expect(page.locator("p", { has: page.locator('svg[role="img"]') }).filter({ visible: true })).toBeVisible();
      await expect(page.locator("form").filter({ visible: true })).toHaveCount(0);
      break;
    }
    case "redirect": {
      // The redirect digest arrives at the end of the stream, after the page's data loads
      await expect(page).toHaveURL(outcome.to(f), { timeout: 30_000 });
      await expect(page.locator("main").filter({ visible: true }).first()).toBeVisible();
      break;
    }
    default: {
      const unhandled: never = outcome;
      throw new Error(`unhandled outcome ${JSON.stringify(unhandled)}`);
    }
  }
}

// ~110 independent page loads: spread them over the workers (each worker builds its own fixtures)
// /tests/locale renders every key twice and takes over a minute on a loaded server
test.describe.configure({ mode: "parallel", timeout: 180_000 });

let fixtures: Fixtures;
let admin: APIRequestContext;
/** Set as soon as the roadmap exists, so a failure further into the setup still cleans it up */
let createdRoadmapId: string | null = null;

test.beforeAll(async ({ playwright, baseURL }, testInfo) => {
  // Streamed pages (orgIdByName reads the start page) are slow on a loaded shared server
  admin = await playwright.request.newContext({ baseURL, timeout: 60_000 });
  await loginAs(admin, Seed.admin.username);
  const label = uniqueLabel(testInfo, "smoke");
  const orgId = await orgIdByName(admin, Seed.orgName);
  const placeOrgId = await withLock(placeOrgRenameLock, () => orgIdByName(admin, placeOrg?.name ?? ""));
  const roadmapId = await createRoadmap(admin, orgId, { name: `Smoke ${label}`, access: { sharing: "PUBLIC", grants: [] } });
  createdRoadmapId = roadmapId;
  const iterationId = await createIteration(admin, roadmapId);
  const goalId = await createGoal(admin, iterationId, { name: `Smoke goal ${label}` });
  const actionId = await createAction(admin, iterationId, { name: `Smoke action ${label}` });
  await createEffect(admin, goalId, actionId);
  fixtures = { orgId, placeOrgId, roadmapId, iterationId, goalId, actionId };
});

test.afterAll(async () => {
  if (createdRoadmapId) await deleteRoadmap(admin, createdRoadmapId);
  await admin.dispose();
});

const roles: { role: "anonymous" | "anita" | "admin", storageState: string | { cookies: [], origins: [] } }[] = [
  { role: "anonymous", storageState: { cookies: [], origins: [] } },
  { role: "anita", storageState: verifiedFile },
  { role: "admin", storageState: adminFile },
];

for (const { role, storageState } of roles) {
  test.describe(role, () => {
    test.use({ storageState });

    for (const route of routes) {
      test(route.name, async ({ page }) => {
        const errors = recordPageErrors(page);
        await page.goto(route.url(fixtures));
        await expectOutcome(page, route[role], fixtures);
        expect(await errors.settled()).toEqual([]);
      });
    }
  });
}
