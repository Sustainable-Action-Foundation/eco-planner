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
  await page.locator('#parent-roadmap-dialog-listbox li').filter({ hasText: 'Rikets färdplan' }).filter({ hasText: '2' }).click(); // This place shows it as `"version": 2` rather than `v2`, so we just look for a "2"
}

async function fillGoalSeries(page: Page) {
  await page.locator('input[name="DATA_SERIES_TYPE"][value="MANUAL"]').check();
  await page.locator('#indicatorParameter').fill('Goal Toast');
  // The unit lives in the recipe context; a manual series has none, so type an override.
  // Blur afterwards so the autocomplete dropdown doesn't cover elements below.
  await page.locator('#goal-manual-unit').fill('yard');
  await page.locator('#goal-manual-unit').blur();

  const insertRowButton = page.getByTestId("add-row-button");
  for (let i = 1; i < 10; i++) {
    await insertRowButton.click();
  }

  // Set focus inside table to ensure the first cell gets filled properly;
  // without this the test will fail on Firefox and Webkit (but not Chromium) because the first attempt to input data into a cell only sets focus into the table, without successfully filling the cell.
  await page.locator(`#goal-dataseries [data-row="0"][data-column="1"] input`).focus();

  for (let i = 0; i < 10; i++) {
    await page.locator(`#goal-dataseries [data-row="${i}"][data-column="1"] input`).fill(String(2020 + i));
    await page.locator(`#goal-dataseries [data-row="${i}"][data-column="2"] input`).fill(String(1));
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

  test('Roadmap rejects invalid submit and shows success toast', async ({ page }) => {
    await page.goto('/roadmap/create');

    // Name, type and actor are required, so an empty submit is rejected natively
    await page.locator('#submit-button').click();
    await expectNativeValidationRejection(page);

    await page.locator('#name').fill('Roadmap Toast');
    await page.locator('#type').selectOption('LOCAL');
    await page.locator('#actor').fill('Toast');
    // The single seeded org is preselected, and visibility defaults to org members.
    // The admin user is an org manager, so no group grant is needed either.

    // The description lives in a hidden input, so the form's own submit handler
    // rejects the missing description with a warning toast
    await page.locator('#submit-button').click();
    await expectToast(page, 'warning', 'roadmap.description_required');

    await page.locator('.tiptap').first().fill('Toast');
    await page.locator('#submit-button').click();

    await expectToast(page, 'success', 'roadmap.roadmap_created');
    await expect(page).toHaveURL(/\/roadmapIteration\/create/);

    // The iteration form has no required fields when the roadmap comes from the
    // query, so just publish and submit
    await page.locator('#publish').check();
    await page.locator('#submit-button').click();
    await expectToast(page, 'success', 'iteration_created');
    await expect(page).toHaveURL(/\/roadmapIteration\/(?!create)[a-zA-Z0-9-]+/);
    await expect(page.getByRole('heading', { name: 'Roadmap Toast' })).toBeVisible();
  });

  test('Goal rejects invalid submit and shows success toast', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.getByTestId('create-button').click();
    await page.getByTestId('create-goal').click();
    await page.waitForLoadState('networkidle');

    await selectParentRiketsRoadmap(page);

    // The default (suggested) tab has a required preset select, so an empty
    // submit is rejected by native validation before reaching the handler
    await page.locator('#submit-button').click();
    await expectNativeValidationRejection(page);

    // Manual mode: the grid's year cells are required, so an empty grid is
    // also rejected natively
    await page.locator('input[name="DATA_SERIES_TYPE"][value="MANUAL"]').check();
    await page.locator('#submit-button').click();
    await expectNativeValidationRejection(page);

    // A year without a value passes native validation but yields no usable
    // data series, which the submit handler must reject with an error toast
    await page.locator(`#goal-dataseries [data-row="0"][data-column="1"] input`).focus();
    await page.locator(`#goal-dataseries [data-row="0"][data-column="1"] input`).fill('2020');
    await page.locator('#submit-button').click();
    await expectToast(page, 'error', 'goal');

    await fillGoalSeries(page);

    await page.locator('#submit-button').click();
    await expectToast(page, 'success');
  });
});