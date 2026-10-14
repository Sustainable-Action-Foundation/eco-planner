import { expect, test } from "playwright/test";
import type { Browser, BrowserContext, Page } from "playwright/test";
import path from "node:path";
import { cwd } from "node:process";
import { memberSlug } from "../../scripts/prisma/seed/places";

const adminFile = path.join(cwd(), "tests/.auth/admin.json");
const verifiedFile = path.join(cwd(), "tests/.auth/verified.json");

/*
 * The goal page's preview of a national goal scaled to the area of the user's
 * org. Only the goals whose method takes them as is are covered: every scaling
 * method reads the statistics APIs.
 */

/** A context signed in as a seeded place member (scripts/prisma/seed/places.ts): "First Last", password "password". */
async function memberContext(browser: Browser, name: string): Promise<BrowserContext> {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const response = await context.request.post("/api/login", { data: { username: memberSlug(name), password: "password" } });
  expect(response.status(), `login of ${name}`).toBe(200);
  return context;
}

/** Switches the goal list to table view; the default tree view hides leaves inside collapsed branches. */
async function useTableView(page: Page) {
  await page.locator('input[name="table"][value="TABLE"]').filter({ visible: true }).first().check();
  await expect(page.locator("#goalTable").filter({ visible: true })).toBeVisible();
}

/** Opens the latest version of a national roadmap from the public landing. */
async function gotoNationalRoadmap(page: Page, name: RegExp) {
  await page.goto("/?org=public");
  const href = await page.getByRole("link", { name }).first().getAttribute("href");
  expect(href).toBeTruthy();
  await page.goto(href ?? "");
  await expect(page.getByTestId("show-roadmap").filter({ visible: true })).toBeVisible();
}

/**
 * The page of a goal of the national LEAP scenario, by its indicator
 * parameter's leaf. Looked up as the super admin: the seed may keep the
 * scenario's goals unlisted, which only editors get to list.
 */
async function leapGoalHref(browser: Browser, leaf: string): Promise<string> {
  const context = await browser.newContext({ storageState: adminFile });
  const page = await context.newPage();
  await gotoNationalRoadmap(page, /LEAP Lokal miljöhänsyn/);
  const unlisted = page.getByTestId("unlisted-goals-tab").filter({ visible: true });
  if (await unlisted.count() > 0) await unlisted.click();
  await useTableView(page);
  const href = await page.locator("#goalTable").filter({ visible: true }).getByRole("link", { name: new RegExp(`${leaf}$`) }).first().getAttribute("href");
  await context.close();
  expect(href).toBeTruthy();
  return href ?? "";
}

test.describe("Scaled preview of a national goal", () => {
  test("A goal that is copied unchanged says so instead of showing national values as local", async ({ browser }) => {
    const context = await memberContext(browser, "Nils Forsberg");
    const page = await context.newPage();
    // A blend share: the LEAP rule copies it as is
    await page.goto(await leapGoalHref(browser, "andel låginblandad HVO"));

    const toggle = page.getByTestId("scaled-preview-toggle").filter({ visible: true });
    await expect(toggle.locator("xpath=..")).toContainText("Boden");
    await expect(toggle).not.toBeChecked();
    await expect(page.getByTestId("scaled-preview-unscaled").filter({ visible: true })).toHaveCount(0);

    await toggle.check();
    await expect(page.getByTestId("scaled-preview-unscaled").filter({ visible: true })).toContainText("goal.scaled_preview.as_is");
    await expect(page.getByTestId("scaled-preview-result").filter({ visible: true })).toHaveCount(0);

    // The choice follows the user to the next goal
    await page.reload();
    await expect(page.getByTestId("scaled-preview-toggle").filter({ visible: true })).toBeChecked();
    await context.close();
  });

  test.describe("without an org with an area", () => {
    test.use({ storageState: verifiedFile });

    test("The preview isn't offered", async ({ page }) => {
      await gotoNationalRoadmap(page, /Rikets färdplan/);
      await useTableView(page);
      await page.locator("#goalTable").filter({ visible: true }).getByRole("link").first().click();
      // The panel streams in with the preview's section
      await expect(page.getByRole("heading", { name: /goal\.use_(in_roadmap|locally)\.heading/ }).filter({ visible: true })).toBeVisible();
      await expect(page.getByTestId("scaled-preview-toggle")).toHaveCount(0);
    });
  });
});
