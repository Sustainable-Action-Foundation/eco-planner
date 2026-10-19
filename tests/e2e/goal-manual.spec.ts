import { expect, test } from "playwright/test";
import type { APIRequestContext, Page } from "playwright/test";
import path from "node:path";
import { cwd } from "node:process";
import { indicatorParameterLeaf } from "../../src/functions/goalName";
import { createGoal, createIteration, createRoadmap, deleteRoadmap, expectPageStatus, loginAs, loginContext, orgIdByName, pageStatus, Seed, uniqueLabel } from "../lib/api";
import { confirmDelete, fillManualDataSeries, gotoUntil, gridCellValue, indicatorValue, openGoalCreateIn, openGoalEdit, rewriteManualDataSeries, useTableView, visible } from "../lib/forms";

const adminFile = path.join(cwd(), "tests/.auth/admin.json");

/*
 * A goal with a manually entered series, from the create form to the confirm
 * dialog, inside a throwaway roadmap in "Sustainable Action" that is created
 * through the API before the flow and deleted after it.
 */

/** Goal links of the visible goal table (the featured strip links its goals too), by the goal's shown name */
function goalLinks(page: Page, name: string) {
  return visible(page, "#goalTable").locator('a[href^="/goal/"]').filter({ hasText: name });
}

/** Submits the visible goal form and resolves with the API's answer */
async function submitGoal(page: Page, method: "POST" | "PUT") {
  const [response] = await Promise.all([
    page.waitForResponse(response => new URL(response.url()).pathname === "/api/goal" && response.request().method() === method),
    visible(page, "#submit-button").click(),
  ]);
  return response;
}

/** The goal page has rendered once its comment box is there (its SSR is slow under load) */
async function expectGoalPage(page: Page, goalId: string) {
  await expect(page).toHaveURL(`/goal/${goalId}`, { timeout: 30_000 });
  await expect(visible(page, "#comment-text")).toBeVisible({ timeout: 30_000 });
}

/** The edit form is ready once the manual grid holds the stored series */
async function expectEditFormReady(page: Page, firstYear: number) {
  await expect(visible(page, "#goalName")).toBeVisible();
  await expect(visible(page, '#goal-dataseries [data-row="0"][data-column="1"] input')).toHaveValue(String(firstYear));
}

/** Reveals the baseline section of the goal form if it is collapsed */
async function openBaselineSection(page: Page) {
  const toggle = page.getByTestId("baseline-section-toggle").filter({ visible: true });
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
}

/** Picks a listing in the goal page's admin panel and waits for the save and the page reload it triggers */
async function setVisibility(page: Page, option: "listed" | "unlisted" | "featured") {
  await page.getByTestId("admin-panel-visibility").filter({ visible: true }).click();
  const [response] = await Promise.all([
    page.waitForResponse(response => new URL(response.url()).pathname === "/api/goal" && response.request().method() === "PUT"),
    page.waitForEvent("load"),
    page.getByTestId(`admin-panel-visibility-${option}`).filter({ visible: true }).click(),
  ]);
  expect(response.status()).toBe(200);
  // The reload is the first render after the save and may still be the cached page
  await gotoUntil(page, new URL(page.url()).pathname, async () => {
    await expect(page.getByTestId("admin-panel-visibility").filter({ visible: true })).toContainText(`listing_${option}`, { timeout: 5_000 });
  });
}

async function expectCurrentVisibility(page: Page, option: "listed" | "unlisted" | "featured") {
  await page.getByTestId("admin-panel-visibility").filter({ visible: true }).click();
  for (const candidate of ["listed", "unlisted", "featured"] as const) {
    await expect(page.getByTestId(`admin-panel-visibility-${candidate}`).filter({ visible: true })).toHaveAttribute("aria-pressed", String(candidate === option));
  }
  await page.keyboard.press("Escape");
}

test.describe.serial("Manual goal", () => {
  test.use({ storageState: adminFile });
  // Every step loads several pages and some retry a read-after-write render
  test.beforeEach(() => test.slow());

  let label = "";
  let roadmapId = "";
  let goalId = "";
  let admin: APIRequestContext;

  const indicator = () => `Manual\\${label}\\Leaf`;
  const indicatorUpdated = () => `Manual\\${label}\\Updated leaf`;

  test.beforeAll(async ({ playwright, baseURL }, testInfo) => {
    label = uniqueLabel(testInfo);
    admin = await playwright.request.newContext({ baseURL });
    await loginAs(admin, Seed.admin.username);
    roadmapId = await createRoadmap(admin, await orgIdByName(admin, Seed.orgName), { name: `Sandbox ${label}` });
    const iterationId = await createIteration(admin, roadmapId);
    // A listed neighbour keeps the goal table on screen while the goal under test is unlisted
    await createGoal(admin, iterationId, { name: `Neighbour ${label}` });
  });

  test.afterAll(async () => {
    if (roadmapId) await deleteRoadmap(admin, roadmapId);
    await admin.dispose();
  });

  test("a goal with a decimal comma and grouped thousands stores plain numbers", async ({ page }) => {
    await openGoalCreateIn(page, `Sandbox ${label}`);

    // No name: the goal goes by the leaf of its indicator parameter
    await visible(page, 'input[name="DATA_SERIES_TYPE"][value="MANUAL"]').check();
    await visible(page, "#indicatorParameter").fill(indicator());
    await visible(page, "#indicatorParameter").blur();
    await visible(page, "#goal-manual-unit").fill("meter");
    await visible(page, "#goal-manual-unit").blur();
    // Regression #110: these used to become NaN and fail the recipe type guards
    await fillManualDataSeries(page, [[2020, "1,5"], [2021, "18 800"], [2022, "2,25"]]);

    const created = await submitGoal(page, "POST");
    expect(created.status()).toBe(201);
    goalId = ((await created.json()) as { id: string }).id;
    await expectGoalPage(page, goalId);
    await expect(page.getByTestId("goal-indicator-parameter").filter({ visible: true })).toHaveText(indicator());
    await expect(visible(page, "main h1")).toHaveText(indicatorParameterLeaf(indicator()));
  });

  test("the edit form shows the stored values and the unnamed goal's placeholder, and saves unchanged", async ({ page }) => {
    await page.goto(`/goal/${goalId}`);
    await openGoalEdit(page);
    // A client navigation: the URL changes once the (slow) edit page has answered
    await expect(page).toHaveURL(`/goal/${goalId}/edit`, { timeout: 90_000 });
    await expectEditFormReady(page, 2020);

    // The leaf is only a placeholder, never stored as the name
    await expect(visible(page, "#goalName")).toHaveValue("");
    await expect(visible(page, "#goalName")).toHaveAttribute("placeholder", indicatorParameterLeaf(indicator()));
    await expect(visible(page, 'input[name="DATA_SERIES_TYPE"][value="MANUAL"]')).toBeChecked();
    await expect(indicatorValue(page)).toHaveValue(indicator());
    await expect(visible(page, "#goal-manual-unit")).toHaveValue("meter");
    expect(await gridCellValue(page, 0, 2)).toBe("1.5");
    expect(await gridCellValue(page, 1, 2)).toBe("18800");
    expect(await gridCellValue(page, 2, 2)).toBe("2.25");
    // New goals derive their baseline from the first value
    await expect(visible(page, 'input[name="BASELINE_TYPE"][value="INITIAL"]')).toBeChecked();
    await expect(visible(page, "#isPublic")).toBeChecked();

    expect((await submitGoal(page, "PUT")).status()).toBe(200);
    await expectGoalPage(page, goalId);

    await openGoalEdit(page);
    await expectEditFormReady(page, 2020);
    await expect(visible(page, "#goalName")).toHaveValue("");
    await expect(visible(page, "#goal-manual-unit")).toHaveValue("meter");
    expect(await gridCellValue(page, 1, 2)).toBe("18800");
  });

  test("every field can be changed and comes back from the edit form", async ({ page }) => {
    await page.goto(`/goal/${goalId}/edit`);
    await expectEditFormReady(page, 2020);

    await visible(page, "#goalName").fill(`Goal ${label}`);
    await visible(page, ".tiptap").first().fill(`Description ${label}`);
    await visible(page, "#indicatorParameter").fill(indicatorUpdated());
    await visible(page, "#indicatorParameter").blur();
    await visible(page, "#goal-manual-unit").fill("yard");
    await visible(page, "#goal-manual-unit").blur();
    // A leading zero so the first-non-zero baseline differs from the first value
    await rewriteManualDataSeries(page, [[2025, 0], [2026, 4], [2027, 4]]);
    await openBaselineSection(page);
    await visible(page, 'input[name="BASELINE_TYPE"][value="INITIAL_NON_ZERO"]').check();
    await visible(page, "#isFeatured").check();

    expect((await submitGoal(page, "PUT")).status()).toBe(200);
    await expectGoalPage(page, goalId);
    await gotoUntil(page, `/goal/${goalId}`, async () => {
      await expect(visible(page, "main h1")).toHaveText(`Goal ${label}`, { timeout: 5_000 });
    });
    await expect(visible(page, "#rich-description")).toHaveText(`Description ${label}`);
    await expect(page.getByTestId("visibility-badge-featured").filter({ visible: true })).toBeVisible();

    await gotoUntil(page, `/goal/${goalId}/edit`, async () => {
      await expect(visible(page, "#goalName")).toHaveValue(`Goal ${label}`, { timeout: 5_000 });
    });
    await expectEditFormReady(page, 2025);
    await expect(visible(page, ".tiptap").first()).toHaveText(`Description ${label}`);
    await expect(indicatorValue(page)).toHaveValue(indicatorUpdated());
    await expect(visible(page, "#goal-manual-unit")).toHaveValue("yard");
    for (const [row, year, value] of [[0, "2025", "0"], [1, "2026", "4"], [2, "2027", "4"]] as const) {
      expect(await gridCellValue(page, row, 1)).toBe(year);
      expect(await gridCellValue(page, row, 2)).toBe(value);
    }
    // Derived baselines reopen as their own type, not as a custom series
    await expect(visible(page, 'input[name="BASELINE_TYPE"][value="INITIAL_NON_ZERO"]')).toBeChecked();
    await expect(visible(page, "#isFeatured")).toBeChecked();
    await expect(visible(page, "#isUnlisted")).not.toBeChecked();
  });

  test("the baseline can be a custom series, and none at all", async ({ page }) => {
    await gotoUntil(page, `/goal/${goalId}/edit`, async () => {
      await expectEditFormReady(page, 2025);
    });
    await openBaselineSection(page);
    await visible(page, 'input[name="BASELINE_TYPE"][value="CUSTOM"]').check();
    await fillManualDataSeries(page, [[2025, "2,5"]], "#baseline-dataseries");
    expect((await submitGoal(page, "PUT")).status()).toBe(200);
    await expectGoalPage(page, goalId);

    await gotoUntil(page, `/goal/${goalId}/edit`, async () => {
      await expectEditFormReady(page, 2025);
      await openBaselineSection(page);
      await expect(visible(page, 'input[name="BASELINE_TYPE"][value="CUSTOM"]')).toBeChecked({ timeout: 5_000 });
    });
    expect(await gridCellValue(page, 0, 1, "#baseline-dataseries")).toBe("2025");
    expect(await gridCellValue(page, 0, 2, "#baseline-dataseries")).toBe("2.5");

    await openBaselineSection(page);
    await visible(page, 'input[name="BASELINE_TYPE"][value="NONE"]').check();
    expect((await submitGoal(page, "PUT")).status()).toBe(200);
    await expectGoalPage(page, goalId);
    await gotoUntil(page, `/goal/${goalId}/edit`, async () => {
      await expectEditFormReady(page, 2025);
      await openBaselineSection(page);
      await expect(visible(page, 'input[name="BASELINE_TYPE"][value="NONE"]')).toBeChecked({ timeout: 5_000 });
    });
    // The rest of the goal is untouched by the baseline edits
    await expect(visible(page, "#goalName")).toHaveValue(`Goal ${label}`);
    await expect(visible(page, "#isFeatured")).toBeChecked();
  });

  test("a featured goal is in the featured strip and the table", async ({ page }) => {
    await page.goto(`/goal/${goalId}`);
    await expectCurrentVisibility(page, "featured");

    await gotoUntil(page, `/roadmap/${roadmapId}/v1`, async () => {
      await expect(page.getByTestId("featured-goals").filter({ visible: true }).filter({ hasText: `Goal ${label}` })).toHaveCount(1, { timeout: 5_000 });
    });
    await useTableView(page);
    await expect(goalLinks(page, `Goal ${label}`)).toHaveCount(1);
  });

  test("unlisting moves the goal to the editors' unlisted tab", async ({ page }) => {
    await page.goto(`/goal/${goalId}`);
    await setVisibility(page, "unlisted");
    await expectCurrentVisibility(page, "unlisted");
    await expect(page.getByTestId("visibility-badge-unlisted").filter({ visible: true })).toBeVisible();

    await gotoUntil(page, `/goal/${goalId}/edit`, async () => {
      await expectEditFormReady(page, 2025);
      await expect(visible(page, "#isUnlisted")).toBeChecked({ timeout: 5_000 });
    });
    await expect(visible(page, "#isFeatured")).not.toBeChecked();

    await gotoUntil(page, `/roadmap/${roadmapId}/v1`, async () => {
      await expect(page.getByTestId("unlisted-goals-tab").filter({ visible: true })).toBeVisible({ timeout: 5_000 });
    });
    await expect(page.getByTestId("featured-goals").filter({ visible: true }).filter({ hasText: `Goal ${label}` })).toHaveCount(0);
    await useTableView(page);
    await expect(goalLinks(page, `Goal ${label}`)).toHaveCount(0);
    await page.getByTestId("unlisted-goals-tab").filter({ visible: true }).click();
    await expect(goalLinks(page, `Goal ${label}`)).toHaveCount(1);
    await page.getByTestId("listed-goals-tab").filter({ visible: true }).click();
    await expect(goalLinks(page, `Goal ${label}`)).toHaveCount(0);
  });

  test("a read-only member sees neither the tab nor the goal, but its link still resolves", async ({ browser }) => {
    const context = await loginContext(browser, Seed.anita.username);
    try {
      const page = await context.newPage();
      await page.goto(`/roadmap/${roadmapId}/v1`);
      await useTableView(page);
      await expect(page.getByTestId("unlisted-goals-tab")).toHaveCount(0);
      await expect(goalLinks(page, `Goal ${label}`)).toHaveCount(0);
      await expect(page.locator("main")).not.toContainText(`Goal ${label}`);

      // Unlisted only affects listings, not access
      expect(await pageStatus(context.request, `/goal/${goalId}`)).toBe(200);
      await page.goto(`/goal/${goalId}`);
      await expect(visible(page, "main h1")).toHaveText(`Goal ${label}`);
    }
    finally {
      await context.close();
    }
  });

  test("listing it again puts it back in the table without featuring it", async ({ page }) => {
    await page.goto(`/goal/${goalId}`);
    await setVisibility(page, "listed");
    await expectCurrentVisibility(page, "listed");
    await expect(page.getByTestId("visibility-badge-unlisted")).toHaveCount(0);
    await expect(page.getByTestId("visibility-badge-featured")).toHaveCount(0);

    await gotoUntil(page, `/roadmap/${roadmapId}/v1`, async () => {
      await useTableView(page);
      await expect(goalLinks(page, `Goal ${label}`)).toHaveCount(1, { timeout: 5_000 });
    });
    await expect(page.getByTestId("featured-goals").filter({ visible: true }).filter({ hasText: `Goal ${label}` })).toHaveCount(0);
  });

  test("the goal is deleted after typing its name in the confirm dialog", async ({ page }) => {
    await page.goto(`/goal/${goalId}`);
    const deleted = await confirmDelete(page, `Goal ${label}`, "/api/goal");
    expect(deleted.status()).toBe(200);

    await expectPageStatus(page.request, `/goal/${goalId}`, 404);
    await gotoUntil(page, `/roadmap/${roadmapId}/v1`, async () => {
      await useTableView(page);
      await expect(goalLinks(page, `Goal ${label}`)).toHaveCount(0, { timeout: 5_000 });
    });
  });
});
