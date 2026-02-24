import { expect, test } from "playwright/test";
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename); // get the name of the directory

const adminFile = path.join(__dirname, '../.auth/admin.json');

test.describe("Logged in tests", () => {
  test.use ({ storageState: adminFile });

  test('Add roadmap series', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('create-button').click();
    await page.getByTestId('create-roadmap-series').click();
    await expect(page.locator('#name')).toBeVisible();
  });
});
