import { test as setup, expect } from 'playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename); // get the name of the directory

const authFile = path.join(__dirname, '../playwright/.auth/user.json');

setup('authenticate', async ({ page }) => {
  // Perform authentication steps. Replace these actions with your own.
  await page.goto('/login');
  await page.locator('#username').fill('admin');
  await page.locator('#password').fill('admin');
  await page.locator('#submit-button').click();
  // Wait until the page receives the cookies.
  
  // Sometimes login flow sets cookies in the process of several redirects.
  // Wait for the final URL to ensure that the cookies are actually set.
	await page.waitForURL('/');
  // Alternatively, you can wait until the page reaches a state where all cookies are set.
  // await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible();

  // End of authentication steps.

  await page.context().storageState({ path: authFile });
});