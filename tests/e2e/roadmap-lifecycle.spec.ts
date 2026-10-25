import { expect, test } from "playwright/test";
import type { APIRequestContext, Page } from "playwright/test";
import path from "node:path";
import { cwd } from "node:process";
import areaCodes from "../../src/lib/areaCodes.json" with { type: "json" };
import { expectPageStatus, loginAs, loginContext, pageStatus, Seed, uniqueLabel } from "../lib/api";
import { confirmDelete, gotoUntil, visible } from "../lib/forms";

const adminFile = path.join(cwd(), "tests/.auth/admin.json");

/** Forms follow the API with a client navigation, which changes the URL only once the (slow) target page answers */
const navigationTimeout = 60_000;

/*
 * A roadmap's life through the UI, as the super admin in "Sustainable Action":
 * created through the form, published, edited, given a draft version that
 * non-editors can't see, and deleted through the confirm dialog. The roadmap
 * is removed through the API afterwards in case the UI delete never ran.
 */

/** The grant select of a group in the sharing editor of the roadmap form */
function grantSelect(page: Page, group: string) {
  return visible(page, "label").filter({ hasText: group }).locator("select");
}

/** The name of a geo area by its SCB code (the form lists areas by name) */
function areaName(code: string): string {
  const entry = Object.entries(areaCodes).find(([, value]) => value === code);
  if (!entry) throw new Error(`No area with code ${code}`);
  return entry[0];
}

/** The rich-text editor of the visible form */
function editor(page: Page) {
  return visible(page, ".tiptap").first();
}

/** Submits the visible form and resolves with the API's answer to `method` */
async function submitAndWait(page: Page, url: string, method: "POST" | "PUT") {
  const [response] = await Promise.all([
    page.waitForResponse(response => response.url().includes(url) && response.request().method() === method),
    visible(page, "#submit-button").click(),
  ]);
  return response;
}

/** Fills the roadmap create form; `all` adds the optional fields on top of the required ones */
async function fillRoadmapForm(page: Page, name: string, description: string, all: boolean) {
  await visible(page, "#name").fill(name);
  await editor(page).fill(description);
  await visible(page, "#org").selectOption({ label: Seed.orgName });
  await visible(page, "#type").selectOption("LOCAL");
  if (!all) return;

  await visible(page, "#actor").fill(`Actor ${name}`);
  await visible(page, "#geo-area").click();
  await visible(page, "#geo-area-dialog-listbox li").filter({ hasText: areaName("03") }).click();
  await visible(page, 'input[name="sharing"][value="ORG"]').check();
  await grantSelect(page, Seed.groupName).selectOption("RW");
  await visible(page, "#parent-roadmap").click();
  await visible(page, "#parent-roadmap-dialog-listbox li").filter({ hasText: Seed.nationalRoadmap }).click();
}

/** Deletes the roadmap through the API unless the UI already did; tolerates a missing roadmap */
async function cleanupRoadmap(request: APIRequestContext, id: string) {
  if (!id) return;
  await loginAs(request, Seed.admin.username);
  const response = await request.delete("/api/roadmap", { data: { id } });
  expect([200, 404], `cleanup of roadmap ${id}: ${await response.text()}`).toContain(response.status());
}

test.describe.serial("Roadmap lifecycle, all fields", () => {
  test.use({ storageState: adminFile });
  // Every step loads several pages and some retry a read-after-write render
  test.beforeEach(() => test.slow());

  let name = "";
  let roadmapId = "";
  let deletedInUi = false;

  test.beforeAll(({ }, testInfo) => {
    name = uniqueLabel(testInfo, "Lifecycle");
  });

  test.afterAll(async ({ request }) => {
    if (!deletedInUi) await cleanupRoadmap(request, roadmapId);
  });

  test("creating a roadmap leads to its first version, published at /v1", async ({ page }) => {
    await page.goto("/roadmap/create");
    await fillRoadmapForm(page, name, `Description ${name}`, true);

    const created = await submitAndWait(page, "/api/roadmap", "POST");
    expect(created.status()).toBe(201);
    roadmapId = ((await created.json()) as { id: string }).id;
    await expect(page).toHaveURL(`/roadmap/${roadmapId}/iteration/create`, { timeout: navigationTimeout });

    // The new roadmap works towards the national one, so a target version can be chosen; 0 is "always latest".
    // The first render after the create can miss the new roadmap in its (cached) alternatives and with it the select
    await gotoUntil(page, `/roadmap/${roadmapId}/iteration/create`, async () => {
      await expect(visible(page, "#target-version")).toBeVisible({ timeout: 5_000 });
    });
    await editor(page).fill(`Version ${name}`);
    await visible(page, "#target-version").selectOption("0");
    await visible(page, "#publish").check();
    const published = await submitAndWait(page, "/api/roadmap-iteration", "POST");
    expect(published.status()).toBe(201);

    // The form follows the API's Location; a stale render of a roadmap without versions bounces back to the form
    expect(published.headers()["location"]).toBe(`/roadmap/${roadmapId}/v1`);
    await gotoUntil(page, `/roadmap/${roadmapId}/v1`, async () => {
      await expect(visible(page, "h1").filter({ hasText: name })).toBeVisible({ timeout: 5_000 });
    });
    await expect(page.getByTestId("visibility-badge-draft")).toHaveCount(0);
  });

  test("saving the version form without changes keeps it as it was", async ({ page }) => {
    await page.goto(`/roadmap/${roadmapId}/v1`);
    await page.getByTestId("admin-panel-edit").filter({ visible: true }).click();
    await expect(page).toHaveURL(`/roadmap/${roadmapId}/v1/edit`, { timeout: navigationTimeout });

    await expect(editor(page)).toHaveText(`Version ${name}`);
    await expect(visible(page, "#publish")).toBeChecked();
    await expect(visible(page, "#target-version")).toHaveValue("0");

    const saved = await submitAndWait(page, "/api/roadmap-iteration", "PUT");
    expect(saved.status()).toBe(200);
    await expect(page).toHaveURL(`/roadmap/${roadmapId}/v1`, { timeout: navigationTimeout });

    // The description travels in a hidden input the editor fills in; a save before it did wiped the text
    await gotoUntil(page, `/roadmap/${roadmapId}/v1/edit`, async () => {
      await expect(editor(page)).toHaveText(`Version ${name}`, { timeout: 5_000 });
    });
  });

  test("saving the roadmap form without changes keeps every field", async ({ page }) => {
    await page.goto(`/roadmap/${roadmapId}/v1`);
    await page.getByTestId("show-roadmap").filter({ visible: true }).click();
    await expect(page).toHaveURL(`/roadmap/${roadmapId}`, { timeout: navigationTimeout });
    await page.getByTestId("admin-panel-edit").filter({ visible: true }).click();
    await expect(page).toHaveURL(`/roadmap/${roadmapId}/edit`, { timeout: navigationTimeout });

    await expect(visible(page, "#name")).toHaveValue(name);
    await expect(editor(page)).toHaveText(`Description ${name}`);
    await expect(visible(page, "#type")).toHaveValue("LOCAL");
    await expect(visible(page, "#actor")).toHaveValue(`Actor ${name}`);
    await expect(visible(page, "#geo-area")).toContainText(areaName("03"));
    await expect(visible(page, 'input[name="sharing"][value="ORG"]')).toBeChecked();
    await expect(grantSelect(page, Seed.groupName)).toHaveValue("RW");
    await expect(visible(page, "#parent-roadmap")).toContainText(Seed.nationalRoadmap);

    const saved = await submitAndWait(page, "/api/roadmap", "PUT");
    expect(saved.status()).toBe(200);
    await expect(page).toHaveURL(`/roadmap/${roadmapId}`, { timeout: navigationTimeout });
    await expect(visible(page, "h1").filter({ hasText: name })).toBeVisible();

    await gotoUntil(page, `/roadmap/${roadmapId}/edit`, async () => {
      await expect(editor(page)).toHaveText(`Description ${name}`, { timeout: 5_000 });
    });
  });

  test("a changed version description round-trips through the form", async ({ page }) => {
    await page.goto(`/roadmap/${roadmapId}/v1/edit`);
    // Fill only once the editor holds the stored text: on Firefox a fill that beats the editor's
    // initial content gets that content appended after the typed text
    await expect(editor(page)).toHaveText(`Version ${name}`);
    await editor(page).fill(`Updated version ${name}`);
    const saved = await submitAndWait(page, "/api/roadmap-iteration", "PUT");
    expect(saved.status()).toBe(200);
    await expect(page).toHaveURL(`/roadmap/${roadmapId}/v1`, { timeout: navigationTimeout });

    await gotoUntil(page, `/roadmap/${roadmapId}/v1/edit`, async () => {
      await expect(editor(page)).toHaveText(`Updated version ${name}`, { timeout: 5_000 });
    });
    await expect(visible(page, "#publish")).toBeChecked();
  });

  test("changed roadmap fields round-trip through the form", async ({ page }) => {
    await page.goto(`/roadmap/${roadmapId}/edit`);
    await visible(page, "#name").fill(`${name} updated`);
    // As above: let the editor load the stored description before replacing it
    await expect(editor(page)).toHaveText(`Description ${name}`);
    await editor(page).fill(`Updated description ${name}`);
    await visible(page, "#type").selectOption("OTHER");
    await visible(page, "#actor").fill(`Updated actor ${name}`);
    // The admin manages the org, so the public option is offered
    await visible(page, 'input[name="sharing"][value="PUBLIC"]').check();
    await grantSelect(page, Seed.groupName).selectOption("RO");

    const saved = await submitAndWait(page, "/api/roadmap", "PUT");
    expect(saved.status()).toBe(200);
    await expect(page).toHaveURL(`/roadmap/${roadmapId}`, { timeout: navigationTimeout });
    await gotoUntil(page, `/roadmap/${roadmapId}`, async () => {
      await expect(visible(page, "h1").filter({ hasText: `${name} updated` })).toBeVisible({ timeout: 5_000 });
    });

    await gotoUntil(page, `/roadmap/${roadmapId}/edit`, async () => {
      await expect(visible(page, "#name")).toHaveValue(`${name} updated`, { timeout: 5_000 });
    });
    await expect(editor(page)).toHaveText(`Updated description ${name}`);
    await expect(visible(page, "#type")).toHaveValue("OTHER");
    await expect(visible(page, "#actor")).toHaveValue(`Updated actor ${name}`);
    await expect(visible(page, 'input[name="sharing"][value="PUBLIC"]')).toBeChecked();
    await expect(grantSelect(page, Seed.groupName)).toHaveValue("RO");
    name = `${name} updated`;
  });

  test("a second version can be created as a draft", async ({ page }) => {
    await gotoUntil(page, `/roadmap/${roadmapId}/iteration/create`, async () => {
      await expect(visible(page, "#target-version")).toBeVisible({ timeout: 5_000 });
    });
    await editor(page).fill(`Draft ${name}`);
    // The target version is required while the roadmap has a parent
    await visible(page, "#target-version").selectOption("0");
    await visible(page, "#draft").check();
    const created = await submitAndWait(page, "/api/roadmap-iteration", "POST");
    expect(created.status()).toBe(201);

    expect(created.headers()["location"]).toBe(`/roadmap/${roadmapId}/v2`);
    await gotoUntil(page, `/roadmap/${roadmapId}/v2`, async () => {
      await expect(page.getByTestId("visibility-badge-draft").filter({ visible: true })).toBeVisible({ timeout: 5_000 });
    });
  });

  test("a plain member sees the published version but not the draft; latest resolves to the published one", async ({ browser }) => {
    const context = await loginContext(browser, Seed.anita.username);
    try {
      expect(await pageStatus(context.request, `/roadmap/${roadmapId}/v1`)).toBe(200);
      expect(await pageStatus(context.request, `/roadmap/${roadmapId}/v2`)).toBe(404);

      const page = await context.newPage();
      await gotoUntil(page, `/roadmap/${roadmapId}/latest`, async () => {
        await expect(visible(page, "h1").filter({ hasText: name })).toBeVisible({ timeout: 5_000 });
      });
      // The version line carries the number as a parameter (cimode prints them after the key)
      await expect(visible(page, "main header")).toContainText('"version":1');
      await expect(page.getByTestId("visibility-badge-draft")).toHaveCount(0);
    }
    finally {
      await context.close();
    }
  });

  test("the roadmap is deleted after typing its name in the confirm dialog", async ({ page }) => {
    await page.goto(`/roadmap/${roadmapId}`);
    const deleted = await confirmDelete(page, name, "/api/roadmap");
    expect(deleted.status()).toBe(200);
    deletedInUi = true;

    // A deleted roadmap lands on its org's landing page
    await expect(page).toHaveURL(/\/\?org=[0-9a-f-]{36}$/, { timeout: navigationTimeout });
    await expectPageStatus(page.request, `/roadmap/${roadmapId}`, 404);
  });
});

test.describe.serial("Roadmap lifecycle, required fields only", () => {
  test.use({ storageState: adminFile });
  // Every step loads several pages and some retry a read-after-write render
  test.beforeEach(() => test.slow());

  let name = "";
  let roadmapId = "";

  test.beforeAll(({ }, testInfo) => {
    name = uniqueLabel(testInfo, "Minimal");
  });

  test.afterAll(async ({ request }) => {
    await cleanupRoadmap(request, roadmapId);
  });

  test("name, description, org and type are enough for a published first version", async ({ page }) => {
    await page.goto("/roadmap/create");
    await fillRoadmapForm(page, name, `Description ${name}`, false);

    const created = await submitAndWait(page, "/api/roadmap", "POST");
    expect(created.status()).toBe(201);
    roadmapId = ((await created.json()) as { id: string }).id;
    await expect(page).toHaveURL(`/roadmap/${roadmapId}/iteration/create`, { timeout: navigationTimeout });

    // Without a parent roadmap there is no target version to pick; the status defaults to draft
    await expect(visible(page, "#target-version")).toHaveCount(0);
    await visible(page, "#publish").check();
    const published = await submitAndWait(page, "/api/roadmap-iteration", "POST");
    expect(published.status()).toBe(201);

    expect(published.headers()["location"]).toBe(`/roadmap/${roadmapId}/v1`);
    await gotoUntil(page, `/roadmap/${roadmapId}/v1`, async () => {
      await expect(visible(page, "h1").filter({ hasText: name })).toBeVisible({ timeout: 5_000 });
    });
  });

  test("the forms reopen with the defaults and save unchanged", async ({ page }) => {
    await page.goto(`/roadmap/${roadmapId}/v1/edit`);
    await expect(visible(page, "#publish")).toBeChecked();
    expect((await submitAndWait(page, "/api/roadmap-iteration", "PUT")).status()).toBe(200);
    await expect(page).toHaveURL(`/roadmap/${roadmapId}/v1`, { timeout: navigationTimeout });

    await page.goto(`/roadmap/${roadmapId}/edit`);
    await expect(visible(page, "#name")).toHaveValue(name);
    await expect(editor(page)).toHaveText(`Description ${name}`);
    await expect(visible(page, "#type")).toHaveValue("LOCAL");
    await expect(visible(page, "#actor")).toHaveValue("");
    // New roadmaps are shared with the org and no group holds a grant
    await expect(visible(page, 'input[name="sharing"][value="ORG"]')).toBeChecked();
    await expect(grantSelect(page, Seed.groupName)).toHaveValue("NONE");
    expect((await submitAndWait(page, "/api/roadmap", "PUT")).status()).toBe(200);
    await expect(page).toHaveURL(`/roadmap/${roadmapId}`, { timeout: navigationTimeout });
  });

  test("sharing with granted groups only round-trips", async ({ page }) => {
    await page.goto(`/roadmap/${roadmapId}/edit`);
    await visible(page, 'input[name="sharing"][value="GROUPS"]').check();
    await grantSelect(page, Seed.groupName).selectOption("RW");
    expect((await submitAndWait(page, "/api/roadmap", "PUT")).status()).toBe(200);
    await expect(page).toHaveURL(`/roadmap/${roadmapId}`, { timeout: navigationTimeout });

    await gotoUntil(page, `/roadmap/${roadmapId}/edit`, async () => {
      await expect(visible(page, 'input[name="sharing"][value="GROUPS"]')).toBeChecked({ timeout: 5_000 });
    });
    await expect(grantSelect(page, Seed.groupName)).toHaveValue("RW");
  });
});
