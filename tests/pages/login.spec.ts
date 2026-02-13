import { expect, test } from "playwright/test";

// test.use({ storageState: { cookies: [], origins: [] } });

test('add roadmap series', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Create' }).click();
  await page.getByRole('link', { name: 'roadmap series', exact: true }).click();
  await page.getByRole('button', { name: 'Close menu: Create' }).click();
  await expect(page.getByRole('heading')).toContainText('Create new roadmap series');
});