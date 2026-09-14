import { expect, test } from "playwright/test";
import type { Page } from "playwright/test";
import path from "node:path";
import { cwd } from "node:process";

const adminFile = path.join(cwd(), "tests/.auth/admin.json");

/**
 * Linking an action to its origin (another org's original) makes both pages list each other
 * under the neighbours section, and the copy is flagged once its content drifts.
 */
test.describe.serial("Action origin linking", () => {
  test.use({ storageState: adminFile });
  let originName = "";
  let copyName = "";
  let originUrl = "";
  let copyUrl = "";

  test.beforeAll(({ }, testInfo) => {
    originName = `Origin action ${testInfo.project.name} ${Date.now()}`;
    copyName = `Copy action ${testInfo.project.name} ${Date.now()}`;
  });

  async function pickRoadmap(page: Page) {
    const option = page.locator('#iterationId option').filter({ hasText: 'Rikets färdplan' }).filter({ hasText: 'v2' });
    await page.locator('#iterationId').selectOption(await option.getAttribute('value'));
  }

  test("create the origin", async ({ page }) => {
    await page.goto("/action/create");
    await pickRoadmap(page);
    await page.locator('#actionName').fill(originName);
    await page.locator('#submit-button').click();
    await expect(page.getByRole('heading', { name: originName })).toBeVisible();
    originUrl = page.url();
    // Nothing links here yet
    await expect(page.getByTestId('action-neighbours')).toHaveCount(0);
  });

  test("create a copy linked to the origin", async ({ page }) => {
    await page.goto("/action/create");
    await pickRoadmap(page);
    await page.locator('#actionName').fill(copyName);
    // The origin picker lists visible actions as "<org>: <name>"; narrow it by search first
    await page.locator('#origin-action').click();
    await page.locator('#origin-action-dialog input[type="text"]').fill(originName);
    await page.locator('#origin-action-dialog-listbox li').filter({ hasText: originName }).first().click();
    await page.locator('#submit-button').click();
    await expect(page.getByRole('heading', { name: copyName })).toBeVisible();
    copyUrl = page.url();

    const neighbours = page.getByTestId('action-neighbours');
    await expect(neighbours).toBeVisible();
    await expect(neighbours.getByText('action.neighbour_origin_badge')).toBeVisible();
    // The names differ, so the copy already counts as drifted from its origin
    await expect(neighbours.getByTestId('action-neighbour-differs')).toHaveCount(1);
  });

  test("the origin lists the copy", async ({ page }) => {
    await page.goto(originUrl);
    const neighbours = page.getByTestId('action-neighbours');
    await expect(neighbours).toBeVisible();
    await expect(neighbours.getByRole('link', { name: new RegExp(copyName) })).toBeVisible();
    await expect(neighbours.getByText('action.neighbour_origin_badge')).toHaveCount(0);
  });

  test("unlinking removes the section on both sides", async ({ page }) => {
    await page.goto(copyUrl.replace(/\/?$/, "/edit"));
    await page.getByRole('button', { name: 'action.origin_unlink' }).click();
    await page.locator('#submit-button').click();
    await expect(page.getByRole('heading', { name: copyName })).toBeVisible();
    await expect(page.getByTestId('action-neighbours')).toHaveCount(0);
    // The origin page is cached per tag; give the revalidation a moment by reloading until it's gone
    await page.goto(originUrl);
    await expect.poll(async () => {
      await page.reload();
      return page.getByTestId('action-neighbours').count();
    }, { timeout: 15_000 }).toBe(0);
  });

  test.afterAll(async ({ browser }) => {
    // Clean up both actions
    const context = await browser.newContext({ storageState: adminFile });
    const page = await context.newPage();
    for (const url of [copyUrl, originUrl]) {
      const id = url.split('/action/')[1]?.split(/[/?#]/)[0];
      if (id) await page.request.delete('/api/action', { data: { id } });
    }
    await context.close();
  });
});
