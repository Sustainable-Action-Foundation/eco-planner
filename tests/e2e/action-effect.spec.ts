import { expect, test } from "playwright/test";
import type { Page } from "playwright/test";
import path from "node:path";
import { cwd } from "node:process";

const adminFile = path.join(cwd(), "tests/.auth/admin.json");

/** The repeatable descriptive-field rows of the action form: one <details> accordion per group. */
function actionFieldRows(page: Page) {
  return page.getByTestId('action-field-row');
}

/** The rows are collapsed <details>; open them all so their inputs become visible/fillable */
async function openActionFieldRows(page: Page) {
  await actionFieldRows(page).evaluateAll(rows => rows.forEach(row => row.setAttribute('open', '')));
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
 * New actions start with no rows; a header without a row gets a new row added for it.
 */
async function fillActionField(page: Page, header: string, value: string) {
  await openActionFieldRows(page);
  const rows = actionFieldRows(page);
  const headers = await rows.getByTestId('action-field-header').evaluateAll(els => els.map(el => (el as HTMLInputElement).value));
  let index = headers.indexOf(header);
  if (index === -1) {
    await page.getByRole('button', { name: 'data_series_input.add_new_row' }).click();
    await openActionFieldRows(page);
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

      await page.goto('/?org=public');
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
    // The public view: logged-in org members land on their org's page by default,
    // which only lists that org's own content
    await page.goto('/?org=public');
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
    // The public view: logged-in org members land on their org's page by default,
    // which only lists that org's own content
    await page.goto('/?org=public');
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
    // The public view: logged-in org members land on their org's page by default,
    // which only lists that org's own content
    await page.goto('/?org=public');
    await page.getByRole('link', { name: "Rikets färdplan" }).click();
    await page.getByRole('heading', { name: "Rikets färdplan" }).hover();
    await page.getByRole('link', { name: actionNameAllFields }).first().click();

    await page.waitForLoadState("networkidle");
    await page.getByRole('heading', { name: actionNameAllFields }).hover();
    await page.getByTestId("admin-panel-edit").click();

    await expect(page.locator('#actionName')).toHaveValue(actionNameAllFields);

    // All descriptive fields were saved;
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
    // The public view: logged-in org members land on their org's page by default,
    // which only lists that org's own content
    await page.goto('/?org=public');
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
    // The public view: logged-in org members land on their org's page by default,
    // which only lists that org's own content
    await page.goto('/?org=public');
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
    // The public view: logged-in org members land on their org's page by default,
    // which only lists that org's own content
    await page.goto('/?org=public');
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
  test("Field order persists as entered", async ({ page }, testInfo) => {
    // Entry order is the persisted order (the fields' `order` column): groups keep
    // their sequence and repeated values render as a list in entry order.
    // TODO: When reordering controls land in the accordion UI, cover them here too.
    const name = `Test Ordered Action  ${testInfo.project.name}`;

    await page.goto('/');
    await page.getByTestId("create-button").click();
    await page.getByTestId("create-action").click();

    const option = page.locator('#iterationId option').filter({ hasText: 'Rikets färdplan' }).filter({ hasText: 'v2' });
    await page.locator('#iterationId').selectOption(await option.getAttribute('value'));
    await page.locator('#actionName').fill(name);

    // Groups are added in this entry order: COST_EFFICIENCY, EXPECTED_OUTCOME, RELEVANT_ACTORS
    await fillActionField(page, 'COST_EFFICIENCY', "CE text");
    await fillActionField(page, 'EXPECTED_OUTCOME', "EO text");
    await fillActionField(page, 'RELEVANT_ACTORS', "Actor B");
    // A second value in the actors group becomes a list item after the first.
    // Lists need a non-paragraph type, and new rows default to paragraph.
    await actionFieldRows(page).nth(2).getByRole('radio', { name: 'action.field_types.short' }).check();
    await actionFieldRows(page).nth(2).getByRole('button', { name: 'action.add_list_item' }).click();
    await actionFieldRows(page).nth(2).getByTestId('action-field-value').nth(1).fill("Actor A");

    await page.locator('#submit-button').click();
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole('heading', { name })).toBeVisible();

    // Display: groups appear in entry order, list values in entry order (B before A).
    // These headers are no longer canonical, so they render verbatim rather than translated.
    const mainText = (await page.locator('main').textContent())?.replace(/\s+/g, ' ') ?? '';
    const ce = mainText.indexOf('COST_EFFICIENCY');
    const eo = mainText.indexOf('EXPECTED_OUTCOME');
    const ra = mainText.indexOf('RELEVANT_ACTORS');
    expect(ce).toBeGreaterThan(-1);
    expect(eo).toBeGreaterThan(ce);
    expect(ra).toBeGreaterThan(eo);
    const listItems = await page.locator('main ul li').allTextContents();
    expect(listItems.indexOf('Actor B')).toBeGreaterThan(-1);
    expect(listItems.indexOf('Actor B')).toBeLessThan(listItems.indexOf('Actor A'));

    // Edit round-trip: same group order, same value order within the list
    await page.getByTestId("admin-panel-edit").click();
    await expect(actionFieldRows(page).first()).toBeVisible();
    const headers = await actionFieldRows(page).getByTestId('action-field-header').evaluateAll(els => els.map(el => (el as HTMLInputElement).value));
    expect(headers).toEqual(['COST_EFFICIENCY', 'EXPECTED_OUTCOME', 'RELEVANT_ACTORS']);
    const actorValues = await actionFieldRows(page).nth(2).getByTestId('action-field-value').evaluateAll(els => els.map(el => (el as HTMLInputElement | HTMLTextAreaElement).value));
    expect(actorValues).toEqual(['Actor B', 'Actor A']);
  });

  // Effect tests begin here //  
});