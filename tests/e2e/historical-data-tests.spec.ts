import { test } from "playwright/test";
import path from "node:path";
import { cwd } from "node:process";

const adminFile = path.join(cwd(), "tests/.auth/admin.json");

test.describe("Historical Data Tests", () => {
  test.use({ storageState: adminFile });

  test.skip('Add Data Manually', async ({ page }) => {
    // Navigate to goal and historical data page
    // The public view: logged-in org members land on their org's page by default,
    // which only lists that org's own content
    await page.goto('/?org=public');
    await page.waitForLoadState("networkidle");

    await page.getByRole('link', { name: "Rikets färdplan" }).click();
    await page.getByRole('heading', { name: "Rikets färdplan" }).hover();

    // TODO: Don't go to first featured goal, I don't think we guarantee any during seeding.
    // Instead, we should go to the first goal in the list of goals in this test, and the second one in the other test.
    await page.getByTestId('featured-goals').first().click();
    await page.getByTestId('historical-data-link').click();

    // Switch to manual input
    // TODO

    const dataRows = [
      [2025, 200],
      [2026, 250],
      [2027, 275],
      [2028, 300],
      [2029, 325],
    ];

    // Create all rows first
    const insertRowButton = page.getByTestId("add-row-button");
    for (let i = 1; i < dataRows.length; i++) {
      await insertRowButton.click();
    }

    // Set focus inside table to ensure the first cell gets filled properly;
    // without this the test will fail on Firefox and Webkit (but not Chromium) because the first attempt to input data into a cell only sets focus into the table, without successfully filling the cell.
    await page.locator(`[data-row="0"][data-column="1"] input`).focus();
    // Fill all rows (starting at row 1)
    for (let row = 0; row < dataRows.length; row++) {
      const [year, value] = dataRows[row];
      await page.locator(`[data-row="${row}"][data-column="1"] input`).fill(String(year));
      await page.locator(`[data-row="${row}"][data-column="2"] input`).fill(String(value));
    }

    // Submit the form
    // TODO

    // Listen for success toast
    // TODO

    // Either parse the resulting graph or return to historical data page to make sure the data was saved correctly
    // TODO
  });

  test.skip('Add Data - External', async ({ page }) => {
    // Navigate to goal and historical data page
    // The public view: logged-in org members land on their org's page by default,
    // which only lists that org's own content
    await page.goto('/?org=public');
    await page.waitForLoadState("networkidle");

    await page.getByRole('link', { name: "Rikets färdplan" }).click();
    await page.getByRole('heading', { name: "Rikets färdplan" }).hover();

    // TODO: Don't go to first featured goal, I don't think we guarantee any during seeding.
    // Instead, we should go to the second goal in the list of goals in this test, and the first one in the first test.
    await page.getByTestId('featured-goals').first().click();
    await page.getByTestId('historical-data-link').click();

    // Switch to external dataset input
    // TODO

    // Select dataset from dropdown
    const option = page.locator('#externalDataset').filter({ hasText: 'Statiska centralbyrån' });
    const value = await option.getAttribute('value');
    await page.locator('#externalDataset').selectOption(value);

    // Select a table from the dataset
    // TODO: Choose a table with known good test data, preferably one which is no longer updated

    // Select metric(-s?) for the table
    // TODO: Prefer a table with more than one metric if available, to ensure we support unusual but technically valid cases

    // Select year and other parameters
    // TODO

    // Submit the form
    // TODO

    // Listen for success toast
    // TODO

    // Either parse the resulting graph or return to historical data page to make sure the data was saved correctly
    // TODO
  });
});
