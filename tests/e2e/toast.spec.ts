import { expect, test } from "playwright/test";
import type { Page } from "playwright/test";
import path from "node:path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const adminFile = path.join(__dirname, "../.auth/admin.json");

async function expectToast(page: Page, translationKey: string) {
  await expect(page.getByTestId("toast-list").filter({ hasText: translationKey })).toBeVisible();
}

async function selectRiketsRoadmap(page: Page) {
  const option = page.locator('#roadmapId option').filter({ hasText: 'Rikets färdplan' }).filter({ hasText: '2' });
  const value = await option.getAttribute('value');

  if (!value) {
    throw new Error('Could not find Rikets färdplan version 2');
  }

  await page.locator('#roadmapId').selectOption(value);
}

async function selectParentRiketsRoadmap(page: Page) {
  await page.locator('#parent-roadmap').click();
  await page.locator('#parent-roadmap-dialog-listbox li').filter({ hasText: 'Rikets färdplan' }).filter({ hasText: '2' }).click();
}

async function fillGoalSeries(page: Page) {
  await page.getByRole('radio', { name: 'goal.derive_data_series_manually' }).click();
  await page.locator('#indicatorParameter').fill('Goal Toast');
  await page.locator('#dataUnit').fill('yard');
  await page.getByLabel('data_series_input.end_year').fill('2030');

  for (let i = 0; i < 10; i++) {
    await page.getByRole('spinbutton').nth(2 + i).fill('1');
  }
}

test.describe('Toast', () => {
  test.use({ storageState: adminFile });

  test('Login shows inline error', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('logout-button').click();
    await page.waitForLoadState('networkidle');

    await page.goto('/login');
    await page.locator('#submit-button').click();
    await expect(page.getByTestId('login-error-message')).toBeVisible();
  });

  test('Action shows warning and success toast', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('create-button').click();
    await page.getByTestId('create-action').click();

    await page.locator('#submit-button').click();
    await expectToast(page, 'toasts.warning');

    await selectRiketsRoadmap(page);
    await page.locator('#actionName').fill('Test Toast');

    await page.locator('#submit-button').click();
    await expectToast(page, 'toasts.success');
  });

  test('Metaroadmap shows warning and success toast', async ({ page }) => {
    await page.goto('/metaRoadmap/create');

    await page.locator('#submit-button').click();
    await expectToast(page, 'toasts.warning');

    await page.locator('#name').fill('MetaRoadmap Toast');
    await page.locator('#type').selectOption('LOCAL');
    await page.locator('#actor').fill('Toast');
    await page.locator('#visibility-private').check();
    await page.locator('#editability-private').check();

    await page.locator('#submit-button').click();
    await expectToast(page, 'toasts.warning');

    await page.locator('.tiptap').first().fill('Toast');
    await page.locator('#submit-button').click();

    await expectToast(page, 'toasts.success');
    await expect(page).toHaveURL(/\/roadmap\/create/);

    await page.locator('#submit-button').click();
    await expectToast(page, 'toasts.warning');

    await page.locator('#visibility-private').check();
    await page.locator('#editability-private').check();
    await page.locator('#submit-button').click();

    await expectToast(page, 'toasts.success');
    await expect(page).toHaveURL(/\/roadmap\/[a-zA-Z0-9-]+/);
    await expect(page.getByRole('heading', { name: 'Toast' })).toBeVisible();
  });

  test('Goal shows warning and success toast', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.getByTestId('create-button').click();
    await page.getByTestId('create-goal').click();
    await page.waitForLoadState('networkidle');

    await page.locator('#submit-button').click();
    await expectToast(page, 'toasts.warning');

    await selectParentRiketsRoadmap(page);
    await fillGoalSeries(page);

    await page.locator('#submit-button').click();
    await expectToast(page, 'toasts.success');
  });
});