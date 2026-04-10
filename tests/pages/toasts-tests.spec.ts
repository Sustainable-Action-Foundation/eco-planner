import { expect, test } from "playwright/test";
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename); // get the name of the directory

const adminFile = path.join(__dirname, '../.auth/admin.json');

test.describe('Toasts tests', () => {
    test.use({ storageState: adminFile });

    test('Login toast - yellow alert and green alert', async ({ page }) => {
        await page.goto('/login');
        await page.locator('#submit-button').click();
        await expect(page.getByTestId('toast')).toHaveText('Login failed');
        
        await page.locator('#username').fill('anton');
        await page.locator('#password').fill('anton');
        await page.locator('#submit-button').click();
        await expect(page.getByTestId('toast')).toHaveText('Login successful');
        await expect(page.locator('#username')).toBeVisible();
    });

    test('Action toast - yellow alert and green alert', async ({ page }) => {
        await page.goto('/');
        await page.getByTestId("create-button").click();
        await page.getByTestId("create-action").click();

        await page.locator('#submit-button').hover();
        await page.locator('#submit-button').click();

        await expect(page.getByTestId('toast')).toHaveText('Warning!');

        const option = page.locator('#roadmapId option').filter({ hasText: 'Rikets färdplan' }).filter({ hasText: '2' }); // Checks for Rikets färdplan to be contained in an option, with version 2 to avoid selecting the wrong roadmap

        const value = await option.getAttribute('value');

        await page.locator('#roadmapId').selectOption(value);

        await page.locator('#name').fill('Test Toast');

        await page.locator('#submit-button').hover();
        await page.locator('#submit-button').click();

        await expect(page.getByTestId('toast')).toHaveText('Success!');
    });

    test('Metaroadmap toast - yellow alert and green alert', async ({ page }) => {

        await page.goto('/metaRoadmap/create');

        // Submit the roadmap form
        await page.locator('#submit-button').click();

        await expect(page.getByTestId('toast')).toHaveText('Warning!');

        // Fill in the metaRoadmap form
        await page.locator('#name').fill('MetaRoadmap Toast');

        // Fill description in the tiptap editor
        await page.locator('.tiptap').first().fill('Toast');

        // Select roadmap type
        await page.locator('#type').selectOption("LOCAL");

        // Fill in actor field
        await page.locator('#actor').fill("Toast");

        // Set visibility to private
        await page.locator('#visibility-private').check();

        // Set editability to private
        await page.locator('#editability-private').check();

        // Submit the form
        await page.locator('#submit-button').click();

        await expect(page.getByTestId('toast')).toHaveText('Success!');

        // Wait for redirect to roadmap creation page
        await expect(page).toHaveURL(/\/roadmap\/create/);

        // Submit the roadmap form
        await page.locator('#submit-button').click();

        await expect(page.getByTestId('toast')).toHaveText('Warning!');

        // Set visibility - "Vem får se färdplanen?" (Who can see the roadmap?)
        await page.locator('#visibility-private').check();

        // Set editability - "Vem får redigera färdplanen?" (Who can edit the roadmap?)
        await page.locator('#editability-private').check();

        // Submit the roadmap form
        await page.locator('#submit-button').click();

        await expect(page.getByTestId('toast')).toHaveText('Success!');

        // Verify successful roadmap creation by checking the redirect
        await expect(page).toHaveURL(/\/roadmap\/[a-zA-Z0-9-]+/);

        await expect(page.getByRole('heading', { name: 'Toast' })).toBeVisible();
    });

    test('Goal toast - yellow alert and green alert', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState("networkidle");

        await page.getByTestId('create-button').click();
        await page.getByTestId('create-goal').click();
        await page.waitForLoadState("networkidle");

        // Form Submit
        await page.locator('#submit-button').click();

        await expect(page.getByTestId('toast')).toHaveText('Warning!');

        // Form Part 1
        await page.locator('#parent-roadmap').click();
        await page.locator('#parent-roadmap-dialog-listbox li').filter({ hasText: 'Rikets färdplan' }).filter({ hasText: '2' }).click(); // Checks for Rikets färdplan to be contained in an option, with version 2 to avoid selecting the wrong roadmap

        // Form Part 2 is optional, so we skip it

        // Form Part 3
        // Might be switched out for a pre-written recipe when they are fixed
        await page.getByRole('radio', { name: "goal.derive_data_series_manually" }).click();
        await page.locator('#indicatorParameter').fill('Goal Toast');
        await page.locator('#dataUnit').fill('yard');

        await page.getByLabel("data_series_input.end_year").fill('2030');
        for (let i = 0; i < 10; i++) {
        await page.getByRole('spinbutton').nth(2 + i).fill('1');
        }

        // Form Submit
        await page.locator('#submit-button').click();

        await expect(page.getByTestId('toast')).toHaveText('Success!');
    });
});