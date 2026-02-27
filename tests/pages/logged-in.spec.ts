import { expect, test } from "playwright/test";
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename); // get the name of the directory

const adminFile = path.join(__dirname, '../.auth/admin.json');

test.describe("Logged in tests", () => {
  test.use({ storageState: adminFile });

  test("Create MetaRoadmap and Roadmap - All Fields", async ({ page }) => {

    // Navigate to create metaRoadmap page
    await page.goto('/metaRoadmap/create');

    // Fill in the metaRoadmap form
    await page.locator('#name').fill("Test All");

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

    // Accept the alert dialog
    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });

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

    // Listen for success dialog
    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });

    // Verify successful roadmap creation by checking the redirect
    await expect(page).toHaveURL(/\/roadmap\/[a-zA-Z0-9-]+/);

    await expect(page.getByRole('heading', { name: 'Test All' })).toBeVisible();
  });

  test("Edit roadmap, no changes - All Fields", async ({ page }) => {

    await page.goto('/');

    await page.getByRole('link', { name: 'Test All (v1)' }).first().click();

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

    // Accept the success dialog
    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });

    // Verify the save was successful
    await expect(page).toHaveURL(/\/roadmap\/[a-zA-Z0-9-]+$/);
    await expect(page.getByTestId('admin-panel-edit')).toBeVisible();
  });

  test("Edit MetaRoadmap, no changes - All Fields", async ({ page }) => {

    await page.goto('/');

    await page.getByRole('link', { name: 'Test All (v1)' }).first().click();

    // Go to MetaRoadmap page
    await page.getByTestId('show-roadmap-series').click();

    //  Wait for MetaRoadmap page to load
    await expect(page).toHaveURL(/\/metaRoadmap\/[a-zA-Z0-9-]+$/);

    // Click the edit button
    await page.getByTestId('admin-panel-edit').click();

    // Wait for edit page to load
    await expect(page).toHaveURL(/\/metaRoadmap\/[a-zA-Z0-9-]+\/edit/);

    await expect(page.locator('#name')).toHaveValue('Test All');

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

    // Accept the success dialog
    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });

    // Verify the save was successful
    await expect(page).toHaveURL(/\/metaRoadmap\/[a-zA-Z0-9-]+$/);
    await expect(page.getByRole('heading', { name: 'Test All' })).toBeVisible();
  });

  test("Edit roadmap, updated fields - All Fields", async ({ page }) => {

    await page.goto('/');

    await page.getByRole('link', { name: 'Test All (v1)' }).first().click();

    // Click the edit button
    await page.getByTestId('admin-panel-edit').click();

    // Wait for edit page to load
    await expect(page).toHaveURL(/\/roadmap\/[a-zA-Z0-9-]+\/edit/);

    // Edit description in the tiptap editor
    await page.locator('.tiptap').first().clear();
    await page.locator('.tiptap').first().fill('Updated Roadmap Description All');

    // Edit visibility - change to custom
    await page.locator('#visibility-custom').check();

    // Add viewers
    await page.locator('#viewers').fill('admin');

    // Edit editability - change to custom if not already
    await page.locator('#editability-custom').check();

    // Update editors list
    await page.locator('#editors').clear();
    await page.locator('#editors').fill('admin');

    // Click the save button
    await page.locator('#submit-button').click();

    // Accept the success dialog
    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });

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

    await page.goto('/');

    await page.getByRole('link', { name: 'Test All (v1)' }).first().click();

    // Go to MetaRoadmap page
    await page.getByTestId('show-roadmap-series').click();

    //  Wait for MetaRoadmap page to load
    await expect(page).toHaveURL(/\/metaRoadmap\/[a-zA-Z0-9-]+$/);

    // Click the edit button
    await page.getByTestId('admin-panel-edit').click();

    // Wait for edit page to load
    await expect(page).toHaveURL(/\/metaRoadmap\/[a-zA-Z0-9-]+\/edit/);

    // Edit name
    await page.locator('#name').clear();
    await page.locator('#name').fill('Updated Name All');

    // Edit description in the tiptap editor
    await page.locator('.tiptap').first().clear();
    await page.locator('.tiptap').first().fill('Updated Description All');

    // Edit type
    await page.locator('#type').selectOption("OTHER");

    // Edit actor field
    await page.locator('#actor').clear();
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

    // Accept the success dialog
    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });

    // Verify the save was successful
    await expect(page).toHaveURL(/\/metaRoadmap\/[a-zA-Z0-9-]+$/);
    await expect(page.getByRole('heading', { name: 'Updated Name All' })).toBeVisible();

    // Click the edit button again to verify all changes were saved
    await page.getByTestId('admin-panel-edit').click();

    // Wait for edit page to load
    await expect(page).toHaveURL(/\/metaRoadmap\/[a-zA-Z0-9-]+\/edit/);

    // Verify name was updated
    await expect(page.locator('#name')).toHaveValue('Updated Name All');

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

  test("Create MetaRoadmap and Roadmap - Required Fields", async ({ page }) => {

    // Navigate to create metaRoadmap page
    await page.goto('/metaRoadmap/create');

    // Fill in the metaRoadmap form
    await page.locator('#name').fill("Test Required");

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

    // Accept the alert dialog
    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });

    // Wait for redirect to roadmap creation page
    await expect(page).toHaveURL(/\/roadmap\/create/);

    // Set visibility - "Vem får se färdplanen?" (Who can see the roadmap?)
    await page.locator('#visibility-private').check();

    // Set editability - "Vem får redigera färdplanen?" (Who can edit the roadmap?)
    await page.locator('#editability-private').check();

    // Submit the roadmap form
    await page.locator('#submit-button').click();

    // Listen for success dialog
    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });

    // Verify successful roadmap creation by checking the redirect
    await expect(page).toHaveURL(/\/roadmap\/[a-zA-Z0-9-]+/);

    await expect(page.getByRole('heading', { name: 'Test Required' })).toBeVisible();
  });

  test("Edit roadmap, no changes - Required Fields", async ({ page }) => {

    await page.goto('/');

    await page.getByRole('link', { name: 'Test Required (v1)' }).first().click();

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

    // Accept the success dialog
    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });

    // Verify the save was successful
    await expect(page).toHaveURL(/\/roadmap\/[a-zA-Z0-9-]+$/);
    await expect(page.getByTestId('admin-panel-edit')).toBeVisible();
  });

  test("Edit MetaRoadmap, no changes - Required Fields", async ({ page }) => {

    await page.goto('/');

    await page.getByRole('link', { name: 'Test Required (v1)' }).first().click();

    // Go to MetaRoadmap page
    await page.getByTestId('show-roadmap-series').click();

    //  Wait for MetaRoadmap page to load
    await expect(page).toHaveURL(/\/metaRoadmap\/[a-zA-Z0-9-]+$/);

    // Click the edit button
    await page.getByTestId('admin-panel-edit').click();

    // Wait for edit page to load
    await expect(page).toHaveURL(/\/metaRoadmap\/[a-zA-Z0-9-]+\/edit/);

    await expect(page.locator('#name')).toHaveValue('Test Required');

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

    // Accept the success dialog
    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });

    // Verify the save was successful
    await expect(page).toHaveURL(/\/metaRoadmap\/[a-zA-Z0-9-]+$/);
    await expect(page.getByRole('heading', { name: 'Test Required' })).toBeVisible();
  });

  test("Edit roadmap, updated fields - Required Fields", async ({ page }) => {

    await page.goto('/');

    await page.getByRole('link', { name: 'Test Required (v1)' }).first().click();

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
    await page.locator('#editors').clear();
    await page.locator('#editors').fill('admin');

    // Click the save button
    await page.locator('#submit-button').click();

    // Accept the success dialog
    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });

    // Verify the save was successful
    await expect(page).toHaveURL(/\/roadmap\/[a-zA-Z0-9-]+$/);

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

    await page.goto('/');

    await expect(page.getByRole('link', { name: 'Test Required (v1)' }).first()).toBeVisible();
    await page.getByRole('link', { name: 'Test Required (v1)' }).first().click();

    // Go to MetaRoadmap page
    await page.getByTestId('show-roadmap-series').click();

    //  Wait for MetaRoadmap page to load
    await expect(page).toHaveURL(/\/metaRoadmap\/[a-zA-Z0-9-]+$/);

    // Click the edit button
    await page.getByTestId('admin-panel-edit').click();

    // Wait for edit page to load
    await expect(page).toHaveURL(/\/metaRoadmap\/[a-zA-Z0-9-]+\/edit/);

    // Edit name
    await page.locator('#name').clear();
    await page.locator('#name').fill('Updated Name Required');

    // Edit description in the tiptap editor
    await page.locator('.tiptap').first().fill('Updated Description Required');

    // Edit type
    await page.locator('#type').selectOption("OTHER");

    // Edit actor field
    await page.locator('#actor').clear();
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

    // Accept the success dialog
    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });

    // Verify the save was successful
    await expect(page).toHaveURL(/\/metaRoadmap\/[a-zA-Z0-9-]+$/);
    await expect(page.getByRole('heading', { name: 'Updated Name Required' })).toBeVisible();

    // Click the edit button again to verify all changes were saved
    await page.getByTestId('admin-panel-edit').click();

    // Wait for edit page to load
    await expect(page).toHaveURL(/\/metaRoadmap\/[a-zA-Z0-9-]+\/edit/);

    // Verify name was updated
    await expect(page.locator('#name')).toHaveValue('Updated Name Required');

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

  test('Create goal required only', async ({ page }) => {

    // Does not work properly has as "skalär" wrongfully functions as an id and therefore blocks tests after the first. Running the tests separately by adding --project="{browser} 1080p" works.

    //Opening the from
    await page.goto('/');
    await page.waitForLoadState("networkidle");

    await page.getByTestId('create-button').click();
    await page.getByTestId('create-goal').click();
    await page.waitForLoadState("networkidle");

    //From Part 1
    await page.locator('#parent-roadmap').click();
    await page.getByRole('option', { name: "Rikets färdplan (v2)" }).click(); //Switch to 'test' when available

    //From Part 3
    await page.locator('#select-preset').selectOption("Skala serie"); //Might need to be switched to a non language dependent selector

    await page.locator('#recipeVariable0').click();
    await page.getByRole('treeitem', { name: 'Rikets färdplan (v2)' }).click(); //Switch to 'test' when available
    await page.getByRole('treeitem', { level: 2 }).first().click();

    //Form Submit
    await page.locator('#submit-button').click();
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole('heading').nth(1)).toBeEmpty();
    await expect(page.locator('#rich-description')).toBeEmpty();
  });

  test('Create goal all', async ({ page }) => {

    // Does not work properly has as "skalär" wrongfully functions as an id and therefore blocks tests after the first. Running the tests separately by adding --project="{browser} 1080p" works.

    //Opening the from
    await page.goto('/');
    await page.waitForLoadState("networkidle");

    await page.getByTestId('create-button').click();
    await page.getByTestId('create-goal').click();
    await page.waitForLoadState("networkidle");

    //From Part 1
    await page.locator('#parent-roadmap').click();
    await page.getByRole('option', { name: "Rikets färdplan (v2)" }).click(); //Switch to 'test' when available

    //Form Part 2
    await page.locator('#goalName').fill("Test Goal");
    await page.getByRole('textbox').nth(1).fill("This is a test goal"); //Might be a better way of getting this element

    //Form Part 3
    await page.locator('#select-preset').selectOption("Skala serie"); //Might need to be switched to a non language dependent selector
    await page.locator('#recipeVariable0').click();
    await page.getByRole('treeitem', { name: 'Rikets färdplan (v2)' }).click(); //Switch to 'test' when available
    await page.getByRole('treeitem', { level: 2 }).first().click();
    await page.locator('#scalar-skalär').fill("2") //Mainly done to get around the skalär/id problem

    //Form part 4
    await page.locator('#baselineSelector').selectOption({ value: "INHERIT" });
    await page.locator('#selectedRoadmap').selectOption({ index: 1 });
    await page.locator('#inheritFrom').selectOption({ index: 1 });

    //Form part 5
    await page.locator('#isFeatured').check();

    //Form Submit
    await page.locator('#submit-button').click();
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole('heading').nth(1)).toHaveText('Test Goal');
    await expect(page.locator('#rich-description')).toHaveText('This is a test goal');
  });

});
