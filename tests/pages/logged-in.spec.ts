import { expect, test } from "playwright/test";
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename); // get the name of the directory

const adminFile = path.join(__dirname, '../.auth/admin.json');

test.describe("Logged in tests", () => {
  test.use ({ storageState: adminFile });

  test("Create a MetaRoadmap and Roadmap", async ({ page }) => {

    // Navigate to create metaRoadmap page
    await page.goto('/metaRoadmap/create');

    // Fill in the metaRoadmap form
    const nameInput = page.locator('input[name="name"]');
    await nameInput.fill("Test");

    // Select roadmap type
    const typeSelect = page.locator('select[name="type"]');
    await typeSelect.selectOption("LOCAL");

    // Fill in actor field
    const actorInput = page.locator('input[name="actor"]');
    await actorInput.fill("Test");

    // Set visibility to private
    await page.locator('#visibility-private').check();
  
    // Set editability to private
    await page.locator('#editability-private').check();

    // Submit the form
    const submitButton = page.locator('#submit-button');
    await submitButton.click();

    // Accept the alert dialog
    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });

    // Wait for redirect to roadmap creation page
    await expect(page).toHaveURL(/\/roadmap\/create/);

    // Fill in the roadmap form
    // Fill description in the tiptap editor
    const tiptapEditor = page.locator('.tiptap').first();
    await expect(tiptapEditor).toBeVisible();
    await tiptapEditor.click();
    await tiptapEditor.fill('Test');

    // Set visibility - "Vem får se färdplanen?" (Who can see the roadmap?)
    await page.locator('#visibility-private').check();

    // Set editability - "Vem får redigera färdplanen?" (Who can edit the roadmap?)
    await page.locator('#editability-private').check();

    // Submit the roadmap form
    const roadmapSubmitButton = page.locator('#submit-button');
    await roadmapSubmitButton.click();

    // Listen for success dialog
    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });

    // Verify successful roadmap creation by checking the redirect
    await expect(page).toHaveURL(/\/roadmap\/[a-zA-Z0-9-]+/);

    const roadmapHeading = page.getByRole('heading', { name: 'Test' });
    await expect(roadmapHeading).toBeVisible();
    
  });

  test("Edit a roadmap", async ({ page }) => {

    await page.goto('/');

    const TestButton = page.getByRole('link', { name: 'Test (v1)' }).first();
    await expect(TestButton).toBeVisible();
    await TestButton.click();

    // Click the edit button
    const editButton = page.getByTestId('edit-roadmap-version');
    await expect(editButton).toBeVisible();
    await editButton.click();

    // Wait for edit page to load
    await expect(page).toHaveURL(/\/roadmap\/[a-zA-Z0-9-]+\/edit/);

    // Verify all fields are filled in
    const descriptionEditor = page.locator('.tiptap').first();
    const editorContent = await descriptionEditor.textContent();
    await expect(editorContent).toContain('Test');

    // Verify visibility is set
    const visibilityCheckbox = page.locator('#visibility-private');
    await expect(visibilityCheckbox).toBeChecked();

    // Verify editability is set
    const editabilityCheckbox = page.locator('#editability-custom');
    await expect(editabilityCheckbox).toBeChecked();

    // Verify admin user is in the editors list
    const userContent = await page.locator('input[name="editors"]').inputValue();
    expect(userContent).toContain('admin');

    // Click the save button
    const saveButton = page.locator('#submit-button');
    await saveButton.click();

    // Accept the success dialog
    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });

    // Verify the save was successful
    await expect(page).toHaveURL(/\/roadmap\/[a-zA-Z0-9-]+$/);
    const roadmapHeading = page.getByRole('heading', { name: 'Test' });
    await expect(roadmapHeading).toBeVisible();
  });

});
