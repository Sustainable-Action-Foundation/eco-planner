import { expect, test } from "playwright/test";
import type { Page } from "playwright/test";
import path from "node:path";
import { cwd } from "node:process";
import { RecipeDataTypes } from "../../src/functions/recipe/types/enums";
import { Recipe } from "../../src/functions/recipe/recipe";
import { pickSingleSearchOption, visible } from "../lib/forms";
import { mockScbApi, mockStemApi, STEM_API_ORIGIN } from "../lib/mocks";
import { stemSolarMetadataFixture, stemTablesFixture } from "../lib/stemFixtures";

/*
 * The external-data query builder (a recipe variable's dialog) and the
 * external selection panel of the goal form's historical section, against
 * mocked PxWeb catalogs. Only the browser-side calls (table list, metadata)
 * can be intercepted; the table-content fetch is a "use server" action, so
 * nothing here asserts on fetched values.
 */

const adminFile = path.join(cwd(), "tests/.auth/admin.json");

/**
 * Opens the goal creation form, adds an External recipe variable, opens the
 * query builder dialog for it and selects the given data source. Returns the
 * open dialog, which locators should be scoped to: element ids like #nextButton
 * also exist in the goal form behind the dialog.
 */
async function openQueryBuilder(page: Page, source: "STEM" | "SCB" = "STEM") {
  await page.goto("/goal/create");
  await visible(page, "form").getByRole("radio", { name: "goal.custom_recipe" }).check();

  // Create an External variable via the variable creator popover
  await visible(page, "form").getByRole("button", { name: "copy_and_scale.add_variable" }).click();
  const variablePopover = visible(page, "#add-variable-popover");
  await variablePopover.locator("#variable-name").fill("ext");
  await variablePopover.locator(`input[name="variable-type"][value="${RecipeDataTypes.External}"]`).check();
  await variablePopover.getByRole("button", { name: "recipe_editor.create_variable" }).click();

  // Open the query builder from the Variables tab
  await visible(page, "form").getByRole("tab", { name: "recipe_editor.variables", exact: true }).click();
  await visible(page, "form").getByRole("button", { name: "recipe_editor.add_external_data" }).click();

  const dialog = page.locator("dialog[open]", { has: page.locator("#externalDataset") });
  await dialog.locator("#externalDataset").selectOption(source);
  return dialog;
}

/** The serialized recipe the visible goal form would submit for its historical section */
async function historicalRecipe(page: Page): Promise<Recipe | null> {
  // Hidden inputs can't be filtered by visibility; scope to the visible page instead
  const value = await visible(page, 'form[name="goalForm"]').locator('input[name="HISTORICAL_RECIPE"]:enabled').inputValue();
  return value ? Recipe.deserialize(value) : null;
}

test.describe("Query builder", () => {
  test.use({ storageState: adminFile });

  test("Search and filter panel narrow the table catalog", async ({ page }) => {
    await mockStemApi(page);
    const dialog = await openQueryBuilder(page);

    const tableList = dialog.locator("#tablesList li");
    await expect(tableList).toHaveCount(4);
    await expect(dialog.getByText("query_builder.showing_table_count")).toBeVisible();

    // Free-text search filters the list live
    const searchInput = dialog.locator('input[name="tableSearch"]');
    await searchInput.fill("solcell");
    await expect(tableList).toHaveCount(1);
    await expect(tableList).toContainText("EN0123_1");
    await searchInput.fill("");
    await expect(tableList).toHaveCount(4);

    const filtersSummary = dialog.locator("summary", { hasText: "query_builder.filters" });
    await expect(filtersSummary).toBeVisible();
    await filtersSummary.click();

    // Variable facet: the contents placeholder is not offered, and selecting
    // "Region" narrows the list to the only table containing that variable
    await dialog.locator("#tableVariableFilter").click();
    const facetListbox = dialog.locator("#tableVariableFilter-dialog-listbox");
    await expect(facetListbox.locator("li").first()).toBeVisible();
    await expect(facetListbox).not.toContainText("ApiContentsVariableName");
    await facetListbox.locator("li", { hasText: "Region (1)" }).click();
    // Close the combobox dropdown by moving focus elsewhere (Escape would close the whole <dialog>)
    await searchInput.click();
    await expect(tableList).toHaveCount(1);
    await expect(tableList).toContainText("EN0123_1");

    // Clearing restores the full catalog and resets the combobox
    await dialog.getByRole("button", { name: "query_builder.clear_filters" }).click();
    await expect(tableList).toHaveCount(4);
    await expect(dialog.locator("#tableVariableFilter")).toContainText("query_builder.any_variable");

    // Time resolution facet
    const timeUnitSelect = dialog.locator("label", { hasText: "query_builder.filter_by_time_unit" }).locator("select");
    await timeUnitSelect.selectOption("Quarterly");
    await expect(tableList).toHaveCount(1);
    await expect(tableList).toContainText("EN0307_6");
    await timeUnitSelect.selectOption("");

    // Coverage year facet: only tables whose period range includes the year remain
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
    // the select stays in the DOM (hidden) since queries are built from select values
    const metricSelect = dialog.locator("select.metric");
    await expect(metricSelect).toBeHidden();
    await expect(metricSelect).toHaveValue("N");
    await expect(dialog.locator("span", { hasText: "Antal anläggningar" })).toBeVisible();

    // The placeholder dimension name is replaced with a readable label
    await expect(dialog.getByText("query_builder.contents_variable")).toBeVisible();
    await expect(dialog.getByText("ApiContentsVariableName")).toHaveCount(0);

    // Regression: the variable fieldset used to stay disabled forever when the
    // metric was auto-selected, since nothing fired its change handler
    await expect(dialog.locator("select#Region")).toBeEnabled();
    await expect(dialog.locator("select#Tid")).toBeEnabled();
    await dialog.locator("select#Region").selectOption("0180");
  });

  test("SCB catalog: search narrows, the population table unlocks region and year", async ({ page }) => {
    await mockScbApi(page);
    const dialog = await openQueryBuilder(page, "SCB");

    const tableList = dialog.locator("#tablesList li");
    await expect(tableList).toHaveCount(2);
    await dialog.locator('input[name="tableSearch"]').fill("Folkmängden");
    await expect(tableList).toHaveCount(1);
    await expect(tableList).toContainText("TAB628");

    await dialog.locator('#tablesList input[type="radio"][value="TAB628"]').check();
    const metricSelect = dialog.locator("select.metric");
    await expect(metricSelect).toBeHidden();
    await expect(metricSelect).toHaveValue("BE0101N1");
    await expect(dialog.locator("span", { hasText: "Folkmängd" })).toBeVisible();
    await expect(dialog.locator("select#Region")).toBeEnabled();
    await expect(dialog.locator("select#Tid")).toBeEnabled();
    await expect(dialog.locator("select#Region option")).toHaveCount(4);
    await dialog.locator("select#Region").selectOption("2582");
  });

  test("A rate-limited catalog keeps the dialog loading and is retried after the back-off", async ({ page }) => {
    // The mock is read per request, so the status can be lifted mid-test
    const mock = { tables: stemTablesFixture, metadata: { EN0123_1: stemSolarMetadataFixture }, status: 429 as number | undefined };
    await mockStemApi(page, mock);
    const rateLimited = page.waitForResponse(res => res.url().startsWith(STEM_API_ORIGIN) && res.status() === 429, { timeout: 60_000 });
    const dialog = await openQueryBuilder(page);
    await rateLimited;

    // No catalog, no count line, and the loading state keeps the close button disabled while the fetch is retried
    const tableList = dialog.locator("#tablesList li");
    await expect(tableList).toHaveCount(0);
    await expect(dialog.getByText("query_builder.showing_table_count")).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "tsx.close" })).toBeDisabled();

    // The client waits 10 s and asks again; once the API answers, the catalog appears
    mock.status = undefined;
    await expect(tableList).toHaveCount(4, { timeout: 25_000 });
    await expect(dialog.getByRole("button", { name: "tsx.close" })).toBeEnabled();
  });

  test("Changing form page scrolls the dialog back to the top", async ({ page }) => {
    // A short viewport guarantees the dialog body actually scrolls
    await page.setViewportSize({ width: 1280, height: 600 });
    await mockStemApi(page);
    const dialog = await openQueryBuilder(page);

    // Select a table so the dialog's FormWrapper has a second page to move to
    await dialog.locator('#tablesList input[type="radio"][value="EN0123_1"]').check();
    await expect(dialog.locator("select#Region")).toBeEnabled();

    // Scroll the dialog's scroll container down, using the same nearest-scrollable-
    // ancestor walk as FormWrapper itself (the container's class name is hashed)
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

test.describe("External selection feedback (goal form historical section)", () => {
  test.use({ storageState: adminFile });

  test("The status line names what is missing, and an unfinished or cleared selection leaves the recipe empty", async ({ page }) => {
    await mockStemApi(page);
    await page.goto("/goal/create");
    await page.getByTestId("historical-section-toggle").filter({ visible: true }).click();
    await visible(page, 'input[name="historical-data-type"][value="EXTERNAL"]').check();
    await visible(page, "#externalDataset").selectOption("STEM");
    await pickSingleSearchOption(page, "externalTableId", "Nätanslutna solcellsanläggningar");

    // The single metric and the first period are preselected; the status line names the region, the
    // only required dimension left (the optional ones are not required). Completing the selection would
    // fetch the table content through a server action against the live API, so the flow stops here.
    const status = visible(page, 'p[role="status"]');
    await expect(status).toContainText("query_builder.selection_incomplete");
    await expect(status).toContainText("Region");
    await expect(visible(page, "select#ContentsCode")).toHaveValue("N");
    await expect(visible(page, "select#Tid")).toHaveAttribute("required", "");
    await expect(visible(page, "select#Region")).toHaveAttribute("required", "");
    await expect(visible(page, "select#Effektklass")).not.toHaveAttribute("required", "");
    await expect(visible(page, "select#Kategori")).not.toHaveAttribute("required", "");

    // Nothing of an unfinished selection reaches the recipe
    const partial = await historicalRecipe(page);
    expect(partial === null || partial.isEmpty(), "an unfinished selection must not become the recipe").toBe(true);

    // Clearing the source removes the selection and its status line; the recipe stays empty
    await visible(page, "#externalDataset").selectOption("");
    await expect(status).toHaveCount(0);
    await expect(visible(page, "select#Region")).toHaveCount(0);
    const cleared = await historicalRecipe(page);
    expect(cleared === null || cleared.isEmpty(), "a cleared selection must leave the recipe empty").toBe(true);
  });
});
