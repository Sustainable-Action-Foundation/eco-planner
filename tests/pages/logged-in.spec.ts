import { expect, test } from "playwright/test";
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename); // get the name of the directory

const adminFile = path.join(__dirname, '../.auth/admin.json');

test.describe("Logged in tests", () => {
  test.use ({ storageState: adminFile });

  test('add roadmap series', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Create' }).click();
    await page.getByRole('link', { name: 'roadmap series', exact: true }).click();
    await page.getByRole('button', { name: 'Close menu: Create' }).click();
    await expect(page.getByRole('heading')).toContainText('Create new roadmap series');
  });
});
