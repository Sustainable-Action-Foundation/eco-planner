import path from "node:path";
import { cwd } from "node:process";
import { expect, test as base } from "../lib/fixtures";
import type { APIRequestContext, Page } from "playwright/test";
import { createAction, createGoal, createIteration, createRoadmap, deleteRoadmap, loginAs, loginContext, pageEntity, Seed } from "../lib/api";
import { expectGoalEditFormReady, pickIterationInGoalForm, recordDialogs, reloadUntil, submitForm, visible, waitForRecipeFormSyncs } from "../lib/forms";
import { withLock } from "../lib/lock";
import { orgLandingHref, orgSwitcher } from "../lib/org-switcher";
import { ClientError } from "../../src/types/consts";

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

/** The sidebar's home link (its label is rendered on the server, whose language doesn't reliably follow cimode) */
function sidebarHome(page: Page) {
  return visible(page, 'aside nav a[href="/"]');
}

/** The stored name of a goal or action, read back from its page's RSC payload */
async function storedName(admin: APIRequestContext, url: string, id: string): Promise<unknown> {
  return (await pageEntity(admin, url, id))?.name;
}

/**
 * After a save: the form navigated to the object's page and the server has the new name.
 * The rendered heading isn't asserted on: a delete anywhere in the app revalidates the same
 * tag with `max`, which downgrades the save's immediate expiry to stale-while-revalidate, so
 * under parallel workers the first render after a save can still be the old one (see report).
 */
async function expectSaved(page: Page, admin: APIRequestContext, pageUrl: RegExp, apiUrl: string, id: string, name: string) {
  await page.waitForURL(pageUrl);
  await expect(visible(page, "main h1").first()).toBeVisible({ timeout: 20_000 });
  await expect.poll(() => storedName(admin, apiUrl, id), { timeout: 20_000 }).toBe(name);
}

type Fixtures = { goalId: string, goalName: string, actionId: string, actionName: string };

/** A manual-series goal and an action in the sandbox version, so the edit flows never touch seeded entities */
const test = base.extend<{ fixtures: Fixtures }>({
  fixtures: async ({ admin, sandbox }, use) => {
    const goalName = `Caching goal ${sandbox.label}`;
    const goalId = await createGoal(admin, sandbox.iterationId, { name: goalName, indicatorParameter: `Caching\\${sandbox.label}` });
    const actionName = `Caching action ${sandbox.label}`;
    const actionId = await createAction(admin, sandbox.iterationId, { name: actionName });
    await use({ goalId, goalName, actionId, actionName });
  },
});

test.describe("Activity re-show: edit forms save again after a save", () => {
  test.use({ storageState: adminFile });

  test("Goal edit form saves after browser back and after a Link revisit", async ({ page, admin, fixtures }) => {
    // Three saves of the heaviest form, each followed by a page render and a read-back
    test.slow();
    const dialogs = recordDialogs(page);
    const goalPage = new RegExp(`/goal/${fixtures.goalId}$`);
    const editPage = new RegExp(`/goal/${fixtures.goalId}/edit$`);

    await page.goto(`/goal/${fixtures.goalId}/edit`);
    await expectGoalEditFormReady(page);

    // First save, from a freshly mounted form
    const nameV1 = `${fixtures.goalName} v1`;
    await visible(page, "#goalName").fill(nameV1);
    expect(await submitForm(page, "/api/goal")).toBe(200);
    await expectSaved(page, admin, goalPage, `/goal/${fixtures.goalId}`, fixtures.goalId, nameV1);

    // Browser back re-shows the preserved form instance (the input still holds what we typed)
    await page.goBack();
    await page.waitForURL(editPage);
    await expectGoalEditFormReady(page);
    await expect(visible(page, "#goalName")).toHaveValue(nameV1);

    // Its stale-guard timestamp must have been refreshed on re-show: the save is accepted
    const nameV2 = `${fixtures.goalName} v2`;
    await visible(page, "#goalName").fill(nameV2);
    expect(await submitForm(page, "/api/goal")).toBe(200);
    await expectSaved(page, admin, goalPage, `/goal/${fixtures.goalId}`, fixtures.goalId, nameV2);

    // Revisiting through the admin panel link (a push navigation) must save too
    await page.getByTestId("admin-panel-edit-menu").filter({ visible: true }).click();
    await page.getByTestId("admin-panel-edit").filter({ visible: true }).click();
    await page.waitForURL(editPage);
    await expectGoalEditFormReady(page);
    await expect(visible(page, "#goalName")).toHaveValue(nameV2);

    const nameV3 = `${fixtures.goalName} v3`;
    await visible(page, "#goalName").fill(nameV3);
    expect(await submitForm(page, "/api/goal")).toBe(200);
    await expectSaved(page, admin, goalPage, `/goal/${fixtures.goalId}`, fixtures.goalId, nameV3);

    expect(dialogs, "no stale-data alert").toEqual([]);
  });

  test("Action edit form saves after browser back and after a Link revisit", async ({ page, admin, fixtures }) => {
    test.slow();
    const dialogs = recordDialogs(page);
    const actionPage = new RegExp(`/action/${fixtures.actionId}$`);
    const editPage = new RegExp(`/action/${fixtures.actionId}/edit$`);
    const nameInput = () => visible(page, "#actionName");

    await page.goto(`/action/${fixtures.actionId}/edit`);
    await expect(nameInput()).toBeVisible({ timeout: 30_000 });

    const nameV1 = `${fixtures.actionName} v1`;
    await nameInput().fill(nameV1);
    expect(await submitForm(page, "/api/action")).toBe(200);
    await expectSaved(page, admin, actionPage, `/action/${fixtures.actionId}`, fixtures.actionId, nameV1);

    await page.goBack();
    await page.waitForURL(editPage);
    await expect(nameInput()).toHaveValue(nameV1, { timeout: 30_000 });

    const nameV2 = `${fixtures.actionName} v2`;
    await nameInput().fill(nameV2);
    expect(await submitForm(page, "/api/action")).toBe(200);
    await expectSaved(page, admin, actionPage, `/action/${fixtures.actionId}`, fixtures.actionId, nameV2);

    // Non-goal panels link to the edit page directly, without the edit menu
    await page.getByTestId("admin-panel-edit").filter({ visible: true }).click();
    await page.waitForURL(editPage);
    await expect(nameInput()).toHaveValue(nameV2, { timeout: 30_000 });

    const nameV3 = `${fixtures.actionName} v3`;
    await nameInput().fill(nameV3);
    expect(await submitForm(page, "/api/action")).toBe(200);
    await expectSaved(page, admin, actionPage, `/action/${fixtures.actionId}`, fixtures.actionId, nameV3);

    expect(dialogs, "no stale-data alert").toEqual([]);
  });
});

test.describe("Activity preservation (characterization)", () => {
  test.use({ storageState: adminFile });

  // Pins the intended behavior: a draft survives navigating away and back. A future
  // change that accidentally remounts routes on navigation would clear the input.
  test("A half-filled roadmap create form keeps its input across a round trip", async ({ page, sandbox }) => {
    const draftName = `Caching draft ${sandbox.label}`;
    const nameInput = () => visible(page, "#name");

    await page.goto("/roadmap/create");
    await expect(nameInput()).toBeVisible({ timeout: 30_000 });
    await nameInput().fill(draftName);

    // Leave through the sidebar, return with browser back
    await sidebarHome(page).click();
    await page.waitForURL(/\/(\?.*)?$/);
    await expect(page.getByTestId("home-title")).toBeVisible({ timeout: 20_000 });
    await expect(nameInput()).toHaveCount(0);

    await page.goBack();
    await page.waitForURL(/\/roadmap\/create$/);
    await expect(nameInput()).toHaveValue(draftName, { timeout: 20_000 });

    // Leave again, return through the sidebar's create link (a push navigation)
    await sidebarHome(page).click();
    await page.waitForURL(/\/(\?.*)?$/);
    await expect(page.getByTestId("home-title")).toBeVisible({ timeout: 20_000 });

    await page.getByTestId("create-button").filter({ visible: true }).click();
    await page.getByTestId("create-roadmap").filter({ visible: true }).click();
    await page.waitForURL(/\/roadmap\/create$/);
    await expect(nameInput()).toHaveValue(draftName, { timeout: 20_000 });
  });
});

test.describe("Tag revalidation reaches other pages over client navigation", () => {
  test.use({ storageState: adminFile });

  // One seeded place org that admin manages; the browser projects run in parallel
  // workers, so the rename is serialized through a lock and restored in `finally`.
  const orgName = "Uppsala kommun";

  test("Renaming an org shows the new name in the start page's switcher", async ({ page, playwright, baseURL }, testInfo) => {
    test.slow();
    // Its own API context for the restore: the fixture's is disposed if the test times out mid-way
    const restorer = await playwright.request.newContext({ baseURL, timeout: 60_000 });
    await loginAs(restorer, Seed.admin.username, Seed.admin.password);
    await withLock("org-rename-uppsala", async () => {
      // Visit the start page in the browser first, so its cached org list predates the rename
      await page.goto("/");
      const orgId = new URL(await orgLandingHref(page, orgName), "http://localhost").searchParams.get("org");
      expect(orgId, `org id of ${orgName}`).toBeTruthy();
      const newName = `${orgName} ${testInfo.project.name} ${testInfo.retry} ${Date.now().toString(36)}`;

      try {
        await page.goto(`/org/${orgId}/groups`);
        const nameInput = page.getByTestId("org-name").filter({ visible: true });
        // A previous run's restore may be the latest write, whose first render can still be stale
        await reloadUntil(page, () => expect(nameInput).toHaveValue(orgName, { timeout: 15_000 }), 60_000);
        await nameInput.fill(newName);

        const renamed = page.waitForResponse((res) => new URL(res.url()).pathname === "/api/org" && res.request().method() === "PUT", { timeout: 30_000 });
        await page.getByTestId("org-rename-save").filter({ visible: true }).click();
        expect((await renamed).status()).toBe(200);

        // The start page was visited earlier in this test (to find the org), so its
        // cached org list must be refreshed by the 'org' tag revalidation, not served
        // from before the rename. A client navigation first; the very first render after the
        // rename has been seen to serve the old list once (stale-while-revalidate, see report),
        // so reloads may follow, but a list that never refreshes still fails.
        await sidebarHome(page).click();
        await page.waitForURL(/\/(\?.*)?$/);
        const renamedOption = orgSwitcher(page).locator("select option, a").filter({ hasText: newName });
        await expect(async () => {
          await orgSwitcher(page).locator("select, a").first().waitFor({ timeout: 20_000 });
          if (await renamedOption.count() === 0) {
            await page.reload();
            await orgSwitcher(page).locator("select, a").first().waitFor({ timeout: 20_000 });
          }
          await expect(renamedOption).toHaveCount(1, { timeout: 1_000 });
        }).toPass({ timeout: 45_000 });
        await expect(orgSwitcher(page).locator("select option, a").filter({ hasText: orgName })).toHaveCount(1);
      }
      finally {
        // Put the seeded name back whatever happened above. The restorer sat idle through the
        // test, so its kept-alive socket may already be closed by the server ("socket hang up"):
        // resend until it lands, or a leftover name breaks every later run of this test
        await expect(async () => {
          const restored = await restorer.put("/api/org", { data: { orgId, name: orgName } });
          expect(restored.status(), "restoring the seeded org name").toBe(200);
        }).toPass({ timeout: 60_000 });
      }
    }).finally(() => restorer.dispose());
  });
});

test.describe("Concurrent-edit guard", () => {
  test.use({ storageState: adminFile });

  // The accepted caveat of the re-show timestamp refresh is that a form re-shown after
  // someone else's save overwrites it. This pins the boundary: a form that stayed in
  // the foreground the whole time still submits its original timestamp and is rejected.
  test("A never re-shown goal form is rejected as stale after another save", async ({ page, browser, admin, fixtures }) => {
    test.slow();
    const contextB = await loginContext(browser, Seed.admin.username, Seed.admin.password);
    const pageB = await contextB.newPage();
    try {
      const dialogsA = recordDialogs(page);
      const dialogsB = recordDialogs(pageB);

      await page.goto(`/goal/${fixtures.goalId}/edit`);
      await expectGoalEditFormReady(page);
      await pageB.goto(`/goal/${fixtures.goalId}/edit`);
      await expectGoalEditFormReady(pageB);

      // A saves
      const nameA = `${fixtures.goalName} from A`;
      await visible(page, "#goalName").fill(nameA);
      expect(await submitForm(page, "/api/goal")).toBe(200);
      await expectSaved(page, admin, new RegExp(`/goal/${fixtures.goalId}$`), `/goal/${fixtures.goalId}`, fixtures.goalId, nameA);
      expect(dialogsA).toEqual([]);

      // B, whose form predates A's save and was never hidden, is turned away with exactly one
      // stale-data notice: a toast, not a native alert
      await visible(pageB, "#goalName").fill(`${fixtures.goalName} from B`);
      expect(await submitForm(pageB, "/api/goal")).toBe(409);
      const toasts = pageB.getByTestId("toast-list").locator("li");
      await expect(toasts.filter({ hasText: ClientError.StaleData }), "the stale-data toast").toHaveCount(1);
      await expect(toasts).toHaveCount(1);
      expect(dialogsB).toEqual([]);
      expect(pageB.url()).toMatch(new RegExp(`/goal/${fixtures.goalId}/edit$`));

      // A's version is what stuck
      await expect.poll(() => storedName(admin, `/goal/${fixtures.goalId}`, fixtures.goalId), { timeout: 20_000 }).toBe(nameA);
    }
    finally {
      await contextB.close();
    }
  });
});

test.describe("Copy refusal feedback", () => {
  test.use({ storageState: adminFile });

  // A second copy of the same goal into the same roadmap version is refused (409) with a toast,
  // and the submit button comes back instead of spinning forever.
  test("Copying a goal into a version that already has it shows a toast and re-enables the form", async ({ page, admin, sandbox, fixtures }) => {
    test.slow();
    const targetName = `Copy target ${sandbox.label}`;
    const targetId = await createRoadmap(admin, sandbox.orgId, { name: targetName });
    try {
      await createIteration(admin, targetId);
      const dialogs = recordDialogs(page);
      const submitButton = visible(page, "#submit-button");

      const openCopyForm = async () => {
        await page.goto(`/goal/create?from=${fixtures.goalId}`);
        await expect(visible(page, 'form[name="goalForm"]')).toBeVisible({ timeout: 30_000 });
        await expect(visible(page, "#goalName")).toHaveValue(fixtures.goalName, { timeout: 30_000 });
        // The roadmap picker's options are cached and the target is only moments old
        await reloadUntil(page, async () => {
          await visible(page, "#parent-roadmap").click();
          await expect(visible(page, "#parent-roadmap-dialog-listbox li").filter({ hasText: targetName })).not.toHaveCount(0, { timeout: 5_000 });
          await page.keyboard.press("Escape");
        }, 60_000);
        await pickIterationInGoalForm(page, targetName);
        await waitForRecipeFormSyncs(page);
      };

      // The first copy goes through
      await openCopyForm();
      expect(await submitForm(page, "/api/goal", "POST")).toBe(201);
      await page.waitForURL(/\/goal\/[0-9a-f-]{36}$/, { timeout: 30_000 });

      // The second is refused, with one toast, and the form is usable again
      await openCopyForm();
      expect(await submitForm(page, "/api/goal", "POST")).toBe(409);
      const toasts = page.getByTestId("toast-list").locator("li");
      await expect(toasts.filter({ hasText: "already_in_roadmap" })).toHaveCount(1);
      await expect(submitButton).toBeEnabled();
      await expect(submitButton.locator("[data-pending]")).toHaveCount(0);
      expect(page.url()).toMatch(/\/goal\/create\?from=/);
      expect(dialogs).toEqual([]);
    }
    finally {
      await deleteRoadmap(admin, targetId);
    }
  });
});
