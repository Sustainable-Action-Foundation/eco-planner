import { test } from "playwright/test";
import path from "node:path";
import { cwd } from "node:process";

const adminFile = path.join(cwd(), "tests/.auth/admin.json");

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
      [2029, 325]
    ];

    // Create all rows first
    const insertRowButton = page.getByRole('button', { name: /Insert row to bottom|Infoga rad underst/ });
    for (let i = 1; i < dataRows.length; i++) {
      await insertRowButton.click();
    }

    // Fill all rows (starting at row 1)
    for (let row = 0; row < dataRows.length; row++) {
      await page.locator(`[data-row="${row}"][data-column="1"] input`).fill(dataRows[row][0].toString());
      await page.locator(`[data-row="${row}"][data-column="2"] input`).fill(dataRows[row][1].toString());
    }

    await page.locator('[data-row="0"][data-column="1"]').click();
    // Delete 5 rows
    const deleteRowButton = page.getByRole('button', { name: /Delete selected row|Radera vald rad/ });
    for (let i = 0; i < 5; i++) {
      await deleteRowButton.last().click();
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

    await page.locator('input[name="visible-form"][value="external"]').check();
    const option = page.locator('#externalDataset').filter({ hasText: 'Statiska centralbyrån' });

    const value = await option.getAttribute('value');

    await page.locator('#externalDataset').selectOption(value);

  });
});
