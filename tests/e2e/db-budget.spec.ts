import { expect, test } from "playwright/test";
import type { APIRequestContext, Page } from "playwright/test";
import path from "node:path";
import { cwd } from "node:process";
import { orgLandingHref } from "../lib/org-switcher";

/*
 * Query-budget canary: counts the Prisma statements one warm page load costs (via the
 * test-only /api/test/db-stats counters) and fails when a page grows past its budget,
 * catching N+1s and duplicated lookups that timing-based waits never notice.
 *
 * The counters are process-global, so this runs alone in the `db-budget` project after
 * every browser project (see playwright.e2e.config.ts). The minimum of a few repeats is
 * taken to shrug off stragglers (e.g. link prefetches in production builds).
 */

/**
 * Max Prisma statements per warm page load (admin, fat seed). Measured 2026-10-12 against
 * `next dev`; budget = measured + ~25% slack, rounded up.
 * Warm loads are only the access-context lookup (3 statements, once per request since it is
 * memoized with React `cache()`): every DB fetcher is served from its 'use cache' entry. Any
 * growth here is an uncached query or a lookup that lost its request memoization.
 * History: before the request memoization (db-slim workstream A) these were 24 / 24 / 29 / 12.
 */
const QueryBudget = {
  /** `/`, admin's default org landing. Measured: 3 */
  Startpage: 4,
  /** `/?org=<Boden>`. Measured: 3 */
  OrgLanding: 4,
  /** First (unlisted, LEAP-copied) goal in table view of Bodens klimatfärdplan. Measured: 3 */
  GoalPage: 4,
  /** Bodens klimatfärdplan, latest iteration. Measured: 3 */
  RoadmapIteration: 4,
} as const;

const REPEATS = 3;
const adminFile = path.join(cwd(), "tests/.auth/admin.json");
// Substring match: "Bodens kommun" in the seed roster, "Boden" on older seeded DBs
const orgName = "Boden";
const roadmapName = "Bodens klimatfärdplan";

type DbStats = { queries: number; dbMs: number };
type Measurement = { queries: number; dbMs: number; wallMs: number };

async function dbStats(request: APIRequestContext): Promise<DbStats | null> {
  const response = await request.get("/api/test/db-stats");
  if (response.status() === 404) return null;
  expect(response.ok()).toBe(true);
  return await response.json() as DbStats;
}

/** One full page load: document (incl. streamed Suspense sections), then client fetches, then no loaders left */
async function load(page: Page, url: string) {
  await page.goto(url, { waitUntil: "load", timeout: 60_000 });
  await page.waitForLoadState("networkidle", { timeout: 60_000 });
  await expect(page.locator('main img[src*="3-dots-move"]')).toHaveCount(0, { timeout: 30_000 });
}

/** Warms the page once, then returns the cheapest of REPEATS measured loads */
async function measure(page: Page, url: string): Promise<Measurement> {
  await load(page, url);

  const runs: Measurement[] = [];
  for (let i = 0; i < REPEATS; i++) {
    const before = await dbStats(page.request);
    const start = Date.now();
    await load(page, url);
    const wallMs = Date.now() - start;
    const after = await dbStats(page.request);
    if (!before || !after) throw new Error("db-stats route disappeared mid-run");
    runs.push({ queries: after.queries - before.queries, dbMs: Math.round(after.dbMs - before.dbMs), wallMs });
  }
  return runs.reduce((min, run) => run.queries < min.queries ? run : min);
}

async function check(page: Page, name: string, url: string, budget: number) {
  const result = await measure(page, url);
  console.info(`[db-budget] ${name}: ${result.queries} queries (budget ${budget}), ${result.dbMs} ms db, ${result.wallMs} ms wall — ${url}`);
  test.info().annotations.push({ type: "db-budget", description: `${name}: ${result.queries}/${budget} queries, ${result.dbMs} ms db, ${result.wallMs} ms wall` });
  expect(result.queries, `${name} (${url}) ran ${result.queries} queries, budget ${budget}`).toBeLessThanOrEqual(budget);
}

test.describe("DB query budget", () => {
  test.use({ storageState: adminFile });

  const urls = { orgLanding: "", roadmap: "", goal: "" };

  test.beforeAll("Discover pages", async ({ browser }) => {
    test.setTimeout(180_000);
    const context = await browser.newContext({ storageState: adminFile });
    const page = await context.newPage();

    await page.goto("/");
    urls.orgLanding = await orgLandingHref(page, orgName);

    await page.goto(urls.orgLanding);
    const roadmapHref = await page.locator('main a[href^="/roadmap/"]').filter({ hasText: roadmapName }).first().getAttribute("href");
    expect(roadmapHref).toBeTruthy();
    urls.roadmap = roadmapHref ?? "";

    await page.goto(urls.roadmap);
    // Boden's goals are LEAP copies, all unlisted; admin (who can edit) gets them in a separate tab
    await page.getByTestId("unlisted-goals-tab").click({ timeout: 30_000 });
    await page.locator('input[name="table"][value="TABLE"]').first().check();
    await expect(page.locator("#goalTable")).toBeVisible({ timeout: 30_000 });
    const goalHref = await page.locator('#goalTable a[href^="/goal/"]').first().getAttribute("href");
    expect(goalHref).toBeTruthy();
    urls.goal = goalHref ?? "";

    await context.close();
  });

  test.beforeEach(async ({ page }) => {
    test.setTimeout(240_000);
    test.skip(await dbStats(page.request) === null, "/api/test/db-stats is disabled (production build without TEST_ENVIRONMENT=testing)");
    // No page.route() here: request interception makes Chromium send `Cache-Control: no-cache`,
    // which makes `next dev` bypass every 'use cache' entry (a cold render, ~3x the queries)
  });

  test("Startpage", async ({ page }) => {
    await check(page, "Startpage", "/", QueryBudget.Startpage);
  });

  test("Org landing", async ({ page }) => {
    await check(page, "Org landing", urls.orgLanding, QueryBudget.OrgLanding);
  });

  test("Goal page", async ({ page }) => {
    await check(page, "Goal page", urls.goal, QueryBudget.GoalPage);
  });

  test("Roadmap iteration", async ({ page }) => {
    await check(page, "Roadmap iteration", urls.roadmap, QueryBudget.RoadmapIteration);
  });
});
