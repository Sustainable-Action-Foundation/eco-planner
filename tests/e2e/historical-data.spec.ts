import path from "node:path";
import { cwd } from "node:process";
import { expect, test } from "../lib/fixtures";
import type { APIRequestContext } from "playwright/test";
import { createGoal, freshTimestamp, orgIdByName, pageEntity, postJson, seriesValues, yearlyDateValues } from "../lib/api";
import { fillManualDataSeries, gridCellValue, pickSingleSearchOption, recordDialogs, visible, waitForRecipeFormSyncs } from "../lib/forms";
import { withLock } from "../lib/lock";
import { mockStemApi } from "../lib/mocks";

/*
 * Historical data on a goal: entered by hand through the goal's own
 * historical-data pages (create, edit, delete), picked from an external
 * catalog (mocked STEM; the content fetch is a server action that would hit
 * the real API, so the flow stops at the unfinished-selection feedback), and
 * offered by the browsable curated entry pages, whose series refs prefill the
 * goal creation form.
 */

const adminFile = path.join(cwd(), "tests/.auth/admin.json");

/** The visible admin panel (hidden Activity routes keep their own) */
function adminPanel(page: Parameters<typeof visible>[0]) {
  return page.locator("aside").filter({ visible: true });
}

/**
 * Saves the historical form and resolves with the `/api/goal` status. The create
 * page is meant to POST and the edit page to PUT, but the mode prop crosses the
 * server/client boundary as a client-module enum (see the report), so accept either.
 */
async function saveHistorical(page: Parameters<typeof visible>[0]): Promise<number> {
  const response = page.waitForResponse(res => new URL(res.url()).pathname === "/api/goal" && ["POST", "PUT"].includes(res.request().method()), { timeout: 30_000 });
  await visible(page, "#submit-button").click();
  const answer = await response;
  if (answer.status() >= 300) console.warn(`historical save ${answer.request().method()} -> ${answer.status()}: ${await answer.text()} (sent ${answer.request().postData()})`);
  return answer.status();
}

const historicalGrid = "#historical-data-series";

/** The form's serialized historical series (a hidden input; scoped to the visible page since the create page stays mounted) */
function historicalSeriesInput(page: Parameters<typeof visible>[0]) {
  return visible(page, 'form[name="goalForm"]').locator('input[name="HISTORICAL_DATA_SERIES"]:enabled');
}

/** The goal's stored historical values by year, or null without a historical section */
async function storedHistorical(admin: APIRequestContext, goalId: string): Promise<number[] | null> {
  const goal = await pageEntity(admin, `/goal/${goalId}`, goalId);
  return goal?.historical ? seriesValues(goal.historical) : null;
}

test.describe("Historical data", () => {
  test.use({ storageState: adminFile });

  test("Manual historical data: add through the create page and reopen it for editing", async ({ page, admin, sandbox }) => {
    test.slow();
    const goalName = `Historical goal ${sandbox.label}`;
    const goalId = await createGoal(admin, sandbox.iterationId, { name: goalName });
    const dialogs = recordDialogs(page);
    const goalPage = new RegExp(`/goal/${goalId}$`);

    // The goal page's add menu leads to the create page
    await page.goto(`/goal/${goalId}`);
    await expect(visible(page, "h1").filter({ hasText: goalName })).toBeVisible({ timeout: 20_000 });
    await page.getByTestId("admin-panel-add-menu").filter({ visible: true }).click();
    await adminPanel(page).getByTestId("historical-data-create-link").click();
    await page.waitForURL(new RegExp(`/goal/${goalId}/historical-data/create$`));

    await visible(page, 'input[name="historical-data-type"][value="CUSTOM"]').check();
    await fillManualDataSeries(page, [[2015, 10], [2016, 12], [2017, 15]], historicalGrid);
    await waitForRecipeFormSyncs(page);
    await expect(historicalSeriesInput(page)).toHaveValue(/2017/);
    expect(await saveHistorical(page)).toBeLessThan(300);
    await page.waitForURL(goalPage);
    await expect(visible(page, "h1").filter({ hasText: goalName })).toBeVisible({ timeout: 20_000 });
    await expect.poll(() => storedHistorical(admin, goalId), { timeout: 20_000 }).toEqual([10, 12, 15]);

    // The edit page starts from what was saved
    await page.getByTestId("admin-panel-edit-menu").filter({ visible: true }).click();
    await page.getByTestId("historical-data-link").filter({ visible: true }).click();
    await page.waitForURL(new RegExp(`/goal/${goalId}/historical-data/edit$`));
    await expect(visible(page, 'input[name="historical-data-type"][value="CUSTOM"]')).toBeChecked();
    await expect(visible(page, `${historicalGrid} [data-row="2"][data-column="2"] input`)).toHaveValue("15", { timeout: 20_000 });
    expect(await gridCellValue(page, 0, 1, historicalGrid)).toBe("2015");
    expect(await gridCellValue(page, 0, 2, historicalGrid)).toBe("10");

    expect(dialogs).toEqual([]);
  });

  test("Manual historical data: the edit page deletes it after a typed confirmation", async ({ page, admin, sandbox }) => {
    // Known app bug: the edit page passes `mode={HistoricalFormMode.Edit}` from a server component,
    // but the enum lives in the "use client" form module, so the client never sees "EDIT": the delete
    // button is not rendered (and the create page PUTs instead of POSTing). Remove once it renders.
    test.fail(true, "historical edit page renders no delete button (HistoricalFormMode crosses the server/client boundary)");
    const goalId = await createGoal(admin, sandbox.iterationId, { name: `Historical delete ${sandbox.label}` });
    await postJson(admin, "/api/goal", {
      target: "HISTORICAL",
      goalId,
      timestamp: freshTimestamp(),
      historical: { unit: "ton", dateValues: yearlyDateValues([10, 12, 15], 2015) },
    }, 200);

    await page.goto(`/goal/${goalId}/historical-data/edit`);
    await expect(visible(page, `${historicalGrid} [data-row="2"][data-column="2"] input`)).toHaveValue("15", { timeout: 30_000 });
    await page.getByTestId("delete-historical-data").filter({ visible: true }).click();
    const dialog = page.locator("dialog[open]").filter({ has: page.getByTestId("delete-historical-data-confirm") });
    await expect(dialog).toBeVisible();
    await dialog.getByTestId("delete-historical-data-confirm").fill("table_menu.historical_data");
    const cleared = page.waitForResponse(res => new URL(res.url()).pathname === "/api/goal" && res.request().method() === "PUT", { timeout: 30_000 });
    await dialog.getByTestId("delete-historical-data-submit").click();
    expect((await cleared).status()).toBe(200);
    await page.waitForURL(new RegExp(`/goal/${goalId}$`), { timeout: 30_000 });
    await expect.poll(() => storedHistorical(admin, goalId), { timeout: 20_000 }).toBeNull();
  });

  test("Manual historical data: an edit saves the new values", async ({ page, admin, sandbox }) => {
    // Known app bug: re-saving existing historical data sends its recipe id, and the API creates a
    // second series on that 1:1 recipe (Prisma P2014 on `recipe_used`, answered 500). Remove this
    // annotation once the edit saves.
    test.fail(true, "PUT /api/goal HISTORICAL with the existing historicalRecipeId answers 500 (P2014 recipe_used)");
    const goalId = await createGoal(admin, sandbox.iterationId, { name: `Historical edit ${sandbox.label}` });
    await postJson(admin, "/api/goal", {
      target: "HISTORICAL",
      goalId,
      timestamp: freshTimestamp(),
      historical: { unit: "ton", dateValues: yearlyDateValues([10, 12, 15], 2015) },
    }, 200);

    await page.goto(`/goal/${goalId}/historical-data/edit`);
    await expect(visible(page, `${historicalGrid} [data-row="2"][data-column="2"] input`)).toHaveValue("15", { timeout: 30_000 });
    await visible(page, `${historicalGrid} [data-row="1"][data-column="2"] input`).fill("20");
    await waitForRecipeFormSyncs(page);
    await expect(historicalSeriesInput(page)).toHaveValue(/:20[,}]/);
    expect(await saveHistorical(page)).toBe(200);
    await page.waitForURL(new RegExp(`/goal/${goalId}$`));
    await expect.poll(() => storedHistorical(admin, goalId), { timeout: 20_000 }).toEqual([10, 20, 15]);
  });

  test("External series from the mocked STEM catalog: an unfinished selection is flagged and blocks the save", async ({ page, admin, sandbox }) => {
    await mockStemApi(page);
    const goalId = await createGoal(admin, sandbox.iterationId, { name: `External historical ${sandbox.label}` });

    await page.goto(`/goal/${goalId}/historical-data/create`);
    await visible(page, 'input[name="historical-data-type"][value="EXTERNAL"]').check();
    await visible(page, "#externalDataset").selectOption("STEM");
    await pickSingleSearchOption(page, "externalTableId", "Nätanslutna solcellsanläggningar");

    // The single metric and the first period are preselected; the status line names the region as still to pick.
    // (Completing it would fetch the table content through a server action against the live API, so stop here.)
    await expect(visible(page, "select#ContentsCode")).toHaveValue("N");
    const status = visible(page, 'p[role="status"]');
    await expect(status).toContainText("query_builder.selection_incomplete");
    await expect(status).toContainText("Region");
    await expect(status).not.toContainText("Effektklass");

    // Saving with an incomplete selection is refused up front, before any request
    let posted = 0;
    page.on("request", request => { if (new URL(request.url()).pathname === "/api/goal") posted++; });
    await visible(page, "#submit-button").click();
    await expect(page.getByTestId("toast-list")).toContainText("goal.errors.missing_historical_data");
    expect(page.url()).toMatch(new RegExp(`/goal/${goalId}/historical-data/create$`));
    expect(posted).toBe(0);

    // Clearing the source drops the selection and its status line
    await visible(page, "#externalDataset").selectOption("");
    await expect(status).toHaveCount(0);
  });

  test("Curated entry pages offer their series to a new goal, prefilling the form", async ({ page, admin }) => {
    test.slow();
    // The prefilled form's external panel would otherwise read the real STEM catalog from the browser
    await mockStemApi(page);
    // A municipality, so the refs resolve to municipal tables. The caching spec renames this org under
    // the lock, so read its id (which a rename doesn't change) under the lock too.
    // (The first read after the rename test's restore can still show the renamed org, hence the retry.)
    const orgId = await withLock("org-rename-uppsala", async () => {
      let id = "";
      await expect(async () => { id = await orgIdByName(admin, "Uppsala kommun"); }).toPass({ timeout: 30_000 });
      return id;
    });

    await page.goto(`/org/${orgId}/historical-data/wind-turbines`);
    // The entry name is translated on the server, whose language doesn't reliably follow cimode
    await expect(visible(page, "main h1")).not.toBeEmpty({ timeout: 60_000 });
    await expect(page.getByText("org_historical_data.use_heading").filter({ visible: true })).toBeVisible();
    const newGoal = visible(page, "main").getByRole("link", { name: "org_historical_data.new_goal" });
    await expect(newGoal).toHaveAttribute("href", `/goal/create?org=${orgId}&series=curated%3Awind-turbines%2Fwind-turbines`);

    // The goal form starts from the series: named after it, inheriting from it, with it as external historical data
    await newGoal.click();
    await page.waitForURL(/\/goal\/create\?org=/);
    // Named after the series. The prefill notice and the name are rendered on the server, whose
    // language does not reliably follow the cimode browser locale, so only presence is asserted.
    await expect(visible(page, "#goalName")).not.toHaveValue("", { timeout: 30_000 });
    await expect(visible(page, 'input[name="DATA_SERIES_TYPE"][value="SUGGESTED"]')).toBeChecked();
    await expect(page.getByTestId("historical-section").filter({ visible: true })).toBeVisible();
    await expect(visible(page, 'input[name="historical-data-type"][value="EXTERNAL"]')).toBeChecked();
    await expect(visible(page, "#externalDataset")).toHaveValue("STEM");
    // The ref resolves to the municipal wind power table
    await expect(visible(page, "#externalTableId")).toContainText("EN0105_4");

    // A multi-series entry lets the visitor pick which series the link carries
    await page.goto(`/org/${orgId}/historical-data/cars-by-fuel`);
    const seriesRadios = visible(page, 'input[name="series"]');
    await expect(seriesRadios.first()).toBeVisible({ timeout: 30_000 });
    expect(await seriesRadios.count()).toBeGreaterThan(1);
    await visible(page, 'input[name="series"][value="electric"]').check();
    await expect(visible(page, "main").getByRole("link", { name: "org_historical_data.new_goal" }))
      .toHaveAttribute("href", `/goal/create?org=${orgId}&series=curated%3Acars-by-fuel%2Felectric`);
  });
});
