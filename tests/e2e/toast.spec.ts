import { expect, test } from "playwright/test";
import type { Page } from "playwright/test";
import path from "node:path";
import { cwd } from "node:process";

const adminFile = path.join(cwd(), "tests/.auth/admin.json");

async function expectToast(page: Page, type: "warning" | "success" | "error", objectType?: string | RegExp) {
  const labelMap = {
    warning: "toasts.warning",
    success: "toasts.success",
    error: "toasts.error",
  } as const;

  const role = type === "error" ? "alert" : "status";

  const initialSelection = page.locator(`dialog[role="${role}"]`).filter({ hasText: labelMap[type] });

  if (!objectType) {
    await expect(initialSelection).toBeVisible();
  } else {
    await expect(initialSelection.filter({ hasText: objectType })).toBeVisible();
  }
}

async function expectNativeValidationRejection(page: Page) {
  await expect
    .poll(async () => page.locator("form:invalid").count())
    .toBeGreaterThan(0);
}

async function selectRiketsRoadmap(page: Page) {
  const option = page.locator('#roadmapId option').filter({ hasText: 'Rikets färdplan' }).filter({ hasText: 'v2' });
  const value = await option.getAttribute('value');

  if (!value) {
    throw new Error('Could not find Rikets färdplan version 2');
  }

  await page.locator('#roadmapId').selectOption(value);
}

async function selectParentRiketsRoadmap(page: Page) {
  await page.locator('#parent-roadmap').click();
  await page.locator('#parent-roadmap-dialog-listbox li').filter({ hasText: 'Rikets färdplan' }).filter({ hasText: 'v2' }).click();
}

async function fillGoalSeries(page: Page) {
  await page.locator('input[name="dataSeriesType"][value="MANUAL"]').check();
  await page.locator('#indicatorParameter').fill('Goal Toast');
  await page.locator('#dataUnit').fill('yard');

  const insertRowButton = page.getByRole("button", { name: /Insert row to bottom|Infoga rad underst/ });
  for (let i = 1; i < 10; i++) {
    await insertRowButton.click();
  }

  for (let i = 0; i < 10; i++) {
    await page.locator(`[data-row="${i}"][data-column="1"] input`).fill(String(2020 + i));
    await page.locator(`[data-row="${i}"][data-column="2"] input`).fill('1');
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

  test('Action shows rejects invalid submit and shows success toast', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('create-button').click();
    await page.getByTestId('create-action').click();

    await page.locator('#submit-button').click();
    await expectNativeValidationRejection(page);

    await selectRiketsRoadmap(page);
    await page.locator('#actionName').fill('Test Toast');

    await page.locator('#submit-button').click();
    await expectToast(page, 'success', 'action');
  });

  test('Metaroadmap rejects invalid submit and shows success toast', async ({ page }) => {
    await page.goto('/metaRoadmap/create');

    await page.locator('#submit-button').click();
    await expectNativeValidationRejection(page);

    await page.locator('#name').fill('MetaRoadmap Toast');
    await page.locator('#type').selectOption('LOCAL');
    await page.locator('#actor').fill('Toast');
    await page.locator('#visibility-private').check();
    await page.locator('#editability-private').check();

    await page.locator('#submit-button').click();
    await expectToast(page, 'warning', 'meta_roadmap');

    await page.locator('.tiptap').first().fill('Toast');
    await page.locator('#submit-button').click();

    await expectToast(page, 'success', 'meta_roadmap');
    await expect(page).toHaveURL(/\/roadmap\/create/);

    await page.locator('#submit-button').click();
    await expectNativeValidationRejection(page);

    await page.locator('#visibility-private').check();
    await page.locator('#editability-private').check();

    await page.locator('#submit-button').click();
    // Check for a toast containing roadmap, not immediately preceded by "meta" or "meta_"
    await expectToast(page, 'success', /(?<!meta_?)roadmap\b/i);
    await expect(page).toHaveURL(/\/roadmap\/[a-zA-Z0-9-]+/);
    await expect(page.getByRole('heading', { name: 'Toast' })).toBeVisible();
  });

  test('Goal rejects invalid submit and shows success toast', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.getByTestId('create-button').click();
    await page.getByTestId('create-goal').click();
    await page.waitForLoadState('networkidle');

    await page.locator('#submit-button').click();
    await expectToast(page, 'warning', 'goal');

    await selectParentRiketsRoadmap(page);
    await fillGoalSeries(page);

    await page.locator('#submit-button').click();
    await expectToast(page, 'success');
  });
});