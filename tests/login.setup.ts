import { test as setup, expect } from 'playwright/test';
import type { Page } from 'playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename); // get the name of the directory

const adminFile = path.join(__dirname, '.auth/admin.json');
const verifiedFile = path.join(__dirname, '.auth/verified.json');

async function loginHelper(page: Page, username: string, password: string) {
  await page.goto('/login');
  await page.locator('#username').fill(username);
  await page.locator('#password').fill(password);
  await page.locator('#submit-button').click();

  // Logout button replaces the login button in the sidebar when logged in
  await expect(page.getByTestId("logout-button")).toBeVisible();
}

setup('authenticate as admin', async ({ page }) => {
  await loginHelper(page, 'admin', 'admin');

  // Save authenticated state to file
  await page.context().storageState({ path: adminFile });
});

setup('authenticate as verified user', async ({ page }) => {
  await loginHelper(page, 'anita', 'anita');

  // Save authenticated state to file
  await page.context().storageState({ path: verifiedFile });
});

setup('authenticate as unverified user', async ({ page }) => {
  setup.fail(true, 'Unverified users should not be able to log in until they verify their email address.');
  await loginHelper(page, 'anton', 'anton');
});

setup('authenticate with wrong credentials', async ({ page }) => {
  setup.fail(true, 'Users should not be able to log in with wrong credentials/as non-existent users.');
  await loginHelper(page, 'badUser', 'badPassword');
});