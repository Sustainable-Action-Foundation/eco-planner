import { expect, test } from "playwright/test";
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename); // get the name of the directory

const adminFile = path.join(__dirname, '../.auth/admin.json');

test.describe("Action & Effect tests", async () => {
    test.use({ storageState: adminFile });

    // Action tests begin here //
    test("Create Action - required", async ({ page }) => {
        // Navigate to the action creation form
        await page.goto('/');
        await page.getByTestId("create-button").click();
        await page.getByTestId("create-action").click();

        const option = page.locator('#roadmapId option').filter({ hasText: 'Rikets färdplan (v2)' }); // Checks for Rikets färdplan (v2) to be contained in an option

        const value = await option.getAttribute('value');

        await page.locator('#roadmapId').selectOption(value!);

        await page.locator('#actionName').fill("Test Action");

        await page.locator('#submit-button').click();
        
        await page.waitForLoadState("networkidle");

        await expect(page.getByRole('heading', { name: "Test Action" })).toBeVisible();
    });

    test("No edit Action - required", async ({ page }) => {
        // Navigate to the action edit form
        await page.goto('/');
        await page.getByRole('link', { name: "Rikets färdplan (v2)" }).click();
        await page.getByRole('heading', { name: "Rikets färdplan" }).hover();
        await page.getByRole('link', { name: "Test Action" }).first().click();
        await page.waitForLoadState("networkidle");
        await page.getByTestId("admin-panel-edit").click();

        await expect(page.locator('#actionName')).toHaveValue("Test Action");

        await page.locator('#submit-button').click();

        await expect(page.getByRole('heading', { name: "Test Action" })).toBeVisible();
    });

    test.skip("Edit Action - required", async ({ page }) => {
        // Navigate to the action edit form
        await page.goto('/');
        await page.getByRole('link', { name: "Rikets färdplan (v2)" }).click();
        await page.getByRole('heading', { name: "Rikets färdplan" }).hover();
        await page.getByRole('link', { name: "Test Action" }).first().click(); // TODO (fix): The tests doesn't seem to click on the right name here and therefore they fail.
        
        await page.waitForLoadState("networkidle");
        await page.getByTestId("admin-panel-edit").click();

        // Part 1 of the form
        await page.locator('#actionName').clear();
        await page.locator('#actionName').fill("Updated Action All Fields");
        
        await page.locator('.tiptap').fill("Updated Test Action description.");

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

        await expect(page.getByRole('heading', { name: "Updated Action All Fields" })).toBeVisible();

    });

    // Effect tests begin here //
    
});