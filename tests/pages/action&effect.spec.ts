import { expect, test } from "playwright/test";
import path from 'path';
import { fileURLToPath } from 'url';
import { act } from "react";

const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename); // get the name of the directory

const adminFile = path.join(__dirname, '../.auth/admin.json');

test.describe("Action & Effect tests", async () => {
    test.use({ storageState: adminFile });
    let actionNameRequiredFields = "";
    let actionNameRequiredFieldsUpdated = "";
    let actionNameAllFields = "";
    let actionNameAllFieldsUpdated = "";

    // Action tests begin here //
    test("Create Action - required", async ({ page }, testInfo ) => {
        actionNameRequiredFields = `Test Action ${testInfo.parallelIndex}`;
        // Navigate to the action creation form
        await page.goto('/');
        await page.getByTestId("create-button").click();
        await page.getByTestId("create-action").click();

        const option = page.locator('#roadmapId option').filter({ hasText: 'Rikets färdplan (v2)' }); // Checks for Rikets färdplan (v2) to be contained in an option

        const value = await option.getAttribute('value');

        await page.locator('#roadmapId').selectOption(value!);

        await page.locator('#actionName').fill(actionNameRequiredFields);

        await page.locator('#submit-button').click();
        
        await page.waitForLoadState("networkidle");

        await expect(page.getByRole('heading', { name: actionNameRequiredFields })).toBeVisible();
    });

    test("No edit Action - required", async ({ page }) => {
        // Navigate to the action edit form
        await page.goto('/');
        await page.getByRole('link', { name: "Rikets färdplan (v2)" }).click();
        await page.getByRole('heading', { name: "Rikets färdplan" }).hover();
        await page.getByRole('link', { name: actionNameRequiredFields }).first().click();
        await page.waitForLoadState("networkidle");
        await page.getByRole('heading', { name: actionNameRequiredFields }).hover();
        await page.getByTestId("admin-panel-edit").click();

        await expect(page.locator('#actionName')).toHaveValue(actionNameRequiredFields);

        await page.locator('#submit-button').click();

        await expect(page.getByRole('heading', { name: actionNameRequiredFields })).toBeVisible();
    });

    test("Edit Action - required", async ({ page }, testInfo) => {
        actionNameRequiredFieldsUpdated = `Updated Test Action ${testInfo.parallelIndex}`;
        // Navigate to the action edit form
        await page.goto('/');
        await page.getByRole('link', { name: "Rikets färdplan (v2)" }).click();
        await page.getByRole('heading', { name: "Rikets färdplan" }).hover();
        await page.getByRole('link', { name: actionNameRequiredFields }).first().click(); // TODO (fix): The tests doesn't seem to click on the right name here and therefore they fail.
        
        await page.waitForLoadState("networkidle");
        await page.getByTestId("admin-panel-edit").click();

        // Part 1 of the form
        await page.locator('#actionName').fill(actionNameRequiredFieldsUpdated);
        
        await page.locator('.tiptap').first().fill("Updated Test Action description.");

        await page.locator('#costEfficiency').fill("Text for cost efficiency");

        await page.locator('#expectedOutcome').fill("Text for expected outcome");
        
        // Part 2 of the form
        // These two fields are required to be numbers
        await page.locator('#startYear').fill("2025");
        await page.locator('#endYear').fill("2070");

        // Part 3 of the form
        await page.locator('#projectManager').fill("Test Manager");
        await page.locator('#relevantActors').fill("Test Actor");

        // Part 4 of the form
        await page.locator('#isEfficiency').check();
        await page.locator('#isRenewables').check();

        // Submit the form
        await page.locator('#submit-button').click();

        await expect(page.getByRole('heading', { name: actionNameRequiredFieldsUpdated })).toBeVisible();

    });

    test("Create Action - All Fields", async ({ page }, testInfo) => {
        actionNameAllFields = `Test Action All Fields ${testInfo.parallelIndex}`;
        // Navigate to the action edit form
        await page.goto('/');
        await page.getByTestId("create-button").click();
        await page.getByTestId("create-action").click();

        const option = page.locator('#roadmapId option').filter({ hasText: 'Rikets färdplan (v2)' }); // Checks for Rikets färdplan (v2) to be contained in an option

        const value = await option.getAttribute('value');

        await page.locator('#roadmapId').selectOption(value!);

        // Part 1 of the form
        await page.locator('#actionName').fill(actionNameAllFields);
        
        await page.locator('.tiptap').first().fill("Test Action description.");

        await page.locator('#costEfficiency').fill("Text for cost efficiency");

        await page.locator('#expectedOutcome').fill("Text for expected outcome");
        
        // Part 2 of the form
        // These two fields are required to be numbers
        await page.locator('#startYear').fill("2030");
        await page.locator('#endYear').fill("2070");

        // Part 3 of the form
        await page.locator('#projectManager').fill("Test Manager");
        await page.locator('#relevantActors').fill("Test Actor");

        // Part 4 of the form
        await page.locator('#isEfficiency').check();
        await page.locator('#isRenewables').check();

        // Submit the form
        await page.locator('#submit-button').click();

        await page.waitForLoadState("networkidle");

        await expect(page.getByRole('heading', { name: actionNameAllFields })).toBeVisible();
    });

    test("No edit Action - All Fields", async ({ page }) => {
        // Navigate to the action edit form
        await page.goto('/');
        await page.getByRole('link', { name: "Rikets färdplan (v2)" }).click();
        await page.getByRole('heading', { name: "Rikets färdplan" }).hover();
        await page.getByRole('link', { name: actionNameAllFields }).first().click(); // TODO (fix): The tests doesn't seem to click on the right name here and therefore they fail.

        await page.waitForLoadState("networkidle");
        await page.getByRole('heading', { name: actionNameAllFields }).hover();
        await page.getByTestId("admin-panel-edit").click();

        await expect(page.locator('#actionName')).toHaveValue(actionNameAllFields);
        await expect(page.locator('.tiptap').first()).toHaveText("Test Action description.");

        await expect(page.locator('#costEfficiency')).toHaveValue("Text for cost efficiency");
        await expect(page.locator('#expectedOutcome')).toHaveValue("Text for expected outcome");
        
        await expect(page.locator('#startYear')).toHaveValue("2030");
        await expect(page.locator('#endYear')).toHaveValue("2070");
        
        await expect(page.locator('#projectManager')).toHaveValue("Test Manager");
        await expect(page.locator('#relevantActors')).toHaveValue("Test Actor");
        
        await expect(page.locator('#isEfficiency')).toBeChecked();
        await expect(page.locator('#isRenewables')).toBeChecked();

        // Submit the form without making any changes
        await page.locator('#submit-button').click();

        await page.waitForLoadState("networkidle");

        await expect(page.getByTestId("admin-panel-edit")).toBeVisible();
    });

    test("Edit Action - All Fields", async ({ page }, testInfo) => {
        actionNameAllFieldsUpdated = `Updated Test Action All Fields ${testInfo.parallelIndex}`;
        // Navigate to the action edit form
        await page.goto('/');
        await page.getByRole('link', { name: "Rikets färdplan (v2)" }).click();
        await page.getByRole('heading', { name: "Rikets färdplan" }).hover();
        await page.getByRole('link', { name: actionNameAllFields }).first().click(); // TODO (fix): The tests doesn't seem to click on the right name here and therefore they fail.

        await page.waitForLoadState("networkidle");
        await page.getByRole('heading', { name: actionNameAllFields }).hover();
        await page.getByTestId("admin-panel-edit").click();

        // Part 1 of the form
        await page.locator('#actionName').fill(actionNameAllFieldsUpdated);

        await page.locator('.tiptap').first().fill("Updated Test Action description.");

        await page.locator('#costEfficiency').fill("Updated text for cost efficiency");
        await page.locator('#expectedOutcome').fill("Updated text for expected outcome");

        // Part 2 of the form
        // These two fields are required to be numbers
        await page.locator('#startYear').fill("2026");
        await page.locator('#endYear').fill("2071");

        // Part 3 of the form
        await page.locator('#projectManager').fill("Updated Test Manager");
        await page.locator('#relevantActors').fill("Updated Test Actor");

        // Part 4 of the form
        await page.locator('#isEfficiency').uncheck();
        await page.locator('#isRenewables').uncheck();
        await page.locator('#isSufficiency').check();

        // Submit the form
        await page.locator('#submit-button').click();

        await page.waitForLoadState("networkidle");

        // Verify that everything is updated correctly
        await page.getByTestId("admin-panel-edit").click();

        await expect(page.locator('#actionName')).toHaveValue(actionNameAllFieldsUpdated);
        await expect(page.locator('.tiptap').first()).toHaveText("Updated Test Action description.");
        await expect(page.locator('#costEfficiency')).toHaveValue("Updated text for cost efficiency");
        await expect(page.locator('#expectedOutcome')).toHaveValue("Updated text for expected outcome");

        await expect(page.locator('#startYear')).toHaveValue("2026");
        await expect(page.locator('#endYear')).toHaveValue("2071");
        
        await expect(page.locator('#projectManager')).toHaveValue("Updated Test Manager");
        await expect(page.locator('#relevantActors')).toHaveValue("Updated Test Actor");
        
        await expect(page.locator('#isEfficiency')).not.toBeChecked();
        await expect(page.locator('#isRenewables')).not.toBeChecked();
        await expect(page.locator('#isSufficiency')).toBeChecked();
    });
    // Effect tests begin here //
    
});