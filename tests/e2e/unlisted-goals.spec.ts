import { expect, test } from "playwright/test";
import type { Page } from "playwright/test";
import path from "node:path";
import { cwd } from "node:process";

const adminFile = path.join(cwd(), "tests/.auth/admin.json");
const verifiedFile = path.join(cwd(), "tests/.auth/verified.json");

// Deterministic unlisted goals from the seed (scripts/prisma/seed/seed-goals.ts).
// The national one is on Rikets färdplan v1 (public, admin + anita hold RW);
// the regional one is on Uppsala v1 (org-readable, anita's group only holds RO).
const unlistedNationalGoal = "Dold nationell målbana";
const unlistedRegionalGoal = "Dold regional målbana";

/** Goal links rendered by the goal list, matched by visible goal name. */
function goalLinks(page: Page, name: string) {
  return page.locator('main a[href^="/goal/"]').filter({ hasText: name });
}

/** Switches the goal list to table view; the default tree view hides leaves inside collapsed branches. */
async function useTableView(page: Page) {
  await page.locator('input[name="table"][value="TABLE"]').first().check();
  await expect(page.locator('#goalTable')).toBeVisible();
}

/** Opens Rikets färdplan v1 from the public landing. */
async function gotoNationalV1(page: Page) {
  await page.goto("/?org=public");
  const href = await page.getByRole("link", { name: /Rikets färdplan/ }).first().getAttribute("href");
  expect(href).toBeTruthy();
  await page.goto((href ?? "").replace(/\/(v\d+|latest)\/?$/, "/v1"));
  await expect(page.getByTestId("show-roadmap")).toBeVisible();
}

/** Opens Uppsala län v1; org-readable, so it is reached through an org landing rather than the public tab. */
async function gotoUppsalaV1(page: Page, viaOrgTab: boolean) {
  if (viaOrgTab) {
    // Multi-org users (admin) may default to another org's landing; go via the Sustainable Action tab
    await page.goto("/");
    const orgHref = await page.locator('nav[aria-label*="org_nav_label"]').getByRole("link", { name: "Sustainable Action" }).getAttribute("href");
    expect(orgHref).toBeTruthy();
    await page.goto(`${orgHref}&searchFilter=${encodeURIComponent("Uppsala")}`);
  } else {
    // Single-org users land straight on their org's landing
    await page.goto(`/?searchFilter=${encodeURIComponent("Uppsala")}`);
  }
  const href = await page.getByRole("link", { name: /Uppsala/ }).first().getAttribute("href");
  expect(href).toBeTruthy();
  await page.goto((href ?? "").replace(/\/(v\d+|latest)\/?$/, "/v1"));
  await expect(page.getByTestId("show-roadmap")).toBeVisible();
}

test.describe("Unlisted goals (editor)", () => {
  test.use({ storageState: adminFile });

  test("The regular goal list hides unlisted goals; editors get them in their own tab", async ({ page }) => {
    await gotoNationalV1(page);
    await useTableView(page);

    // Hidden from the regular list, and from the featured strip even though the seed marks it featured
    await expect(page.getByTestId("unlisted-goals-tab")).toBeVisible();
    await expect(goalLinks(page, unlistedNationalGoal)).toHaveCount(0);
    await expect(page.getByTestId("featured-goals").filter({ hasText: unlistedNationalGoal })).toHaveCount(0);

    // The unlisted tab reveals it; switching back hides it again
    await page.getByTestId("unlisted-goals-tab").click();
    await expect(goalLinks(page, unlistedNationalGoal).first()).toBeVisible();
    await page.getByTestId("listed-goals-tab").click();
    await expect(goalLinks(page, unlistedNationalGoal)).toHaveCount(0);
  });

  test("An unlisted goal's own page renders for editors", async ({ page }) => {
    await gotoNationalV1(page);
    await page.getByTestId("unlisted-goals-tab").click();
    await useTableView(page);
    await goalLinks(page, unlistedNationalGoal).first().click();
    await expect(page.getByRole("main")).toContainText(unlistedNationalGoal);
  });
});

test.describe("Unlisted goals (read-only member)", () => {
  test.use({ storageState: verifiedFile });

  test("Read-only viewers see neither the unlisted goals nor the tab", async ({ page }) => {
    // anita's group only holds an RO grant on Uppsala
    await gotoUppsalaV1(page, false);
    await useTableView(page);

    await expect(page.getByTestId("unlisted-goals-tab")).toHaveCount(0);
    await expect(goalLinks(page, unlistedRegionalGoal)).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText(unlistedRegionalGoal);
  });
});

test.describe("Unlisted goals (logged out)", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("Anonymous visitors of a public roadmap see no trace of unlisted goals", async ({ page }) => {
    await gotoNationalV1(page);
    await useTableView(page);

    await expect(page.getByTestId("unlisted-goals-tab")).toHaveCount(0);
    await expect(goalLinks(page, unlistedNationalGoal)).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText(unlistedNationalGoal);
  });
});

test.describe("Unlisted goals (direct links)", () => {
  test("A direct link still resolves with plain read access", async ({ browser }) => {
    // Unlisted only affects listings, not access: fetch the regional goal's URL as
    // the org manager, then open it as the read-only member.
    const adminContext = await browser.newContext({ storageState: adminFile });
    const adminPage = await adminContext.newPage();
    await gotoUppsalaV1(adminPage, true);
    // Managers count as editors, so the tab shows up for admin here too
    await adminPage.getByTestId("unlisted-goals-tab").click();
    await useTableView(adminPage);
    const goalHref = await goalLinks(adminPage, unlistedRegionalGoal).first().getAttribute("href");
    expect(goalHref).toBeTruthy();
    await adminContext.close();

    const readOnlyContext = await browser.newContext({ storageState: verifiedFile });
    const readOnlyPage = await readOnlyContext.newPage();
    await readOnlyPage.goto(goalHref ?? "");
    await expect(readOnlyPage.getByRole("main")).toContainText(unlistedRegionalGoal);
    await readOnlyContext.close();
  });
});

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

test.describe.serial("Unlisted goal creation", () => {
  test.use({ storageState: adminFile });

  let goalName = "Test unlisted goal";
  let indicator = "Unlisted\\test";

  test.beforeAll("Differentiate between browsers", ({ }, { project }) => {
    goalName += ` ${project.name}`;
    indicator += `\\${project.name}`;
  });

  test("Create an unlisted goal via the form", async ({ page }) => {
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

    await page.locator('#isUnlisted').check();

    await page.locator('#submit-button').click();
    await page.locator('#comment-text').hover();

    // The checkbox round-trips in the edit form
    await page.getByTestId("admin-panel-edit").click();
    await page.waitForLoadState("networkidle");
    await expect(page.locator('#isUnlisted')).toBeChecked();
  });

  test("The new goal only appears under the unlisted tab", async ({ page }) => {
    // The form put it on Rikets färdplan v2
    await page.goto("/?org=public");
    const href = await page.getByRole("link", { name: /Rikets färdplan/ }).first().getAttribute("href");
    expect(href).toBeTruthy();
    await page.goto((href ?? "").replace(/\/(v\d+|latest)\/?$/, "/v2"));

    await useTableView(page);
    await expect(goalLinks(page, goalName)).toHaveCount(0);
    await page.getByTestId("unlisted-goals-tab").click();
    await expect(goalLinks(page, goalName).first()).toBeVisible();
  });
});
