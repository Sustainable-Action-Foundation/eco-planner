import { expect, test } from "playwright/test";
import path from 'path';
import { fileURLToPath } from 'url';
import { table } from "console";

const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename); // get the name of the directory

const adminFile = path.join(__dirname, '../.auth/admin.json');

test.describe("Goals tests", () => {
    test.use({ storageState: adminFile });

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

    test('Edit goal required only', async ({ page }) => {

        // will only work if correctly 'Create goal required only' is run before

        //Navigate to roadmap
        await page.goto('/');
        await page.waitForLoadState("networkidle");

        await page.getByRole('link', { name: "Rikets färdplan (v2)" }).click();
        await page.getByRole('heading', { name: "Rikets färdplan" }).hover(); //"networkidle" doesn't work for this for some reason so we are hovering to wait for load state where needed

        //Navigate to goal
        await page.getByRole('listitem').first().click();
        await page.getByRole('link').nth(14).click();
        await page.locator('#secondaryGoal').hover();

        //Enter edit form
        await page.getByTestId("admin-panel-edit").click()
        await page.waitForLoadState("networkidle");

        await page.locator('#submit-button').hover();
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