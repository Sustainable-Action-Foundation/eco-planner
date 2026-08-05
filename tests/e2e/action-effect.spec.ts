import { expect, test } from "playwright/test";
import type { Page } from "playwright/test";
import path from "node:path";
import { cwd } from "node:process";

const adminFile = path.join(cwd(), "tests/.auth/admin.json");

/** The repeatable descriptive-field rows of the action form (header combobox + type select + value control). */
function actionFieldRows(page: Page) {
  return page.getByTestId('action-field-row');
}

/** Reads the action form's descriptive fields as a header -> value record.
 * The value control varies with the row's field type (textarea or input), so both go through the testid. */
async function readActionFields(page: Page): Promise<Record<string, string>> {
  const pairs = await actionFieldRows(page).evaluateAll(rows => rows.map((row): [string, string] => [
    row.querySelector<HTMLInputElement>('[data-testid="action-field-header"]')?.value ?? '',
    row.querySelector<HTMLInputElement | HTMLTextAreaElement>('[data-testid="action-field-value"]')?.value ?? '',
  ]));
  return Object.fromEntries(pairs);
}

/**
 * Fills the value of the descriptive-field row with the given header (e.g. "COST_EFFICIENCY").
 * New actions come pre-seeded with rows for the canonical headers; any other header
 * gets a new row added for it.
 */
async function fillActionField(page: Page, header: string, value: string) {
  const rows = actionFieldRows(page);
  const headers = await rows.getByTestId('action-field-header').evaluateAll(els => els.map(el => (el as HTMLInputElement).value));
  let index = headers.indexOf(header);
  if (index === -1) {
    await page.getByRole('button', { name: 'data_series_input.add_new_row' }).click();
    index = headers.length;
    await rows.nth(index).getByTestId('action-field-header').fill(header);
  }
  await rows.nth(index).getByTestId('action-field-value').fill(value);
}

test.describe.serial("Action & Effect tests", () => {
  test.use({ storageState: adminFile });
  let actionNameRequiredFields = "";
  let actionNameRequiredFieldsUpdated = "";
  let actionNameAllFields = "";
  let actionNameAllFieldsUpdated = "";
  let roadmapActionNameRequiredFields = "";
  let roadmapActionNameAllFields = "";

  test.beforeAll(async ({ browser }, testInfo) => {
    actionNameAllFields = `Test Action All Fields  ${testInfo.project.name}`;

    if (testInfo.retry > 0) {
      console.info(`Retrying tests, Cleaning up any existing action with name ${actionNameAllFields} before retrying.`);

      const context = await browser.newContext({ storageState: adminFile });
      const page = await context.newPage();

      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Count how many matching items exist
      const matchingItems = page.locator('li').filter({ hasText: actionNameAllFields });
      const count = await matchingItems.count();

      // Delete all matching items
      for (let i = 0; i < count; i++) {
        // firstMatch is the row that all the actions need to be performed on since after each deletion the next item will move up to take its place.
        const firstMatch = matchingItems.first();

        // All of these actions need to be performed on the correct row so they are using firstMatch as the base locator.
        await firstMatch.locator('svg').nth(1).click();
        await firstMatch.getByTestId('delete-post').click();
        await firstMatch.locator('input[placeholder]').fill(actionNameAllFields);
        await firstMatch.locator('[type="submit"]').click();

        await page.waitForLoadState('networkidle');
      }

      // Verify all are gone
      await expect(matchingItems).toHaveCount(0);
    }
  });


  // Action tests begin here //
  test("Create Action - required", async ({ page }, testInfo) => {
    actionNameRequiredFields = `Test Action  ${testInfo.project.name}`;
    // Navigate to the action creation form
    await page.goto('/');
    await page.getByTestId("create-button").click();
    await page.getByTestId("create-action").click();

    const option = page.locator('#iterationId option').filter({ hasText: 'Rikets färdplan' }).filter({ hasText: 'v2' }); // Checks for Rikets färdplan to be contained in an option, with version 2 to avoid selecting the wrong roadmap

    const value = await option.getAttribute('value');

    await page.locator('#iterationId').selectOption(value);

    await page.locator('#actionName').fill(actionNameRequiredFields);

    await page.locator('#submit-button').hover();
    await page.locator('#submit-button').click();

    await page.waitForLoadState("networkidle");

    await expect(page.getByRole('heading', { name: actionNameRequiredFields })).toBeVisible();
  });

  test("No edit Action - required", async ({ page }) => {
    // Navigate to the action edit form
    await page.goto('/');
    await page.getByRole('link', { name: "Rikets färdplan" }).click();
    await page.getByRole('heading', { name: "Rikets färdplan" }).hover();
    await page.getByRole('link', { name: actionNameRequiredFields }).first().click();
    await page.waitForLoadState("networkidle");
    await page.getByRole('heading', { name: actionNameRequiredFields }).hover();
    await page.getByTestId("admin-panel-edit").click();


    await page.locator('#actionName').hover(); // This is needed to make sure the name field is loaded before checking its content, otherwise it will be empty and the test will fail.        

    await expect(page.locator('#actionName')).toHaveValue(actionNameRequiredFields);

    await page.locator('#submit-button').click();

    await expect(page.getByRole('heading', { name: actionNameRequiredFields })).toBeVisible();
  });

  test("Edit Action - required", async ({ page }, testInfo) => {
    actionNameRequiredFieldsUpdated = `Test Updated Action  ${testInfo.project.name}`;
    // Navigate to the action edit form
    await page.goto('/');
    await page.getByRole('link', { name: "Rikets färdplan" }).click();
    await page.getByRole('heading', { name: "Rikets färdplan" }).hover();
    await page.getByRole('link', { name: actionNameRequiredFields }).first().click(); // TODO (fix): The tests doesn't seem to click on the right name here and therefore they fail.

    await page.getByRole('heading', { name: actionNameRequiredFields }).hover();
    await page.waitForLoadState("networkidle");
    await page.getByTestId("admin-panel-edit").click();

    // Update the name
    await page.locator('#actionName').fill(actionNameRequiredFieldsUpdated);
    await page.locator('#actionName').blur(); // This is needed to make sure the name field is loaded before filling it, otherwise it will be empty and the test will fail.

    // The description has its own dedicated input rather than a field row
    await page.locator('#action-description').fill("Test Action Updated description.");

    // These two fields are required to be numbers
    await page.locator('#startYear').fill("2025");
    await page.locator('#endYear').fill("2070");

    // Submit the form
    await page.locator('#submit-button').click();

    await expect(page.getByRole('heading', { name: actionNameRequiredFieldsUpdated })).toBeVisible();
  });

  test("Create Action - All Fields", async ({ page }, testInfo) => {
    actionNameAllFields = `Test Action All Fields  ${testInfo.project.name}`;
    // Navigate to the action edit form
    await page.goto('/');
    await page.getByTestId("create-button").click();
    await page.getByTestId("create-action").click();

    const option = page.locator('#iterationId option').filter({ hasText: 'Rikets färdplan' }).filter({ hasText: 'v2' }); // Checks for Rikets färdplan to be contained in an option, with version 2 to avoid selecting the wrong roadmap

    const value = await option.getAttribute('value');

    await page.locator('#iterationId').selectOption(value);

    // Name and descriptive fields; the canonical rows are pre-seeded, PROJECT_MANAGER gets a new row.
    // The description has its own dedicated input rather than a field row.
    await page.locator('#actionName').fill(actionNameAllFields);
    await page.locator('#action-description').fill("Test Action description.");

    await fillActionField(page, 'COST_EFFICIENCY', "Text for cost efficiency");
    await fillActionField(page, 'EXPECTED_OUTCOME', "Text for expected outcome");
    await fillActionField(page, 'RELEVANT_ACTORS', "Test Actor");
    await fillActionField(page, 'PROJECT_MANAGER', "Test Manager");

    // These two fields are required to be numbers
    await page.locator('#startYear').fill("2030");
    await page.locator('#endYear').fill("2070");

    // Submit the form
    await page.locator('#submit-button').hover();
    await page.locator('#submit-button').click();

    await page.waitForLoadState("networkidle");

    await expect(page.getByRole('heading', { name: actionNameAllFields })).toBeVisible();
  });

  test("No edit Action - All Fields", async ({ page }) => {
    // Navigate to the action edit form
    await page.goto('/');
    await page.getByRole('link', { name: "Rikets färdplan" }).click();
    await page.getByRole('heading', { name: "Rikets färdplan" }).hover();
    await page.getByRole('link', { name: actionNameAllFields }).first().click();

    await page.waitForLoadState("networkidle");
    await page.getByRole('heading', { name: actionNameAllFields }).hover();
    await page.getByTestId("admin-panel-edit").click();

    await expect(page.locator('#actionName')).toHaveValue(actionNameAllFields);

    // All descriptive fields were saved (empty pre-seeded rows are dropped on submit);
    // the description loads into its dedicated input rather than a field row
    await expect(page.locator('#action-description')).toHaveValue("Test Action description.");
    await expect(actionFieldRows(page)).toHaveCount(4);
    const savedFields = await readActionFields(page);
    expect(savedFields['COST_EFFICIENCY']).toBe("Text for cost efficiency");
    expect(savedFields['EXPECTED_OUTCOME']).toBe("Text for expected outcome");
    expect(savedFields['RELEVANT_ACTORS']).toBe("Test Actor");
    expect(savedFields['PROJECT_MANAGER']).toBe("Test Manager");

    await expect(page.locator('#startYear')).toHaveValue("2030");
    await expect(page.locator('#endYear')).toHaveValue("2070");

    // Submit the form without making any changes
    await page.locator('#submit-button').click();

    await page.waitForLoadState("networkidle");

    await expect(page.getByTestId("admin-panel-edit")).toBeVisible();
  });

  test("Edit Action - All Fields", async ({ page }, testInfo) => {
    actionNameAllFieldsUpdated = `Test Action Updated All Fields  ${testInfo.project.name}`;
    // Navigate to the action edit form
    await page.goto('/');
    await page.getByRole('link', { name: "Rikets färdplan" }).click();
    await page.getByRole('heading', { name: "Rikets färdplan" }).hover();
    await page.getByRole('link', { name: actionNameAllFields }).first().click();

    await page.waitForLoadState("networkidle");
    await page.getByRole('heading', { name: actionNameAllFields }).hover();
    await page.getByTestId("admin-panel-edit").click();

    // Update the name and every descriptive field; the description has its own dedicated input
    await page.locator('#actionName').fill(actionNameAllFieldsUpdated);
    await page.locator('#action-description').fill("Test Action Updated description.");

    await fillActionField(page, 'COST_EFFICIENCY', "Updated text for cost efficiency");
    await fillActionField(page, 'EXPECTED_OUTCOME', "Updated text for expected outcome");
    await fillActionField(page, 'RELEVANT_ACTORS', "Updated Test Actor");
    await fillActionField(page, 'PROJECT_MANAGER', "Updated Test Manager");

    // These two fields are required to be numbers
    await page.locator('#startYear').fill("2026");
    await page.locator('#endYear').fill("2071");

    // Submit the form
    await page.locator('#submit-button').click();

    await page.waitForLoadState("networkidle");

    // Verify that everything is updated correctly
    await page.getByTestId("admin-panel-edit").click();

    await expect(page.locator('#actionName')).toHaveValue(actionNameAllFieldsUpdated);

    await expect(page.locator('#action-description')).toHaveValue("Test Action Updated description.");
    await expect(actionFieldRows(page)).toHaveCount(4);
    const updatedFields = await readActionFields(page);
    expect(updatedFields['COST_EFFICIENCY']).toBe("Updated text for cost efficiency");
    expect(updatedFields['EXPECTED_OUTCOME']).toBe("Updated text for expected outcome");
    expect(updatedFields['RELEVANT_ACTORS']).toBe("Updated Test Actor");
    expect(updatedFields['PROJECT_MANAGER']).toBe("Updated Test Manager");

    await expect(page.locator('#startYear')).toHaveValue("2026");
    await expect(page.locator('#endYear')).toHaveValue("2071");
  });

  test("Create Action from Roadmap - required", async ({ page }, testInfo) => {
    roadmapActionNameRequiredFields = `Test Action from Roadmap  ${testInfo.project.name}`;
    // Navigate to the action edit form
    await page.goto('/');
    await page.getByRole('link', { name: "Rikets färdplan" }).click();
    await page.getByTestId("admin-panel-new-action").click();

    await page.locator('#actionName').fill(roadmapActionNameRequiredFields);

    await page.locator('#submit-button').click();

    await page.waitForLoadState("networkidle");

    await expect(page.getByRole('heading', { name: roadmapActionNameRequiredFields })).toBeVisible();
  });

  test("Create Action from Roadmap - All Fields", async ({ page }, testInfo) => {
    roadmapActionNameAllFields = `Test Action from Roadmap All Fields  ${testInfo.project.name}`;
    // Navigate to the action edit form
    await page.goto('/');
    await page.getByRole('link', { name: "Rikets färdplan" }).click();
    await page.getByTestId("admin-panel-new-action").click();

    // Name and descriptive fields; the canonical rows are pre-seeded, PROJECT_MANAGER gets a new row.
    // The description has its own dedicated input rather than a field row.
    await page.locator('#actionName').fill(roadmapActionNameAllFields);
    await page.locator('#action-description').fill("Test Action description.");

    await fillActionField(page, 'COST_EFFICIENCY', "Text for cost efficiency");
    await fillActionField(page, 'EXPECTED_OUTCOME', "Text for expected outcome");
    await fillActionField(page, 'RELEVANT_ACTORS', "Test Actor");
    await fillActionField(page, 'PROJECT_MANAGER', "Test Manager");

    // These two fields are required to be numbers
    await page.locator('#startYear').fill("2030");
    await page.locator('#endYear').fill("2070");

    // Submit the form
    await page.locator('#submit-button').click();

    await page.waitForLoadState("networkidle");

    await expect(page.getByRole('heading', { name: roadmapActionNameAllFields })).toBeVisible();
  });
  // Effect tests begin here //  
});