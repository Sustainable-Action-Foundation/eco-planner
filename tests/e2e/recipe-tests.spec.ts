import { expect, test } from "playwright/test";
import type { Locator, Page } from "playwright/test";
import path from "node:path";
import { cwd } from "node:process";
import { RecipeDataTypes } from "../../src/functions/recipe/types/enums";

const adminFile = path.join(cwd(), "tests/.auth/admin.json");

/** Opens the goal creation form and selects "Rikets färdplan" version 2 as the parent roadmap. */
async function openGoalForm(page: Page) {
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  await page.getByTestId("create-button").click();
  await page.getByTestId("create-goal").click();
  await page.waitForLoadState("networkidle");

  await page.locator("#parent-roadmap").click();
  // Match "Rikets färdplan" version 2 specifically, to avoid selecting the wrong roadmap (mirrors goals-tests).
  await page.locator("#parent-roadmap-dialog-listbox li")
    .filter({ hasText: "Rikets färdplan" })
    .filter({ hasText: "2" })
    .click();
}

/**
 * Selects the first available data series in a SelectSingleTree combobox by drilling
 * roadmap -> goal -> data series, then closes the dropdown. Seeded national goals always
 * have a data series, so the first-of-each chain resolves to a valid leaf.
 */
async function pickFirstDataSeries(page: Page, combobox: Locator) {
  await combobox.click();
  const id = await combobox.getAttribute("id");
  if (!id) throw new Error("Data series combobox has no id");

  const tree = page.locator(`#${id}-dialog-tree`);
  await tree.locator("> li").first().click(); // expand first roadmap
  await tree.locator("> li > ul > li").first().click(); // expand first goal
  await tree.locator("> li > ul > li > ul > li").first().click(); // select first data series leaf

  // Close the dropdown so it doesn't block elements below it.
  await page.keyboard.press("Escape");
}

/**
 * Asserts the recipe evaluated into an actual time series: the editor reports no errors,
 * the resulting-series table is rendered with 4-digit year headers and numeric value cells.
 * When `expectedValue` is given, every value cell must equal it (used where we control the inputs).
 */
async function assertEvaluatedSeries(
  page: Page,
  { expectedValue, minPoints = 1 }: { expectedValue?: string; minPoints?: number } = {},
) {
  // Evaluation succeeded (shown in both suggested and custom modes).
  await expect(page.getByText("recipe_editor.no_errors")).toBeVisible();

  // Resulting series table is rendered.
  const heading = page.getByText("copy_and_scale.resulting_data_series");
  await expect(heading).toBeVisible();

  // The grid sits directly after the heading; first half of its children are year headers,
  // second half are the value cells (see output/dataSeriesDisplay.tsx).
  const grid = heading.locator("xpath=following-sibling::div[1]");
  const cells = grid.locator("> div");
  await expect(cells.first()).toBeVisible();

  const total = await cells.count();
  expect(total % 2).toBe(0);
  const pointCount = total / 2;
  expect(pointCount).toBeGreaterThanOrEqual(minPoints);

  for (let i = 0; i < pointCount; i++) {
    const yearText = (await cells.nth(i).innerText()).trim();
    expect(yearText).toMatch(/^\d{4}$/);
  }

  for (let i = pointCount; i < total; i++) {
    const valueText = (await cells.nth(i).innerText()).trim();
    expect(valueText).not.toBe("-");
    expect(valueText).not.toBe("");
    expect(Number.isFinite(Number(valueText))).toBe(true);
    if (expectedValue !== undefined) expect(valueText).toBe(expectedValue);
  }
}

/**
 * Asserts the recipe evaluated into an actual dated series in flows that no
 * longer render the resulting-series table (e.g. suggested mode, which only
 * shows the status line): the editor reports no errors, and the enabled
 * FormSync hidden output has settled with at least one dated value.
 */
async function assertEvaluatedSeriesViaFormSync(page: Page) {
  await expect(page.getByText("recipe_editor.no_errors")).toBeVisible();
  await expect(page.locator('input[name="RESULTING_DATE_VALUES"]:enabled')).toHaveValue(/\d{4}-01-01/);
}

test.describe("Recipe tests", () => {
  test.use({ storageState: adminFile });

  test("Suggested recipe evaluates a series from a data series", async ({ page }) => {
    await openGoalForm(page);

    // Use a suggested recipe (the scalar preset: parent data series * scalar).
    await page.getByRole("radio", { name: "goal.suggested_inheritance" }).check();
    await page.locator("#select-preset").selectOption("scalar-recipe-dummy-uuid");

    // Choose the data series for the parent value variable.
    await pickFirstDataSeries(page, page.locator("#recipeVariable-parent-value-dummy-uuid"));

    // Provide the scalar factor.
    await page.getByPlaceholder("recipe_editor.scalar").fill("3");

    // The recipe must have evaluated into an actual series. Suggested mode no
    // longer renders the resulting-series table, so assert via the form output.
    await assertEvaluatedSeriesViaFormSync(page);

    // The evaluated series should be accepted on submit (unit/parameter are synced from the recipe).
    await page.locator("#submit-button").click();
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("main")).toContainText("goal.title_label");
  });

  test("Custom recipe editor evaluates a series", async ({ page }) => {
    await openGoalForm(page);

    await page.getByRole("radio", { name: "goal.custom_recipe" }).check();

    // Create a data series variable via the variable creator popover. While the recipe has no
    // variables yet there are two VariableCreators (the tab-menu one and the empty-state one) that
    // share the same popover id, so both buttons open the first popover in the DOM; scope to it.
    await page.getByRole("button", { name: "copy_and_scale.add_variable" }).first().click();
    const variablePopover = page.locator("#add-variable-popover").first();
    await variablePopover.locator("#variable-name").fill("series");
    await variablePopover.locator(`input[name="variable-type"][value="${RecipeDataTypes.DataSeries}"]`).check();
    await variablePopover.getByRole("button", { name: "recipe_editor.create_variable" }).click();

    // Pick a data series for it (on the Variables tab).
    await page.getByRole("tab", { name: "recipe_editor.variables", exact: true }).click();
    await pickFirstDataSeries(page, page.locator('[role="combobox"][id^="recipe-data-series-"]'));

    // Write an equation that subtracts the series from itself -> a known all-zero series.
    await page.getByRole("tab", { name: "recipe_editor.recipe", exact: true }).click();
    // eslint-disable-next-line no-template-curly-in-string -- this is a recipe equation literal, not a JS template
    await page.getByPlaceholder("copy_and_scale.custom_recipe_placeholder").fill("${series} - ${series}");

    // Every evaluated value must be exactly 0.0, proving a real dated series was evaluated.
    await assertEvaluatedSeries(page, { expectedValue: "0.0" });

    await page.locator("#submit-button").click();
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("main")).toContainText("goal.title_label");
  });

  // TODO: External (SCB) data recipes. The decisive table-data fetch is a "use server" action,
  // so it egresses from the app server and cannot be intercepted with page.route. Covering this
  // deterministically needs a Docker SCB stub (env-overridable baseUrl) + page.route for the
  // browser-side tables/metadata calls. Deferred until that mock infra exists.
  test.skip("Suggested recipe evaluates a series from external data", async () => {
    // Intentionally left as a documented stub; see TODO above.
  });
});
