import { expect, test as base } from "playwright/test";
import type { APIRequestContext, Page } from "playwright/test";
import path from "node:path";
import { cwd } from "node:process";
import { orgLandingHref, orgSwitcher } from "../lib/org-switcher";

/*
 * Regression tests for the cacheComponents migration (Next 16.3, `cacheComponents: true`).
 *
 * Client navigation keeps visited routes mounted in a hidden React <Activity>
 * boundary (up to three), so a route revisited via back/forward or a Link re-shows
 * the same component instance with its state intact. Edit forms therefore refresh
 * their stale-guard timestamp on re-show (useFormTimestamp) and the edit pages key
 * the form by `updated_at`; data reads go through "use cache" fetchers whose tags the
 * mutating API routes revalidate. These specs pin that behavior:
 *
 *  - saving an edit form, re-showing it and saving again succeeds (the 409 regression);
 *  - a half-filled create form survives a round trip (Activity preservation is real);
 *  - a tag revalidation reaches another page over plain client navigation;
 *  - the stale-data guard still rejects a form that was never re-shown.
 *
 * See node_modules/next/dist/docs/01-app/02-guides/preserving-ui-state.md.
 */

const adminFile = path.join(cwd(), "tests/.auth/admin.json");

/** The org that owns the fixtures; admin manages it (scripts/prisma/seed/seed-users.ts) */
const orgName = "Sustainable Action";

type Fixtures = {
  label: string,
  roadmapId: string,
  iterationId: string,
  goalId: string,
  goalName: string,
  actionId: string,
  actionName: string,
};

/** Reads the org's id off its landing href in the start page's switcher */
async function orgIdByName(page: Page, name: string): Promise<string> {
  await page.goto("/");
  const href = await orgLandingHref(page, name);
  const orgId = new URL(href, "http://localhost").searchParams.get("org");
  expect(orgId, `org id of ${name}`).toBeTruthy();
  return orgId ?? "";
}

async function postJson(request: APIRequestContext, url: string, data: unknown): Promise<string> {
  const response = await request.post(url, { data });
  expect(response.status(), `${url} -> ${await response.text()}`).toBe(201);
  const body = await response.json() as { id?: string };
  expect(typeof body.id, `${url} response id`).toBe("string");
  return body.id ?? "";
}

/**
 * A throwaway roadmap (unique per browser project, retry and run) with one published
 * iteration holding a manual-series goal and an action, so the edit flows below never
 * touch seeded entities that other specs assert on. Deleting the roadmap cascades.
 */
const test = base.extend<{ fixtures: Fixtures }>({
  fixtures: async ({ page, request }, use, testInfo) => {
    const label = `${testInfo.project.name} ${testInfo.retry} ${Date.now()}`;
    const orgId = await orgIdByName(page, orgName);

    const roadmapId = await postJson(request, "/api/roadmap", {
      name: `Caching roadmap ${label}`,
      description: "",
      type: "OTHER",
      actor: null,
      geoAreaCode: null,
      orgId,
      access: undefined,
      parentRoadmapId: null,
    });
    try {
      const iterationId = await postJson(request, "/api/roadmap-iteration", {
        roadmapId,
        description: null,
        targetVersion: null,
        status: "PUBLISHED",
        goals: null,
      });
      const goalName = `Caching goal ${label}`;
      const goalId = await postJson(request, "/api/goal", {
        target: "FULL",
        iterationId,
        name: goalName,
        description: null,
        indicatorParameter: `Caching\\${label}`,
        listing: undefined,
        rawTags: null,
        dataSeries: {
          unit: "ton",
          dateValues: Object.fromEntries(Array.from({ length: 5 }, (_, i) => [`${2020 + i}-01-01T00:00:00.000Z`, i + 1])),
        },
      });
      const actionName = `Caching action ${label}`;
      const actionId = await postJson(request, "/api/action", {
        actionId: undefined,
        iterationId,
        orgId: undefined,
        goalId: undefined,
        name: actionName,
        indicatorParameter: undefined,
        startYear: null,
        endYear: null,
        fields: [],
        parentActionId: null,
        originActionId: undefined,
        dataSeries: undefined,
        impactType: undefined,
        timestamp: undefined,
      });

      await use({ label, roadmapId, iterationId, goalId, goalName, actionId, actionName });
    }
    finally {
      const deleted = await request.delete("/api/roadmap", { data: { id: roadmapId } });
      expect(deleted.status(), `cleanup of roadmap ${roadmapId}`).toBe(200);
    }
  },
});

/** Records every native dialog (the forms `alert()` API rejections) and dismisses it */
function recordDialogs(page: Page): string[] {
  const messages: string[] = [];
  page.on("dialog", (dialog) => {
    messages.push(dialog.message());
    void dialog.dismiss();
  });
  return messages;
}

/** What the browser did with a submit click, read off the form after the fact (see `submitForm`) */
type SubmitProbe = { submits: number, invalid: string[], valid: boolean, active: string | null };

/**
 * Clicks the visible submit button and resolves with the status of the PUT it triggers.
 *
 * WebKit on a loaded CI runner has swallowed the click of a re-shown form: the
 * button took focus but no submit event followed, no validation bubble, no
 * request (run 36440759048, both attempts). The submit handler waits for the
 * recipe syncs (up to 5s) before fetching, so a request is expected within
 * seconds of a real submit; when none shows up the click is repeated once, and
 * the probe attached to the form says whether the first click submitted at all
 * or constraint validation blocked it.
 */
async function submitForm(page: Page, apiPath: string): Promise<number> {
  const isPut = (url: string, method: string) => new URL(url).pathname === apiPath && method === "PUT";
  const button = page.locator("#submit-button").filter({ visible: true });
  await button.evaluate((element) => {
    const form = element.closest("form");
    if (!form) throw new Error("submit button outside a form");
    const probe = { submits: 0, invalid: [] as string[] };
    form.addEventListener("submit", () => { probe.submits++; }, { capture: true });
    form.addEventListener("invalid", (event) => { probe.invalid.push((event.target as HTMLElement | null)?.outerHTML.slice(0, 120) ?? "?"); }, { capture: true });
    (window as unknown as { __submitProbe: typeof probe }).__submitProbe = probe;
  });
  const readProbe = () => button.evaluate((element): SubmitProbe => {
    const form = element.closest("form");
    const probe = (window as unknown as { __submitProbe?: { submits: number, invalid: string[] } }).__submitProbe ?? { submits: -1, invalid: [] };
    return { ...probe, valid: form?.checkValidity() ?? false, active: document.activeElement?.outerHTML.slice(0, 120) ?? null };
  });

  const response = page.waitForResponse((res) => isPut(res.url(), res.request().method()), { timeout: 30_000 });
  const sent = page.waitForRequest((req) => isPut(req.url(), req.method()), { timeout: 8_000 }).then(() => true, () => false);
  await button.click();
  if (!(await sent)) {
    const probe = await readProbe();
    console.warn(`submit click produced no ${apiPath} request within 8s; retrying once. Probe: ${JSON.stringify(probe)}`);
    // A submit that is merely slow would double-save (and 409) on a second click; only a click that never submitted is repeated
    expect(probe.submits, "the first click submitted after all, not retrying").toBe(0);
    await button.click();
  }
  return (await response).status();
}

/** The goal edit form is ready once its manual series rows have hydrated from the goal */
async function expectGoalFormReady(page: Page) {
  await expect(page.locator("#goalName").filter({ visible: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('#goal-dataseries [data-row="0"][data-column="1"] input').filter({ visible: true })).toHaveValue("2020", { timeout: 30_000 });
}

test.describe("Activity re-show: edit forms save again after a save", () => {
  test.use({ storageState: adminFile });

  test("Goal edit form saves after browser back and after a Link revisit", async ({ page, fixtures }) => {
    const dialogs = recordDialogs(page);
    const goalPage = new RegExp(`/goal/${fixtures.goalId}$`);
    const editPage = new RegExp(`/goal/${fixtures.goalId}/edit$`);

    await page.goto(`/goal/${fixtures.goalId}/edit`);
    await expectGoalFormReady(page);

    // First save, from a freshly mounted form
    const nameV1 = `${fixtures.goalName} v1`;
    await page.locator("#goalName").filter({ visible: true }).fill(nameV1);
    expect(await submitForm(page, "/api/goal")).toBe(200);
    await page.waitForURL(goalPage);
    await expect(page.locator("h1").filter({ hasText: nameV1 }).filter({ visible: true })).toBeVisible({ timeout: 20_000 });

    // Browser back re-shows the preserved form instance (the input still holds what we typed)
    await page.goBack();
    await page.waitForURL(editPage);
    await expectGoalFormReady(page);
    await expect(page.locator("#goalName").filter({ visible: true })).toHaveValue(nameV1);

    // Its stale-guard timestamp must have been refreshed on re-show: the save is accepted
    const nameV2 = `${fixtures.goalName} v2`;
    await page.locator("#goalName").filter({ visible: true }).fill(nameV2);
    expect(await submitForm(page, "/api/goal")).toBe(200);
    await page.waitForURL(goalPage);
    await expect(page.locator("h1").filter({ hasText: nameV2 }).filter({ visible: true })).toBeVisible({ timeout: 20_000 });

    // Revisiting through the admin panel link (a push navigation) must save too
    await page.getByTestId("admin-panel-edit-menu").filter({ visible: true }).click();
    await page.getByTestId("admin-panel-edit").filter({ visible: true }).click();
    await page.waitForURL(editPage);
    await expectGoalFormReady(page);
    await expect(page.locator("#goalName").filter({ visible: true })).toHaveValue(nameV2);

    const nameV3 = `${fixtures.goalName} v3`;
    await page.locator("#goalName").filter({ visible: true }).fill(nameV3);
    expect(await submitForm(page, "/api/goal")).toBe(200);
    await page.waitForURL(goalPage);
    await expect(page.locator("h1").filter({ hasText: nameV3 }).filter({ visible: true })).toBeVisible({ timeout: 20_000 });

    expect(dialogs, "no stale-data alert").toEqual([]);
  });

  test("Action edit form saves after browser back and after a Link revisit", async ({ page, fixtures }) => {
    const dialogs = recordDialogs(page);
    const actionPage = new RegExp(`/action/${fixtures.actionId}$`);
    const editPage = new RegExp(`/action/${fixtures.actionId}/edit$`);
    const nameInput = () => page.locator("#actionName").filter({ visible: true });

    await page.goto(`/action/${fixtures.actionId}/edit`);
    await expect(nameInput()).toBeVisible({ timeout: 30_000 });

    const nameV1 = `${fixtures.actionName} v1`;
    await nameInput().fill(nameV1);
    expect(await submitForm(page, "/api/action")).toBe(200);
    await page.waitForURL(actionPage);
    await expect(page.locator("h1").filter({ hasText: nameV1 }).filter({ visible: true })).toBeVisible({ timeout: 20_000 });

    await page.goBack();
    await page.waitForURL(editPage);
    await expect(nameInput()).toHaveValue(nameV1, { timeout: 30_000 });

    const nameV2 = `${fixtures.actionName} v2`;
    await nameInput().fill(nameV2);
    expect(await submitForm(page, "/api/action")).toBe(200);
    await page.waitForURL(actionPage);
    await expect(page.locator("h1").filter({ hasText: nameV2 }).filter({ visible: true })).toBeVisible({ timeout: 20_000 });

    // Non-goal panels link to the edit page directly, without the edit menu
    await page.getByTestId("admin-panel-edit").filter({ visible: true }).click();
    await page.waitForURL(editPage);
    await expect(nameInput()).toHaveValue(nameV2, { timeout: 30_000 });

    const nameV3 = `${fixtures.actionName} v3`;
    await nameInput().fill(nameV3);
    expect(await submitForm(page, "/api/action")).toBe(200);
    await page.waitForURL(actionPage);
    await expect(page.locator("h1").filter({ hasText: nameV3 }).filter({ visible: true })).toBeVisible({ timeout: 20_000 });

    expect(dialogs, "no stale-data alert").toEqual([]);
  });
});

test.describe("Activity preservation (characterization)", () => {
  test.use({ storageState: adminFile });

  // Pins the intended behavior: a draft survives navigating away and back. A future
  // change that accidentally remounts routes on navigation would clear the input.
  test("A half-filled roadmap create form keeps its input across a round trip", async ({ page }, testInfo) => {
    const draftName = `Caching draft ${testInfo.project.name} ${testInfo.retry} ${Date.now()}`;
    const nameInput = () => page.locator("#name").filter({ visible: true });

    await page.goto("/roadmap/create");
    await expect(nameInput()).toBeVisible({ timeout: 30_000 });
    await nameInput().fill(draftName);

    // Leave through the sidebar, return with browser back
    await page.getByRole("link", { name: "sidebar.home" }).click();
    await page.waitForURL(/\/(\?.*)?$/);
    await expect(page.getByTestId("home-title")).toBeVisible({ timeout: 20_000 });
    await expect(nameInput()).toHaveCount(0);

    await page.goBack();
    await page.waitForURL(/\/roadmap\/create$/);
    await expect(nameInput()).toHaveValue(draftName, { timeout: 20_000 });

    // Leave again, return through the sidebar's create link (a push navigation)
    await page.getByRole("link", { name: "sidebar.home" }).click();
    await page.waitForURL(/\/(\?.*)?$/);
    await expect(page.getByTestId("home-title")).toBeVisible({ timeout: 20_000 });

    await page.getByTestId("create-button").click();
    await page.getByTestId("create-roadmap").click();
    await page.waitForURL(/\/roadmap\/create$/);
    await expect(nameInput()).toHaveValue(draftName, { timeout: 20_000 });
  });
});

test.describe("Tag revalidation reaches other pages over client navigation", () => {
  test.use({ storageState: adminFile });

  // One seeded place org per browser project, so parallel projects never rename the same org.
  // Nothing else in the suite asserts these names (org-landing only counts the switcher's options).
  const orgByProject: Record<string, string> = {
    "chromium 1080p": "Kiruna kommun",
    "firefox 1080p": "Malmö stad",
    "webkit 1080p": "Göteborgs stad",
  };

  test("Renaming an org shows the new name in the start page's switcher", async ({ page, request }, testInfo) => {
    const baseName = orgByProject[testInfo.project.name] ?? "Region Norrbotten";
    const orgId = await orgIdByName(page, baseName);
    const newName = `${baseName} ${testInfo.retry} ${Date.now()}`;

    try {
      await page.goto(`/org/${orgId}/groups`);
      const nameInput = page.getByTestId("org-name").filter({ visible: true });
      await expect(nameInput).toHaveValue(baseName, { timeout: 30_000 });
      await nameInput.fill(newName);

      const renamed = page.waitForResponse((res) => new URL(res.url()).pathname === "/api/org" && res.request().method() === "PUT", { timeout: 30_000 });
      await page.getByTestId("org-rename-save").filter({ visible: true }).click();
      expect((await renamed).status()).toBe(200);

      // The start page was visited earlier in this test (to find the org), so its
      // cached org list must be refreshed by the 'org' tag revalidation, not served
      // from before the rename. A client navigation, no reload.
      await page.getByRole("link", { name: "sidebar.home" }).click();
      await page.waitForURL(/\/(\?.*)?$/);
      await orgSwitcher(page).locator("select, a").first().waitFor({ timeout: 20_000 });
      await expect(orgSwitcher(page).locator("select option, a").filter({ hasText: newName })).toHaveCount(1, { timeout: 20_000 });
      await expect(orgSwitcher(page).locator("select option, a").filter({ hasText: baseName })).toHaveCount(1);
    }
    finally {
      // Put the seeded name back whatever happened above
      const restored = await request.put("/api/org", { data: { orgId, name: baseName } });
      expect(restored.status(), "restoring the seeded org name").toBe(200);
    }
  });
});

test.describe("Concurrent-edit guard", () => {
  test.use({ storageState: adminFile });

  // The accepted caveat of the re-show timestamp refresh is that a form re-shown after
  // someone else's save overwrites it. This pins the boundary: a form that stayed in
  // the foreground the whole time still submits its original timestamp and is rejected.
  test("A never re-shown goal form is rejected as stale after another save", async ({ page, browser, fixtures }) => {
    const pageB = await (await browser.newContext({ storageState: adminFile })).newPage();
    try {
      const dialogsA = recordDialogs(page);
      const dialogsB = recordDialogs(pageB);

      await page.goto(`/goal/${fixtures.goalId}/edit`);
      await expectGoalFormReady(page);
      await pageB.goto(`/goal/${fixtures.goalId}/edit`);
      await expectGoalFormReady(pageB);

      // A saves
      const nameA = `${fixtures.goalName} from A`;
      await page.locator("#goalName").filter({ visible: true }).fill(nameA);
      expect(await submitForm(page, "/api/goal")).toBe(200);
      await page.waitForURL(new RegExp(`/goal/${fixtures.goalId}$`));
      await expect(page.locator("h1").filter({ hasText: nameA }).filter({ visible: true })).toBeVisible({ timeout: 20_000 });
      expect(dialogsA).toEqual([]);

      // B, whose form predates A's save and was never hidden, is turned away
      await pageB.locator("#goalName").filter({ visible: true }).fill(`${fixtures.goalName} from B`);
      expect(await submitForm(pageB, "/api/goal")).toBe(409);
      await expect.poll(() => dialogsB.length, { message: "the stale-data alert" }).toBe(1);
      expect(pageB.url()).toMatch(new RegExp(`/goal/${fixtures.goalId}/edit$`));

      // A's version is what stuck
      await pageB.goto(`/goal/${fixtures.goalId}`);
      await expect(pageB.locator("h1").filter({ hasText: nameA }).filter({ visible: true })).toBeVisible({ timeout: 20_000 });
    }
    finally {
      await pageB.context().close();
    }
  });
});
