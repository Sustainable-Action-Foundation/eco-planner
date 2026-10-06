import { expect, test } from "playwright/test";
import type { Browser, BrowserContext, Page } from "playwright/test";
import path from "node:path";
import { cwd } from "node:process";
import { memberSlug } from "../../scripts/prisma/seed/places";

const adminFile = path.join(cwd(), "tests/.auth/admin.json");

/*
 * Copying a goal into one's own roadmap from its page ("use in roadmap"):
 * a copy the roadmap already has is refused with a message and the form's
 * submit button comes back, instead of a second copy or an endless spinner.
 * Only a goal the LEAP rules copy as is is used: scaling methods read the
 * statistics APIs.
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

/** From a goal's page, follows "use in roadmap" to the prefilled goal form and points it at the named roadmap. */
async function openCopyForm(page: Page, goalHref: string, roadmap: string) {
  await page.goto(goalHref);
  await page.locator('a[href^="/goal/create?from="]').filter({ visible: true }).first().click();
  await expect(page.locator("form[name=goalForm]").filter({ visible: true })).toBeVisible();

  await page.locator("#parent-roadmap").filter({ visible: true }).click();
  await page.locator("#parent-roadmap-dialog-listbox li").filter({ visible: true }).filter({ hasText: roadmap }).first().click();

  // The recipe sections evaluate on a debounce (and remount for the roadmap's
  // area); submitting before they settle yields a "no data" rejection instead
  await expect.poll(
    () => page.locator('form[name=goalForm] input[name="RECIPE_EVALUATION_PENDING"]:enabled').evaluateAll(inputs => inputs.map(input => (input as HTMLInputElement).value)),
    { timeout: 30_000 },
  ).not.toContain("true");
}

function submitButton(page: Page) {
  return page.locator("#submit-button").filter({ visible: true });
}

/** Submits the copy form and returns the goal API's answer. */
async function submitCopy(page: Page) {
  const [response] = await Promise.all([
    page.waitForResponse(response => response.url().includes("/api/goal") && response.request().method() === "POST"),
    submitButton(page).click(),
  ]);
  return response;
}

test.describe("Copying a goal into a roadmap", () => {
  test("A copy the roadmap already has is refused with a message and the button comes back", async ({ browser }) => {
    // The seed copies every LEAP goal into Boden's roadmap
    const context = await memberContext(browser, "Maja Sandberg");
    const page = await context.newPage();
    await openCopyForm(page, await leapGoalHref(browser, "andel låginblandad HVO"), "Boden");

    const response = await submitCopy(page);
    expect(response.status()).toBe(409);

    await expect(page.getByTestId("toast-list")).toContainText("already_in_roadmap");
    await expect(submitButton(page)).toBeEnabled();
    await expect(submitButton(page).locator("[data-pending]")).toHaveCount(0);
    await expect(page).toHaveURL(/\/goal\/create/);
    await context.close();
  });

  test("A first copy goes through, a second is refused", async ({ browser }) => {
    // Kiruna's roadmap starts out empty
    const context = await memberContext(browser, "Lars Niia");
    const page = await context.newPage();
    const goalHref = await leapGoalHref(browser, "andel låginblandad HVO");

    await openCopyForm(page, goalHref, "Kiruna");
    const created = await submitCopy(page);
    expect(created.status()).toBe(201);
    const { id } = await created.json() as { id: string };
    await expect(page).toHaveURL(new RegExp(`/goal/${id}`));

    try {
      await openCopyForm(page, goalHref, "Kiruna");
      const refused = await submitCopy(page);
      expect(refused.status()).toBe(409);
      await expect(page.getByTestId("toast-list")).toContainText("already_in_roadmap");
      await expect(submitButton(page)).toBeEnabled();
    }
    finally {
      // Leave the roadmap as it was for the next run
      const deleted = await context.request.delete("/api/goal", { data: { id } });
      expect(deleted.status()).toBe(200);
      await context.close();
    }
  });
});
