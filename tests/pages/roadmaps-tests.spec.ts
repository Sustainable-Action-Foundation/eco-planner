import { expect, test } from "playwright/test";
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename); // get the name of the directory

const adminFile = path.join(__dirname, '../.auth/admin.json');

test.describe.serial("Roadmaps tests", () => {
  test.use({ storageState: adminFile });

  // Variables to hold the names of created metaRoadmaps for use across all tests in this describe block.
  let metaRoadmapNameAllFields = "";
  let metaRoadmapNameAllFieldsUpdated = "";
  let metaRoadmapNameRequiredFields = "";
  let metaRoadmapNameRequiredFieldsUpdated = "";
  let roadmapidAllFields = "";
  let roadmapidRequiredFields = "";

  // Cleanup function to delete any created metaRoadmaps so after a retry there are no duplicates. 
  test.beforeAll(async ({ browser }, testInfo) => {
<<<<<<< Updated upstream
    // Define the metaRoadmap name here so it can be accessed in all later tests.
    // Needs to be unique for each worker so different browsers running tests in parallel don't interfere with each other.
    metaRoadmapNameAllFields = `Test All Fields ${testInfo.parallelIndex}`;
=======
    metaRoadmapNameAllFields = `Test ${testInfo.parallelIndex}`;
>>>>>>> Stashed changes

    if (testInfo.retry > 0) {
        console.log(`Retrying tests, Cleaning up any existing metaRoadmap with name ${metaRoadmapNameAllFields} before retrying.`);

        const context = await browser.newContext({ storageState: adminFile });
        const page = await context.newPage();

        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Recover roadmap IDs before cleanup by navigating to them via name link
        const allFieldsLink = page.getByRole('link', { name: `${metaRoadmapNameAllFields} (v1)` }).first();
        if (await allFieldsLink.isVisible()) {
            await allFieldsLink.click();
            await page.waitForLoadState('networkidle');
            const url = page.url();
            roadmapidAllFields = url.split('/roadmap/')[1]?.split('?')[0] ?? "";
            await page.goto('/');
            await page.waitForLoadState('networkidle');
        }

        const requiredName = `Test Required ${testInfo.parallelIndex}`;
        const requiredFieldsLink = page.getByRole('link', { name: `${requiredName} (v1)` }).first();
        if (await requiredFieldsLink.isVisible()) {
            await requiredFieldsLink.click();
            await page.waitForLoadState('networkidle');
            const url = page.url();
            roadmapidRequiredFields = url.split('/roadmap/')[1]?.split('?')[0] ?? "";
            await page.goto('/');
            await page.waitForLoadState('networkidle');
        }

        // Cleanup all name variants
        const namesToClean = [
            `Test ${testInfo.parallelIndex}`,
            `Updated Test ${testInfo.parallelIndex}`,
            `Test Required ${testInfo.parallelIndex}`,
            `Updated Test Required ${testInfo.parallelIndex}`,
        ];

        for (const name of namesToClean) {
            const matchingItems = page.locator('li').filter({ hasText: name });
            const count = await matchingItems.count();

            for (let i = 0; i < count; i++) {
                const firstMatch = matchingItems.first();
                await firstMatch.locator('svg').nth(1).click();
                await firstMatch.getByTestId('delete-post').click();
                await firstMatch.locator('input[placeholder]').fill(name);
                await firstMatch.locator('[type="submit"]').click();
                await page.waitForLoadState('networkidle');
            }

            await expect(matchingItems).toHaveCount(0);
    }

        await context.close();
    }
  });

  test("Create MetaRoadmap and Roadmap - All Fields", async ({ page }) => {

    // Navigate to create metaRoadmap page
    await page.goto('/metaRoadmap/create');

    // Fill in the metaRoadmap form
    await page.locator('#name').fill(metaRoadmapNameAllFields);

    // Fill description in the tiptap editor
    await page.locator('.tiptap').first().fill('Test All');

    // Select roadmap type
    await page.locator('#type').selectOption("LOCAL");

    // Fill in actor field
    await page.locator('#actor').fill("Test All");

    // Set visibility to private
    await page.locator('#visibility-private').check();

    // Set editability to private
    await page.locator('#editability-private').check();

    // Test below non-functional at this time due to problem in code surrounding parent roadmap selection.

    // await page.locator('#parent-roadmap').selectOption("Rikets färdplan");

    // Submit the form
    await page.locator('#submit-button').click();

    // Wait for redirect to roadmap creation page
    await expect(page).toHaveURL(/\/roadmap\/create/);

    // Fill in the roadmap form
    // Fill description in the tiptap editor
    await page.locator('.tiptap').first().fill('Test All');

    // Set visibility - "Vem får se färdplanen?" (Who can see the roadmap?)
    await page.locator('#visibility-private').check();

    // Set editability - "Vem får redigera färdplanen?" (Who can edit the roadmap?)
    await page.locator('#editability-private').check();

    // Submit the roadmap form
    await page.locator('#submit-button').click();

    // Verify successful roadmap creation by checking the redirect
    await expect(page).toHaveURL(/\/roadmap\/[a-zA-Z0-9-]+/);

    // Look for heading text
    await expect(page.getByRole('heading', { name: metaRoadmapNameAllFields })).toBeVisible();

    // Save roadmap URL
    const urlAllFields = page.url();
    roadmapidAllFields = urlAllFields.split('/roadmap/')[1].split('?')[0];
  });

  test("Edit roadmap, no changes - All Fields", async ({ page }) => {

    await page.goto('/');

<<<<<<< Updated upstream
    await page.getByRole('link', { name: `${metaRoadmapNameAllFields}` }).first().click();
=======
    // Find and click the roadmap link using the stored roadmap ID
    await page.locator(`[href="/roadmap/${roadmapidAllFields}"]`).first().click();
>>>>>>> Stashed changes

    // Wait for roadmap page to load
    await expect(page).toHaveURL(/\/roadmap\/[a-zA-Z0-9-]+$/);

    // Click the edit button
    await page.getByTestId('admin-panel-edit').click();

    // Wait for edit page to load
    await expect(page).toHaveURL(/\/roadmap\/[a-zA-Z0-9-]+\/edit/);

    // Verify all fields are filled in
    await expect(page.locator('.tiptap').first()).toHaveText('Test All');

    // Verify visibility is set
    await expect(page.locator('#visibility-private')).toBeChecked();

    // Verify editability is set
    await expect(page.locator('#editability-custom')).toBeChecked();

    // Verify admin user is in the editors list
    await expect(page.locator('#editors')).toHaveValue('admin');

    // Click the save button
    await page.locator('#submit-button').click();

    // Verify the save was successful
    await expect(page).toHaveURL(/\/roadmap\/[a-zA-Z0-9-]+$/);
    await expect(page.getByTestId('admin-panel-edit')).toBeVisible();
  });

  test("Edit MetaRoadmap, no changes - All Fields", async ({ page }) => {

    await page.goto('/');

<<<<<<< Updated upstream
    await page.getByRole('link', { name: `${metaRoadmapNameAllFields}` }).first().click();
=======
    // Find and click the roadmap link using the stored roadmap ID
    await page.locator(`[href="/roadmap/${roadmapidAllFields}"]`).first().click();
>>>>>>> Stashed changes

    // Go to MetaRoadmap page
    await page.getByTestId('show-roadmap-series').click();

    //  Wait for MetaRoadmap page to load
    await expect(page).toHaveURL(/\/metaRoadmap\/[a-zA-Z0-9-]+$/);

    // Click the edit button
    await page.getByTestId('admin-panel-edit').click();

    // Wait for edit page to load
    await expect(page).toHaveURL(/\/metaRoadmap\/[a-zA-Z0-9-]+\/edit/);

    await expect(page.locator('#name')).toHaveValue(metaRoadmapNameAllFields);

    // Verify all fields are filled in
    await expect(page.locator('.tiptap').first()).toHaveText('Test All');

    // Verify type is set
    await expect(page.locator('#type')).toHaveValue('LOCAL');

    // Verify actor field is filled in
    await expect(page.locator('#actor')).toHaveValue('Test All');

    // Verify visibility is set
    await expect(page.locator('#visibility-private')).toBeChecked();

    // Verify editability is set
    await expect(page.locator('#editability-private')).toBeChecked();

    // This part beleow is non-functional at this time due to problem in code surrounding parent roadmap selection.

    // Verify parent roadmap is set
    // await expect(page.locator('#parent-roadmap')).toHaveValue('Rikets färdplan');

    // Click the save button
    await page.locator('#submit-button').click();

    // Verify the save was successful
    await expect(page).toHaveURL(/\/metaRoadmap\/[a-zA-Z0-9-]+$/);
    await expect(page.getByRole('heading', { name: metaRoadmapNameAllFields })).toBeVisible();
  });

  test("Edit roadmap, updated fields - All Fields", async ({ page }) => {

    await page.goto('/');

<<<<<<< Updated upstream
    await page.getByRole('link', { name: `${metaRoadmapNameAllFields}` }).first().click();
=======
    // Find and click the roadmap link using the stored roadmap ID
    await page.locator(`[href="/roadmap/${roadmapidAllFields}"]`).first().click();
>>>>>>> Stashed changes

    // Click the edit button
    await page.getByTestId('admin-panel-edit').click();

    // Wait for edit page to load
    await expect(page).toHaveURL(/\/roadmap\/[a-zA-Z0-9-]+\/edit/);

    // Edit description in the tiptap editor
    await page.locator('.tiptap').first().fill('Updated Roadmap Description All');

    // Edit visibility - change to custom
    await page.locator('#visibility-custom').check();

    // Add viewers
    await page.locator('#viewers').fill('admin');

    // Edit editability - change to custom if not already
    await page.locator('#editability-custom').check();

    // Update editors list
    await page.locator('#editors').fill('admin');

    // Click the save button
    await page.locator('#submit-button').click();

    // Verify the save was successful
    await expect(page).toHaveURL(/\/roadmap\/[a-zA-Z0-9-]+$/);

    // Click the edit button again to verify all changes were saved
    await page.getByTestId('admin-panel-edit').click();

    // Wait for edit page to load
    await expect(page).toHaveURL(/\/roadmap\/[a-zA-Z0-9-]+\/edit/);

    // Verify description was updated
    await expect(page.locator('.tiptap').first()).toHaveText('Updated Roadmap Description All');

    // Verify visibility was changed to custom
    await expect(page.locator('#visibility-custom')).toBeChecked();

    // Verify viewers were added
    await expect(page.locator('#viewers')).toHaveValue('admin');

    // Verify editability was changed to custom
    await expect(page.locator('#editability-custom')).toBeChecked();

    // Verify editors list was updated
    await expect(page.locator('#editors')).toHaveValue('admin');
  });

  test("Edit MetaRoadmap, updated fields - All Fields", async ({ page }) => {

    metaRoadmapNameAllFieldsUpdated = `Updated ${metaRoadmapNameAllFields}`;

    await page.goto('/');

<<<<<<< Updated upstream
    await page.getByRole('link', { name: `${metaRoadmapNameAllFields}` }).first().click();
=======
    // Find and click the roadmap link using the stored roadmap ID
    await page.locator(`[href="/roadmap/${roadmapidAllFields}"]`).first().click();
>>>>>>> Stashed changes

    // Go to MetaRoadmap page
    await page.getByTestId('show-roadmap-series').click();

    //  Wait for MetaRoadmap page to load
    await expect(page).toHaveURL(/\/metaRoadmap\/[a-zA-Z0-9-]+$/);

    // Click the edit button
    await page.getByTestId('admin-panel-edit').click();

    // Wait for edit page to load
    await expect(page).toHaveURL(/\/metaRoadmap\/[a-zA-Z0-9-]+\/edit/);

    // Edit name
    await page.locator('#name').fill(metaRoadmapNameAllFieldsUpdated);

    // Edit description in the tiptap editor
    await page.locator('.tiptap').first().fill('Updated Description All');

    // Edit type
    await page.locator('#type').selectOption("OTHER");

    // Edit actor field
    await page.locator('#actor').fill("Updated Actor All");

    // Edit visibility - uncheck private and check another option if available
    await page.locator('#visibility-custom').check();

    await page.locator('#viewers').fill('admin');

    // Edit editability - uncheck private and check another option if available
    await page.locator('#editability-custom').check();

    // Who gets edit access 
    await page.locator('#editors').fill('admin');

    // This part beleow is non-functional at this time due to problem in code surrounding parent roadmap selection.
    // await page.locator('#parent-roadmap').selectOption("Ingen förälder");

    // Click the save button
    await page.locator('#submit-button').click();

    // Verify the save was successful
    await expect(page).toHaveURL(/\/metaRoadmap\/[a-zA-Z0-9-]+$/);
    await expect(page.getByRole('heading', { name: metaRoadmapNameAllFieldsUpdated })).toBeVisible();

    // Click the edit button again to verify all changes were saved
    await page.getByTestId('admin-panel-edit').click();

    // Wait for edit page to load
    await expect(page).toHaveURL(/\/metaRoadmap\/[a-zA-Z0-9-]+\/edit/);

    // Verify name was updated
    await expect(page.locator('#name')).toHaveValue(metaRoadmapNameAllFieldsUpdated);

    // Verify description was updated
    await expect(page.locator('.tiptap').first()).toHaveText('Updated Description All');

    // Verify type was updated
    await expect(page.locator('#type')).toHaveValue('OTHER');

    // Verify actor field was updated
    await expect(page.locator('#actor')).toHaveValue('Updated Actor All');

    // Verify visibility was unchecked
    await expect(page.locator('#visibility-custom')).toBeChecked();

    // Verify visibility value was updated    
    await expect(page.locator('#viewers')).toHaveValue('admin');

    // Verify editability was unchecked
    await expect(page.locator('#editability-custom')).toBeChecked();

    // Verify user has edit access
    await expect(page.locator('#editors')).toHaveValue('admin');
  });

  test("Create MetaRoadmap and Roadmap - Required Fields", async ({ page }, testInfo) => {

    metaRoadmapNameRequiredFields = `Test Required ${testInfo.parallelIndex}`;
    // Navigate to create metaRoadmap page
    await page.goto('/metaRoadmap/create');

    // Fill in the metaRoadmap form
    await page.locator('#name').fill(metaRoadmapNameRequiredFields);

    // Fill description in the tiptap editor
    await page.locator('.tiptap').first().fill('Test Required');

    // Select roadmap type
    await page.locator('#type').selectOption("LOCAL");

    // Fill in actor field
    await page.locator('#actor').fill("Test Required");

    // Set visibility to private
    await page.locator('#visibility-private').check();

    // Set editability to private
    await page.locator('#editability-private').check();

    // Submit the form
    await page.locator('#submit-button').click();

    // Wait for redirect to roadmap creation page
    await expect(page).toHaveURL(/\/roadmap\/create/);

    // Set visibility - "Vem får se färdplanen?" (Who can see the roadmap?)
    await page.locator('#visibility-private').check();

    // Set editability - "Vem får redigera färdplanen?" (Who can edit the roadmap?)
    await page.locator('#editability-private').check();

    // Submit the roadmap form
    await page.locator('#submit-button').click();

    // Verify successful roadmap creation by checking the redirect
    await expect(page).toHaveURL(/\/roadmap\/[a-zA-Z0-9-]+/);

    // Look for heading text
    await expect(page.getByRole('heading', { name: metaRoadmapNameRequiredFields })).toBeVisible();

    // Save roadmap URL 
    const urlRequiredFields = page.url();
    roadmapidRequiredFields = urlRequiredFields.split('/roadmap/')[1].split('?')[0];
  });

  test("Edit roadmap, no changes - Required Fields", async ({ page }) => {

    await page.goto('/');

<<<<<<< Updated upstream
    await page.getByRole('link', { name: `${metaRoadmapNameRequiredFields}` }).first().click();
=======
    // Find and click the roadmap link using the stored roadmap ID
    await page.locator(`[href="/roadmap/${roadmapidRequiredFields}"]`).first().click();
>>>>>>> Stashed changes

    // Click the edit button
    await page.getByTestId('admin-panel-edit').click();

    // Wait for edit page to load
    await expect(page).toHaveURL(/\/roadmap\/[a-zA-Z0-9-]+\/edit/);

    // Verify visibility is set
    await expect(page.locator('#visibility-private')).toBeChecked();

    // Verify editability is set
    await expect(page.locator('#editability-custom')).toBeChecked();

    // Verify admin user is in the editors list
    await expect(page.locator('#editors')).toHaveValue('admin');

    // Click the save button
    await page.locator('#submit-button').click();

    // Verify the save was successful
    await expect(page).toHaveURL(/\/roadmap\/[a-zA-Z0-9-]+$/);
    await expect(page.getByTestId('admin-panel-edit')).toBeVisible();
  });

  test("Edit MetaRoadmap, no changes - Required Fields", async ({ page }) => {

    await page.goto('/');

<<<<<<< Updated upstream
    await page.getByRole('link', { name: `${metaRoadmapNameRequiredFields}` }).first().click();
=======
    // Find and click the roadmap link using the stored roadmap ID
    await page.locator(`[href="/roadmap/${roadmapidRequiredFields}"]`).first().click();
>>>>>>> Stashed changes

    // Go to MetaRoadmap page
    await page.getByTestId('show-roadmap-series').click();

    //  Wait for MetaRoadmap page to load
    await expect(page).toHaveURL(/\/metaRoadmap\/[a-zA-Z0-9-]+$/);

    // Click the edit button
    await page.getByTestId('admin-panel-edit').click();

    // Wait for edit page to load
    await expect(page).toHaveURL(/\/metaRoadmap\/[a-zA-Z0-9-]+\/edit/);

    // Verify name is filled in
    await expect(page.locator('#name')).toHaveValue(metaRoadmapNameRequiredFields);

    // Verify description in the tiptap editor is filled in
    await expect(page.locator('.tiptap').first()).toHaveText('Test Required');

    // Verify type is set
    await expect(page.locator('#type')).toHaveValue('LOCAL');

    // Verify actor field is filled in
    await expect(page.locator('#actor')).toHaveValue('Test Required');

    // Verify visibility is set
    await expect(page.locator('#visibility-private')).toBeChecked();

    // Verify editability is set
    await expect(page.locator('#editability-private')).toBeChecked();

    // Click the save button
    await page.locator('#submit-button').click();

    // Verify the save was successful
    await expect(page).toHaveURL(/\/metaRoadmap\/[a-zA-Z0-9-]+$/);
    await expect(page.getByRole('heading', { name: metaRoadmapNameRequiredFields })).toBeVisible();
  });

  test("Edit roadmap, updated fields - Required Fields", async ({ page }) => {

    await page.goto('/');

<<<<<<< Updated upstream
    await page.getByRole('link', { name: `${metaRoadmapNameRequiredFields}` }).first().click();
=======
    // Find and click the roadmap link using the stored roadmap ID
    await page.locator(`[href="/roadmap/${roadmapidRequiredFields}"]`).first().click();
>>>>>>> Stashed changes

    // Click the edit button
    await page.getByTestId('admin-panel-edit').click();

    // Wait for edit page to load
    await expect(page).toHaveURL(/\/roadmap\/[a-zA-Z0-9-]+\/edit/);

    // Edit description in the tiptap editor
    await page.locator('.tiptap').first().fill('Updated Roadmap Description Required');

    // Edit visibility - change to custom
    await page.locator('#visibility-custom').check();

    // Add viewers
    await page.locator('#viewers').fill('admin');

    // Edit editability - change to custom if not already
    await page.locator('#editability-custom').check();

    // Update editors list
    await page.locator('#editors').fill('admin');

    // Click the save button
    await page.locator('#submit-button').click();

    // Verify the save was successful
    await expect(page).toHaveURL(/\/roadmap\/[a-zA-Z0-9-]+$/);
    await expect(page.getByRole('heading', { name: metaRoadmapNameRequiredFields })).toBeVisible();

    // Click the edit button again to verify all changes were saved
    await page.getByTestId('admin-panel-edit').click();

    // Wait for edit page to load
    await expect(page).toHaveURL(/\/roadmap\/[a-zA-Z0-9-]+\/edit/);

    // Verify description was updated
    await expect(page.locator('.tiptap').first()).toContainText('Updated Roadmap Description Required');

    // Verify visibility was changed to custom
    await expect(page.locator('#visibility-custom')).toBeChecked();

    // Verify viewers were added
    await expect(page.locator('#viewers')).toHaveValue('admin');

    // Verify editability was changed to custom
    await expect(page.locator('#editability-custom')).toBeChecked();

    // Verify editors list was updated
    await expect(page.locator('#editors')).toHaveValue('admin');
  });

  test("Edit MetaRoadmap, updated fields - Required Fields", async ({ page }) => {

    metaRoadmapNameRequiredFieldsUpdated = `Updated ${metaRoadmapNameRequiredFields}`;

    await page.goto('/');

<<<<<<< Updated upstream
    await page.getByRole('link', { name: `${metaRoadmapNameRequiredFields}` }).first().click();
=======
    // Find and click the roadmap link using the stored roadmap ID
    await page.locator(`[href="/roadmap/${roadmapidRequiredFields}"]`).first().click();
>>>>>>> Stashed changes

    // Go to MetaRoadmap page
    await page.getByTestId('show-roadmap-series').click();

    //  Wait for MetaRoadmap page to load
    await expect(page).toHaveURL(/\/metaRoadmap\/[a-zA-Z0-9-]+$/);

    // Click the edit button
    await page.getByTestId('admin-panel-edit').click();

    // Wait for edit page to load
    await expect(page).toHaveURL(/\/metaRoadmap\/[a-zA-Z0-9-]+\/edit/);

    // Edit name
    await page.locator('#name').fill(metaRoadmapNameRequiredFieldsUpdated);

    // Edit description in the tiptap editor
    await page.locator('.tiptap').first().fill('Updated Description Required');

    // Edit type
    await page.locator('#type').selectOption("OTHER");

    // Edit actor field
    await page.locator('#actor').fill("Updated Actor Required");

    // Edit visibility - uncheck private and check another option if available
    await page.locator('#visibility-custom').check();

    await page.locator('#viewers').fill('admin');

    // Edit editability - uncheck private and check another option if available
    await page.locator('#editability-custom').check();

    // Who gets edit access 
    await page.locator('#editors').fill('admin');

    // This part beleow is non-functional at this time due to problem in code surrounding parent roadmap selection.
    // await page.locator('#parent-roadmap').selectOption("Ingen förälder");

    // Click the save button
    await page.locator('#submit-button').click();

    // Verify the save was successful
    await expect(page).toHaveURL(/\/metaRoadmap\/[a-zA-Z0-9-]+$/);
    await expect(page.getByRole('heading', { name: metaRoadmapNameRequiredFieldsUpdated })).toBeVisible();

    // Click the edit button again to verify all changes were saved
    await page.getByTestId('admin-panel-edit').click();

    // Wait for edit page to load
    await expect(page).toHaveURL(/\/metaRoadmap\/[a-zA-Z0-9-]+\/edit/);

    // Verify name was updated
    await expect(page.locator('#name')).toHaveValue(metaRoadmapNameRequiredFieldsUpdated);

    // Verify description was updated
    await expect(page.locator('.tiptap').first()).toHaveText('Updated Description Required');

    // Verify type was updated
    await expect(page.locator('#type')).toHaveValue('OTHER');

    // Verify actor field was updated
    await expect(page.locator('#actor')).toHaveValue('Updated Actor Required');

    // Verify visibility was unchecked
    await expect(page.locator('#visibility-custom')).toBeChecked();

    // Verify visibility value was updated    
    await expect(page.locator('#viewers')).toHaveValue('admin');

    // Verify editability was unchecked
    await expect(page.locator('#editability-custom')).toBeChecked();

    // Verify user has edit access
    await expect(page.locator('#editors')).toHaveValue('admin');
  });

});