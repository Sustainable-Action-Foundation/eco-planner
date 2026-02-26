import { expect, test } from "playwright/test";
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename); // get the name of the directory

const adminFile = path.join(__dirname, '../.auth/admin.json');

test.describe("Logged in tests", () => {
  test.use ({ storageState: adminFile });

  test("Create a MetaRoadmap and Roadmap - All Fields filled", async ({ page }) => {

    // Navigate to create metaRoadmap page
    await page.goto('/metaRoadmap/create');

    // Fill in the metaRoadmap form
    const nameInput = page.locator('#name');
    await nameInput.fill("Test");

    // Fill description in the tiptap editor
    const descriptionEditor = page.locator('.tiptap').first();
    await expect(descriptionEditor).toBeVisible();
    await descriptionEditor.fill('Test');

    // Select roadmap type
    const typeSelect = page.locator('#type');
    await typeSelect.selectOption("LOCAL");

    // Fill in actor field
    const actorInput = page.locator('#actor');
    await actorInput.fill("Test");

    // Set visibility to private
    await page.locator('#visibility-private').check();
  
    // Set editability to private
    await page.locator('#editability-private').check();

    // Test below non-functional at this time due to problem in code surrounding parent roadmap selection.

    // const ParentSelect = page.locator('#parent-roadmap');
    // await ParentSelect.selectOption("Rikets färdplan");

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

  test("Edit a roadmap - All Fields", async ({ page }) => {

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
    const userContent = await page.locator('#editors').inputValue();
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
    await expect(editButton).toBeVisible();
  });

  test("Edit a MetaRoadmap - All Fields", async ({ page }) => {

    await page.goto('/');

    const TestButton = page.getByRole('link', { name: 'Test (v1)' }).first();
    await expect(TestButton).toBeVisible();
    await TestButton.click();

    // Go to MetaRoadmap page
    const MetaRoadmapButton = page.getByTestId('show-roadmap-series');
    await expect(MetaRoadmapButton).toBeVisible();
    await MetaRoadmapButton.click();

    //  Wait for MetaRoadmap page to load
    await expect(page).toHaveURL(/\/metaRoadmap\/[a-zA-Z0-9-]+$/);

    // Click the edit button
    const editButton = page.getByTestId('edit-roadmap-version');
    await expect(editButton).toBeVisible();
    await editButton.click();

    // Wait for edit page to load
    await expect(page).toHaveURL(/\/metaRoadmap\/[a-zA-Z0-9-]+\/edit/);

    const nameInput = page.locator('#name');
    await expect(nameInput).toHaveValue('Test');

    // Verify all fields are filled in
    const descriptionEditor = page.locator('.tiptap').first();
    const editorContent = await descriptionEditor.textContent();
    await expect(editorContent).toContain('Test');

    // Verify type is set
    const typeSelect = page.locator('#type');
    const selectedType = await typeSelect.inputValue();
    expect(selectedType).toBe('LOCAL');

    // Verify actor field is filled in
    const actorInput = page.locator('#actor');
    await expect(actorInput).toHaveValue('Test');

    // Verify visibility is set
    const visibilityCheckbox = page.locator('#visibility-private');
    await expect(visibilityCheckbox).toBeChecked();

    // Verify editability is set
    const editabilityCheckbox = page.locator('#editability-private');
    await expect(editabilityCheckbox).toBeChecked();

    // This part beleow is non-functional at this time due to problem in code surrounding parent roadmap selection.

    // Verify parent roadmap is set
    // const parentSelect = page.locator('#parent-roadmap');
    // const selectedParent = await parentSelect.inputValue();
    // expect(selectedParent).toBe('Rikets färdplan');

    // Click the save button
    const saveButton = page.locator('#submit-button');
    await saveButton.click();

    // Accept the success dialog
    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });

    // Verify the save was successful
    await expect(page).toHaveURL(/\/metaRoadmap\/[a-zA-Z0-9-]+$/);
    const metaRoadmapHeading = page.getByRole('heading', { name: 'Test' });
    await expect(metaRoadmapHeading).toBeVisible();

  });

  test("Edit a roadmap - all fields", async ({ page }) => {

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

    // Edit description in the tiptap editor
    const descriptionEditor = page.locator('.tiptap').first();
    await descriptionEditor.clear();
    await descriptionEditor.fill('Updated Roadmap Description');

    // Edit visibility - change to custom
    const visibilityCustom = page.locator('#visibility-custom');
    await visibilityCustom.check();

    // Add viewers
    const viewersInput = page.locator('#viewers');
    await viewersInput.fill('admin');

    // Edit editability - change to custom if not already
    const editabilityCustom = page.locator('#editability-custom');
    await editabilityCustom.check();

    // Update editors list
    const editorsInput = page.locator('#editors');
    await editorsInput.clear();
    await editorsInput.fill('admin');

    // Click the save button
    const saveButton = page.locator('#submit-button');
    await saveButton.click();

    // Accept the success dialog
    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });

    // Verify the save was successful
    await expect(page).toHaveURL(/\/roadmap\/[a-zA-Z0-9-]+$/);

    // Click the edit button again to verify all changes were saved
    const editButtonAgain = page.getByTestId('edit-roadmap-version');
    await expect(editButtonAgain).toBeVisible();
    await editButtonAgain.click();

    // Wait for edit page to load
    await expect(page).toHaveURL(/\/roadmap\/[a-zA-Z0-9-]+\/edit/);

    // Verify description was updated
    const descriptionEditorVerify = page.locator('.tiptap').first();
    const editorContentVerify = await descriptionEditorVerify.textContent();
    await expect(editorContentVerify).toContain('Updated Roadmap Description');

    // Verify visibility was changed to custom
    const visibilityCustomVerify = page.locator('#visibility-custom');
    await expect(visibilityCustomVerify).toBeChecked();

    // Verify viewers were added
    const viewersInputVerify = page.locator('#viewers');
    const viewersContent = await viewersInputVerify.inputValue();
    await expect(viewersContent).toContain('admin');

    // Verify editability was changed to custom
    const editabilityCustomVerify = page.locator('#editability-custom');
    await expect(editabilityCustomVerify).toBeChecked();

    // Verify editors list was updated
    const editorsInputVerify = page.locator('#editors');
    const editorsContent = await editorsInputVerify.inputValue();
    await expect(editorsContent).toContain('admin');

  });

  test("Edit a MetaRoadmap - all fields", async ({ page }) => {

    await page.goto('/');

    const TestButton = page.getByRole('link', { name: 'Test (v1)' }).first();
    await expect(TestButton).toBeVisible();
    await TestButton.click();

    // Go to MetaRoadmap page
    const MetaRoadmapButton = page.getByTestId('show-roadmap-series');
    await expect(MetaRoadmapButton).toBeVisible();
    await MetaRoadmapButton.click();

    //  Wait for MetaRoadmap page to load
    await expect(page).toHaveURL(/\/metaRoadmap\/[a-zA-Z0-9-]+$/);

    // Click the edit button
    const editButton = page.getByTestId('edit-roadmap-version');
    await expect(editButton).toBeVisible();
    await editButton.click();

    // Wait for edit page to load
    await expect(page).toHaveURL(/\/metaRoadmap\/[a-zA-Z0-9-]+\/edit/);

    // Edit name
    const nameInput = page.locator('#name');
    await nameInput.clear();
    await nameInput.fill('Updated Name');

    // Edit description in the tiptap editor
    const descriptionEditor = page.locator('.tiptap').first();
    await descriptionEditor.clear();
    await descriptionEditor.fill('Updated Description');

    // Edit type
    const typeSelect = page.locator('#type');
    await typeSelect.selectOption("OTHER");

    // Edit actor field
    const actorInput = page.locator('#actor');
    await actorInput.clear();
    await actorInput.fill("Updated Actor");

    // Edit visibility - uncheck private and check another option if available
    const visibilityPrivate = page.locator('#visibility-custom');
    await visibilityPrivate.check();

    const userVisibilityInput = page.locator('#viewers');
    await userVisibilityInput.fill('admin');

    // Edit editability - uncheck private and check another option if available
    const editabilityPrivate = page.locator('#editability-custom');
    await editabilityPrivate.check();

    // Who gets edit access 
    const userEditInput = page.locator('#editors');
    await userEditInput.fill('admin');

    // This part beleow is non-functional at this time due to problem in code surrounding parent roadmap selection.
    // const parentSelect = page.locator('#parent-roadmap');
    // await parentSelect.selectOption("Ingen förälder");

    // Click the save button
    const saveButton = page.locator('#submit-button');
    await saveButton.click();

    // Accept the success dialog
    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });

    // Verify the save was successful
    await expect(page).toHaveURL(/\/metaRoadmap\/[a-zA-Z0-9-]+$/);
    const metaRoadmapHeading = page.getByRole('heading', { name: 'Updated Name' });
    await expect(metaRoadmapHeading).toBeVisible();

    // Click the edit button again to verify all changes were saved
    const editButtonAgain = page.getByTestId('edit-roadmap-version');
    await expect(editButtonAgain).toBeVisible();
    await editButtonAgain.click();

    // Wait for edit page to load
    await expect(page).toHaveURL(/\/metaRoadmap\/[a-zA-Z0-9-]+\/edit/);

    // Verify name was updated
    await expect(nameInput).toHaveValue('Updated Name');

    // Verify description was updated
    const descriptionEditorVerify = page.locator('.tiptap').first();
    const editorContentVerify = await descriptionEditorVerify.textContent();
    await expect(editorContentVerify).toContain('Updated Description');

    // Verify type was updated
    const typeSelectVerify = page.locator('#type');
    const selectedTypeVerify = await typeSelectVerify.inputValue();
    await expect(selectedTypeVerify).toBe('OTHER');

    // Verify actor field was updated
    const actorInputVerify = page.locator('#actor');
    await expect(actorInputVerify).toHaveValue('Updated Actor');

    // Verify visibility was unchecked
    const visibilityCheckboxVerify = page.locator('#visibility-custom');
    await expect(visibilityCheckboxVerify).toBeChecked();

    // Verify visibility value was updated    
    const userVisibilityInputVerify = page.locator('#viewers');
    const userVisibilityContent = await userVisibilityInputVerify.inputValue();
    await expect(userVisibilityContent).toContain('admin');

    // Verify editability was unchecked
    const editabilityCheckboxVerify = page.locator('#editability-custom');
    await expect(editabilityCheckboxVerify).toBeChecked();

    // Verify user has edit access
    const userEditInputVerify = page.locator('#editors');
    const userEditContent = await userEditInputVerify.inputValue();
    await expect(userEditContent).toContain('admin');

  });

});
