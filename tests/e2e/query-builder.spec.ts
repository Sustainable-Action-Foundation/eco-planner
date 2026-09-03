import { expect, test } from "playwright/test";
import type { Page } from "playwright/test";
import path from "node:path";
import { cwd } from "node:process";
import { RecipeDataTypes } from "../../src/functions/recipe/types/enums";
import { stemSolarMetadataFixture, stemTablesFixture } from "../lib/stemFixtures";

const adminFile = path.join(cwd(), "tests/.auth/admin.json");

const STEM_API_ORIGIN = "https://api.pxexternal2.energimyndigheten.se";

/**
 * Serve a deterministic STEM catalog and table metadata, so tests neither depend
 * on nor hit the real API. Only the browser-side calls (table list, metadata) can
 * be intercepted here; the table-content fetch is a "use server" action egressing
 * from the app server, so these tests never assert on table content.
 */
async function mockStemApi(page: Page) {
  await page.route(`${STEM_API_ORIGIN}/**`, async route => {
    const url = new URL(route.request().url());
    // Fulfilled cross-origin responses still go through the browser's CORS checks
    const headers = { "Access-Control-Allow-Origin": "*" };

    if (url.pathname === "/tables/EN0123_1/metadata") {
      await route.fulfill({ json: stemSolarMetadataFixture, headers });
    } else if (url.pathname === "/tables") {
      await route.fulfill({ json: stemTablesFixture, headers });
    } else {
      await route.fulfill({ status: 404, json: {}, headers });
    }
  });
}

/**
 * Opens the goal creation form, adds an External recipe variable, opens the query
 * builder dialog for it and selects the (mocked) STEM data source. Returns the open
 * dialog, which locators should be scoped to: element ids like #nextButton also
 * exist in the goal form behind the dialog.
 */
async function openQueryBuilder(page: Page) {
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  await page.getByTestId("create-button").click();
  await page.getByTestId("create-goal").click();
  await page.waitForLoadState("networkidle");

  await page.locator("#parent-roadmap").click();
  // Match "Rikets färdplan" version 2 specifically, to avoid selecting the wrong roadmap (mirrors recipe-tests).
  await page.locator("#parent-roadmap-dialog-listbox li")
    .filter({ hasText: "Rikets färdplan" })
    .filter({ hasText: "2" })
    .click();

  await page.getByRole("radio", { name: "goal.custom_recipe" }).check();

  // Create an External variable via the variable creator popover (mirrors recipe-tests).
  await page.getByRole("button", { name: "copy_and_scale.add_variable" }).first().click();
  const variablePopover = page.locator("#add-variable-popover").first();
  await variablePopover.locator("#variable-name").fill("ext");
  await variablePopover.locator(`input[name="variable-type"][value="${RecipeDataTypes.External}"]`).check();
  await variablePopover.getByRole("button", { name: "recipe_editor.create_variable" }).click();

  // Open the query builder from the Variables tab.
  await page.getByRole("tab", { name: "recipe_editor.variables", exact: true }).click();
  await page.getByRole("button", { name: "recipe_editor.add_external_data" }).click();

  const dialog = page.locator("dialog[open]", { has: page.locator("#externalDataset") });
  await dialog.locator("#externalDataset").selectOption("STEM");
  return dialog;
}

test.describe("Query builder", () => {
  test.use({ storageState: adminFile });

  test("Search and filter panel narrow the table catalog", async ({ page }) => {
    await mockStemApi(page);
    const dialog = await openQueryBuilder(page);

    const tableList = dialog.locator("#tablesList li");
    await expect(tableList).toHaveCount(4);
    await expect(dialog.getByText("query_builder.showing_table_count")).toBeVisible();

    // Free-text search filters the list live.
    const searchInput = dialog.locator('input[name="tableSearch"]');
    await searchInput.fill("solcell");
    await expect(tableList).toHaveCount(1);
    await expect(tableList.first()).toContainText("EN0123_1");
    await searchInput.fill("");
    await expect(tableList).toHaveCount(4);

    // Open the filter panel. WebKit intermittently reports the summary as "not
    // stable" for >5s while the dialog's panes settle, so wait and allow retries.
    const filtersSummary = dialog.locator("summary", { hasText: "query_builder.filters" });
    await expect(filtersSummary).toBeVisible();
    await filtersSummary.click({ timeout: 15_000 });

    // Variable facet: the contents placeholder is not offered, and selecting
    // "Region" narrows the list to the only table containing that variable.
    await dialog.locator("#tableVariableFilter").click();
    const facetListbox = dialog.locator("#tableVariableFilter-dialog-listbox");
    await expect(facetListbox.locator("li").first()).toBeVisible();
    await expect(facetListbox).not.toContainText("ApiContentsVariableName");
    await facetListbox.locator("li", { hasText: "Region (1)" }).click({ timeout: 15_000 });
    // Close the combobox dropdown by moving focus elsewhere (Escape would close the whole <dialog>).
    await searchInput.click();
    await expect(tableList).toHaveCount(1);
    await expect(tableList.first()).toContainText("EN0123_1");

    // Clearing restores the full catalog and resets the combobox.
    await dialog.getByRole("button", { name: "query_builder.clear_filters" }).click();
    await expect(tableList).toHaveCount(4);
    await expect(dialog.locator("#tableVariableFilter")).toContainText("query_builder.any_variable");

    // Time resolution facet.
    const timeUnitSelect = dialog.locator("label", { hasText: "query_builder.filter_by_time_unit" }).locator("select");
    await timeUnitSelect.selectOption("Quarterly");
    await expect(tableList).toHaveCount(1);
    await expect(tableList.first()).toContainText("EN0307_6");
    await timeUnitSelect.selectOption("");

    // Coverage year facet: only tables whose period range includes the year remain.
    const yearInput = dialog.locator("label", { hasText: "query_builder.filter_has_data_for_year" }).locator("input");
    await yearInput.fill("2012");
    await expect(tableList).toHaveCount(2);
    await expect(dialog.locator("#tablesList")).toContainText("EN0124_3");
    await expect(dialog.locator("#tablesList")).toContainText("EN0202_A");
  });

  test("Single-metric table auto-selects its metric and unlocks the variable selects", async ({ page }) => {
    await mockStemApi(page);
    const dialog = await openQueryBuilder(page);

    await dialog.locator('#tablesList input[type="radio"][value="EN0123_1"]').check();

    // The only metric is auto-selected and shown as text instead of a dropdown;
    // the select stays in the DOM (hidden) since queries are built from select values.
    const metricSelect = dialog.locator("select.metric");
    await expect(metricSelect).toBeHidden();
    await expect(metricSelect).toHaveValue("N");
    await expect(dialog.locator("span", { hasText: "Antal anläggningar" })).toBeVisible();

    // The placeholder dimension name is replaced with a readable label.
    await expect(dialog.getByText("query_builder.contents_variable")).toBeVisible();
    await expect(dialog.getByText("ApiContentsVariableName")).toHaveCount(0);

    // Regression: the variable fieldset used to stay disabled forever when the
    // metric was auto-selected, since nothing fired its change handler.
    await expect(dialog.locator("select#Region")).toBeEnabled();
    await expect(dialog.locator("select#Tid")).toBeEnabled();
    await dialog.locator("select#Region").selectOption("0180");
  });

  test("Changing form page scrolls the dialog back to the top", async ({ page }) => {
    // A short viewport guarantees the dialog body actually scrolls.
    await page.setViewportSize({ width: 1280, height: 600 });
    await mockStemApi(page);
    const dialog = await openQueryBuilder(page);

    // Select a table so the dialog's FormWrapper has a second page to move to.
    await dialog.locator('#tablesList input[type="radio"][value="EN0123_1"]').check();
    await expect(dialog.locator("select#Region")).toBeEnabled();

    // Scroll the dialog's scroll container down, using the same nearest-scrollable-
    // ancestor walk as FormWrapper itself (the container's class name is hashed).
    const scrolledDown = await page.evaluate(() => {
      const slide = document.querySelector("dialog[open] .fieldsetWrapper");
      let element = slide?.parentElement?.parentElement ?? null;
      while (element && element.scrollHeight <= element.clientHeight) element = element.parentElement;
      if (!element) return null;
      element.scrollTop = element.scrollHeight;
      return element.scrollTop;
    });
    expect(scrolledDown).toBeGreaterThan(0);

    await dialog.locator("#nextButton").click();

    const scrollTopAfterPageChange = await page.evaluate(() => {
      const slide = document.querySelector("dialog[open] .fieldsetWrapper");
      let element = slide?.parentElement?.parentElement ?? null;
      while (element && element.scrollHeight <= element.clientHeight) element = element.parentElement;
      return element ? element.scrollTop : null;
    });
    expect(scrollTopAfterPageChange).toBe(0);
  });
});
