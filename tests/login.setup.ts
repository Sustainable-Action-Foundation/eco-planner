import { test as setup, expect } from 'playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename); // get the name of the directory

const adminFile = path.join(__dirname, '.auth/admin.json');
const verifiedFile = path.join(__dirname, '.auth/verified.json');

setup('authenticate as admin', async ({ page }) => {
  // Perform authentication steps. Replace these actions with your own.
  await page.goto('/login');
  await page.locator('#username').fill('admin');
  await page.locator('#password').fill('admin');
  await page.locator('#submit-button').click();

  await expect(page.getByTestId("home-title")).toBeVisible();

  // End of authentication steps.
  await page.context().storageState({ path: adminFile });
});

setup('authenticate as verified', async ({ page }) => {
  // Perform authentication steps. Replace these actions with your own.
  await page.goto('/login');
  await page.locator('#username').fill('anita');
  await page.locator('#password').fill('anita');
  await page.locator('#submit-button').click();

  await expect(page.getByTestId("home-title")).toBeVisible();

  // End of authentication steps.
  await page.context().storageState({ path: verifiedFile });
});