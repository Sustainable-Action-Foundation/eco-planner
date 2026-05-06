import { test } from "playwright/test";
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename); // get the name of the directory

const adminFile = path.join(__dirname, '../.auth/admin.json');

test.describe("Historical Data Tests", () => {
  test.use({ storageState: adminFile });

  test('Add Data Manually', async ({ page }) => {
    // Navigate to roadmap
    await page.goto('/');
    await page.waitForLoadState("networkidle");

    await page.getByRole('link', { name: "Rikets färdplan" }).click();
    await page.getByRole('heading', { name: "Rikets färdplan" }).hover();

    await page.getByTestId('featured-goals').first().click();
    await page.getByTestId('historical-data-link').click();

    const dataRows = [
      [2025, 200],
      [2026, 250],
      [2027, 275],
      [2028, 300],
      [2029, 325],
    ];

    // Create all rows first
    for (let i = 1; i < dataRows.length; i++) {
      await page.getByTestId('add-row-button').click();
    }

    // Fill all rows (starting at row 1)
    for (let rowNum = 1; rowNum <= dataRows.length; rowNum++) {
      for (let col = 0; col < dataRows[rowNum - 1].length; col++) {
        await page.locator(`[data-row="${rowNum}"][data-column="${col}"] input`)
          .fill(dataRows[rowNum - 1][col].toString());
      }
    }
    // Delete 5 rows
    for (let i = 0; i < 5; i++) {
      await page.getByTestId('delete-row-button').last().click();
      // or use .last() if deleting from bottom to top
    }
  });

  test('Add Data - External', async ({ page }) => {
    // Navigate to roadmap
    await page.goto('/');
    await page.waitForLoadState("networkidle");

    await page.getByRole('link', { name: "Rikets färdplan" }).click();
    await page.getByRole('heading', { name: "Rikets färdplan" }).hover();

    await page.getByTestId('featured-goals').first().click();
    await page.getByTestId('historical-data-link').click();

    await page.getByRole('radio', { name: "visible-form" }).click();
    const option = page.locator('#externalDataset').filter({ hasText: 'Statiska centralbyrån' });

    const value = await option.getAttribute('value');

    await page.locator('#externalDataset').selectOption(value);

  });
});
