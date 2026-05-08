import { test as setup, expect } from 'playwright/test';
import type { Page } from 'playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync, readFileSync } from "node:fs";

const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename); // get the name of the directory

const adminFile = path.join(__dirname, '.auth/admin.json');
const verifiedFile = path.join(__dirname, '.auth/verified.json');

if (!existsSync(path.join(__dirname, '.auth'))) {
  mkdirSync(path.join(__dirname, '.auth'));
}

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
  console.info('Saving admin storageState to', adminFile);
  try {
    await page.context().storageState({ path: adminFile });
    console.info('Saved admin storageState, exists=', existsSync(adminFile));
    if (existsSync(adminFile)) {
      console.info('admin.json size=', readFileSync(adminFile, 'utf8').length);
    }
  } catch (err: unknown) {
    console.error('Failed to save admin storageState:', err);
    throw err;
  }
});

setup('authenticate as verified user', async ({ page }) => {
  await loginHelper(page, 'anita', 'anita');

  // Save authenticated state to file
  console.info('Saving verified storageState to', verifiedFile);
  try {
    await page.context().storageState({ path: verifiedFile });
    console.info('Saved verified storageState, exists=', existsSync(verifiedFile));
    if (existsSync(verifiedFile)) {
      console.info('verified.json size=', readFileSync(verifiedFile, 'utf8').length);
    }
  } catch (err: unknown) {
    console.error('Failed to save verified storageState:', err);
    throw err;
  }
});

setup('authenticate as unverified user', async ({ page }) => {
  setup.fail(true, 'Unverified users should not be able to log in until they verify their email address.');
  await loginHelper(page, 'anton', 'anton');
});

setup('authenticate with wrong credentials', async ({ page }) => {
  setup.fail(true, 'Users should not be able to log in with wrong credentials/as non-existent users.');
  await loginHelper(page, 'badUser', 'badPassword');
});