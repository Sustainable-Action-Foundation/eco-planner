import { expect, test } from "playwright/test";
import type { Page } from "playwright/test";
import path from "node:path";
import { cwd } from "node:process";

const adminFile = path.join(cwd(), "tests/.auth/admin.json");

/*
 * The goal admin panel's visibility menu (public / unlisted / featured) both
 * saves the flags and changes where the goal shows up on its roadmap version.
 */

/** Goal links rendered by the goal list, matched by visible goal name. */
function goalLinks(page: Page, name: string) {
  return page.locator('main a[href^="/goal/"]').filter({ hasText: name });
}

/** Switches the goal list to table view; the default tree view hides leaves inside collapsed branches. */
async function useTableView(page: Page) {
  await page.locator('input[name="table"][value="TABLE"]').first().check();
  await expect(page.locator('#goalTable')).toBeVisible();
}

/** Opens Rikets färdplan v2 (where the goal below is created) from the public landing. */
async function gotoNationalV2(page: Page) {
  await page.goto("/?org=public");
  const href = await page.getByRole("link", { name: /Rikets färdplan/ }).first().getAttribute("href");
  expect(href).toBeTruthy();
  await page.goto((href ?? "").replace(/\/(v\d+|latest)\/?$/, "/v2"));
  await expect(page.getByTestId("show-roadmap")).toBeVisible();
}

/** Picks a visibility in the goal page's admin panel; the panel reloads the page once the change is saved. */
async function setVisibility(page: Page, visibility: "public" | "unlisted" | "featured") {
  await page.getByTestId("admin-panel-visibility").click();
  await Promise.all([
    page.waitForEvent("load"),
    page.getByTestId(`admin-panel-visibility-${visibility}`).click(),
  ]);
  await expect(page.getByTestId("admin-panel-visibility")).toBeVisible();
}

/** The option the menu marks as current. */
async function expectCurrentVisibility(page: Page, visibility: "public" | "unlisted" | "featured") {
  await page.getByTestId("admin-panel-visibility").click();
  for (const option of ["public", "unlisted", "featured"] as const) {
    await expect(page.getByTestId(`admin-panel-visibility-${option}`)).toHaveAttribute("aria-pressed", String(option === visibility));
  }
  // Close the menu again
  await page.keyboard.press("Escape");
}

async function fillManualDataSeries(page: Page, rows: Array<[number, number]>) {
  const insertRowButton = page.getByTestId("add-row-button");

  for (let i = 1; i < rows.length; i++) {
    await insertRowButton.click();
  }

  // Set focus inside table to ensure the first cell gets filled properly (see goals-tests.spec.ts)
  await page.locator(`#goal-dataseries [data-row="0"][data-column="1"] input`).focus();

  for (let row = 0; row < rows.length; row++) {
    const [year, value] = rows[row];
    await page.locator(`#goal-dataseries [data-row="${row}"][data-column="1"] input`).fill(String(year));
    await page.locator(`#goal-dataseries [data-row="${row}"][data-column="2"] input`).fill(String(value));
  }
}

test.describe.serial("Goal visibility menu", () => {
  test.use({ storageState: adminFile });

  let goalName = "Test visibility goal";
  let indicator = "Visibility\\test";
  let goalUrl = "";

  test.beforeAll("Differentiate between browsers", ({ }, { project }) => {
    goalName += ` ${project.name}`;
    indicator += `\\${project.name}`;
  });

  test("A goal starts out public", async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState("networkidle");

    await page.getByTestId('create-button').click();
    await page.getByTestId('create-goal').click();
    await page.waitForLoadState("networkidle");

    await page.locator('#parent-roadmap').click();
    await page.locator('#parent-roadmap-dialog-listbox li').filter({ hasText: 'Rikets färdplan' }).filter({ hasText: '2' }).click();

    await page.locator('#goalName').fill(goalName);

    await page.locator('input[name="DATA_SERIES_TYPE"][value="MANUAL"]').check();
    await page.locator('#indicatorParameter').fill(indicator);
    await page.locator('#goal-manual-unit').fill("meter");
    await page.locator('#goal-manual-unit').blur();
    await fillManualDataSeries(page, Array.from({ length: 10 }, (_, i) => [2020 + i, 1]));

    await page.locator('#submit-button').click();
    await page.locator('#comment-text').hover();
    goalUrl = page.url();

    await expectCurrentVisibility(page, "public");
  });

  test("Featuring saves and shows the goal in the featured strip", async ({ page }) => {
    await page.goto(goalUrl);
    await setVisibility(page, "featured");
    await expectCurrentVisibility(page, "featured");

    // The flags round-trip in the full edit form
    await page.getByTestId("admin-panel-edit-menu").click();
    await page.getByTestId("admin-panel-edit").click();
    await expect(page.locator('#isFeatured')).toBeChecked();
    await expect(page.locator('#isUnlisted')).not.toBeChecked();

    await gotoNationalV2(page);
    await expect(page.getByTestId("featured-goals").filter({ hasText: goalName })).toHaveCount(1);
    await useTableView(page);
    await expect(goalLinks(page, goalName).first()).toBeVisible();
  });

  test("Unlisting saves, drops the goal from the featured strip and moves it to the unlisted tab", async ({ page }) => {
    await page.goto(goalUrl);
    await setVisibility(page, "unlisted");
    await expectCurrentVisibility(page, "unlisted");

    await page.getByTestId("admin-panel-edit-menu").click();
    await page.getByTestId("admin-panel-edit").click();
    await expect(page.locator('#isUnlisted')).toBeChecked();
    await expect(page.locator('#isFeatured')).not.toBeChecked();

    await gotoNationalV2(page);
    await expect(page.getByTestId("featured-goals").filter({ hasText: goalName })).toHaveCount(0);
    await useTableView(page);
    await expect(goalLinks(page, goalName)).toHaveCount(0);
    await page.getByTestId("unlisted-goals-tab").click();
    await expect(goalLinks(page, goalName).first()).toBeVisible();
  });

  test("Making it public again lists it without featuring it", async ({ page }) => {
    await page.goto(goalUrl);
    await setVisibility(page, "public");
    await expectCurrentVisibility(page, "public");

    await page.getByTestId("admin-panel-edit-menu").click();
    await page.getByTestId("admin-panel-edit").click();
    await expect(page.locator('#isUnlisted')).not.toBeChecked();
    await expect(page.locator('#isFeatured')).not.toBeChecked();

    await gotoNationalV2(page);
    await expect(page.getByTestId("featured-goals").filter({ hasText: goalName })).toHaveCount(0);
    await useTableView(page);
    await expect(goalLinks(page, goalName).first()).toBeVisible();
  });
});
