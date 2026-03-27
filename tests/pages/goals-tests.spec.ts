import { expect, test } from "playwright/test";
import path from 'path';
import { fileURLToPath } from 'url';
import { table } from "console";
import { exec } from "child_process";
import { execPath } from "process";

const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename); // get the name of the directory

const adminFile = path.join(__dirname, '../.auth/admin.json');

test.describe("Goals tests", () => {

    /*
    -------------------------------------------

    ALWAYS run full description or edit tests won't work

    ------------------------------------------
    */

    test.use({ storageState: adminFile });

    test('Create goal required only', async ({ page }) => {
        //Opening the from
        await page.goto('/');
        await page.waitForLoadState("networkidle");

        await page.getByTestId('create-button').click();
        await page.getByTestId('create-goal').click();
        await page.waitForLoadState("networkidle");

        //From Part 1
        await page.locator('#parent-roadmap').click();
        await page.locator('#parent-roadmap-dialog-listbox li').filter({ hasText: 'Rikets färdplan' }).filter({ hasText: '2' }).click(); // Checks for Rikets färdplan to be contained in an option, with version 2 to avoid selecting the wrong roadmap

        // const value = await option.getAttribute('value');

        // await page.locator('#parent-roadmap-dialog-listbox').selectOption(value);
        //From Part 3
        // Might be switched out for a prewritten recipe when they are fixed
        await page.getByRole('radio').first().click();
        await page.locator('#indicatorParameter').click();
        await page.locator('#indicatorParameter-listbox-0').click();
        await page.locator('#dataUnit').click();
        await page.locator('#dataUnit-listbox-0').click();

        await page.getByPlaceholder('2050').fill('2030')
        for (let i = 0; i < 10; i++) {
            await page.getByRole('spinbutton').nth(2 + i).fill('1');
        }

        //Form Submit
        await page.locator('#submit-button').click();
        await page.waitForLoadState("networkidle");

        await expect(page.getByRole('heading').nth(1)).toContainText("Redigera");
    });

    test('Edit goal required only', async ({ page }) => {

        // will only work correctly if 'Create goal required only' is run before

        // Navigate to roadmap
        await page.goto('/');
        await page.waitForLoadState("networkidle");

        await page.getByRole('link', { name: "Rikets färdplan" }).click();
        await page.getByRole('heading', { name: "Rikets färdplan" }).hover(); //"networkidle" doesn't work for this for some reason so we are hovering to wait for load state where needed

        // Navigate to goal
        await page.getByRole('listitem').getByText("Redigera", { exact: true }).filter({ visible: true })
            .click();
        await page.getByRole('link').filter({ hasText: "Redigera" }).nth(1).click();
        await page.getByRole('heading', { name: "Redigera" }).first().hover();

        // Enter edit form
        await page.getByTestId("admin-panel-edit").click();
        await page.waitForLoadState("networkidle");

        // Check that everything is auto filled
        await expect.soft(page.locator('#goalName')).toBeEmpty();
        await expect.soft(page.locator('#description')).toBeEmpty();

        await page.getByRole('radio').first().click();
        await expect.soft(page.locator('#indicatorParameter')).toHaveValue("Redigera");
        await expect.soft(page.locator('#dataUnit')).toHaveText("meter");

        await expect.soft(page.getByPlaceholder('2020').first()).toHaveValue('2020');
        await expect.soft(page.getByPlaceholder('2050').first()).toHaveValue('2030'); //Not 100% sure if this works as we hope it does, might need changing when the thing is checking for is fixed
        for (let i = 0; i < 10; i++) {
            await expect.soft(page.getByRole('spinbutton').nth(2 + i)).toHaveValue('1')
        }

        await expect.soft(page.locator('#baselineSelector')).toHaveValue('CUSTOM');
        await expect.soft(page.locator('#isFeatured')).not.toBeChecked();

        // Submit
        await page.locator('#submit-button').click();
        await page.waitForLoadState("networkidle");
        await expect(page.locator('#comment-text')).toBeEmpty();

        // Reenter edit form
        await page.getByTestId("admin-panel-edit").click();
        await page.waitForLoadState("networkidle");

        // Editing fields
        await page.locator('#indicatorParameter').click();
        await page.locator('#indicatorParameter-listbox-1').click();

        await page.locator('#dataUnit').click();
        await page.locator('#dataUnit-listbox-3').click();
        await page.getByPlaceholder('2020').first().fill('2025');
        await page.getByPlaceholder('2050').first().fill('2045');
        for (let i = 0; i < 20; i++) {
            page.getByRole('spinbutton').nth(2 + i).fill('4');
        }

        // Submit
        await page.locator('#submit-button').click();
        await page.locator('#comment-text').hover()
        // await page.waitForLoadState("networkidle");
        await expect(page.locator('#comment-text')).toBeEmpty();
    });

    test('Create goal all', async ({ page }) => {
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

        //From Part 3
        // Might be switch out for a prewritten recipe when they are fixed
        await page.getByRole('radio').first().click();
        await page.locator('#indicatorParameter').click();
        await page.locator('#indicatorParameter-listbox-0').click();
        await page.locator('#dataUnit').click();
        await page.locator('#dataUnit-listbox-0').click();

        for (let i = 0; i < 30; i++) {
            await page.getByRole('spinbutton').nth(2 + i).fill('1');
        }

        //Form part 4
        /*
            await page.locator('#baselineSelector').selectOption({ value: "INHERIT" });
            await page.locator('#selectedRoadmap').selectOption({ index: 1 });
            await page.locator('#inheritFrom').selectOption({ index: 1 });
        */
        //Form part 5
        await page.locator('#isFeatured').check();

        //Form Submit
        await page.locator('#submit-button').click();
        await page.waitForLoadState("networkidle");

        await expect(page.getByRole('heading').nth(1)).toHaveText('Test Goal');
        await expect(page.locator('#rich-description')).toHaveText('This is a test goal');
    });

    test('Edit goal all', async ({ page }) => {

        // will only work correctly if 'Create goal all' is run before

        // Navigate to roadmap
        await page.goto('/');
        await page.waitForLoadState("networkidle");

        await page.getByRole('link', { name: "Rikets färdplan" }).click();
        await page.getByRole('heading', { name: "Rikets färdplan" }).hover(); //"networkidle" doesn't work for this for some reason so we are hovering to wait for load state where needed

        // Navigate to goal
        await page.getByRole('listitem').getByText("Redigera", { exact: true }).filter({ visible: true }).click();
        await page.getByRole('link').filter({ hasText: "Test Goal" }).first().click();
        await page.getByRole('heading', { name: "Test Goal" }).hover();

        // Enter edit form
        await page.getByTestId("admin-panel-edit").click();
        await page.waitForLoadState("networkidle");

        // Check that everything is auto filled
        await expect.soft(page.locator('#goalName')).toHaveValue("Test Goal");
        await expect.soft(page.locator('#description')).toHaveText("This is a test goal");

        await expect.soft(page.getByRole('radio').first()).toBeChecked();

        await page.getByRole('radio').first().click();
        await expect.soft(page.locator('#indicatorParameter')).toHaveValue("Redigera");
        await expect.soft(page.locator('#dataUnit')).toHaveText("meter");
        await expect.soft(page.getByPlaceholder('2020').first()).toHaveValue('2020');
        await expect.soft(page.getByPlaceholder('2050').first()).toHaveValue('2030'); //Not 100% sure if this works as we hope it does, might need changing when the thing is checking for is fixed
        for (let i = 0; i < 10; i++) {
            await expect.soft(page.getByRole('spinbutton').nth(2 + i)).toHaveValue('1')
        }


        await expect.soft(page.locator('#baselineSelector')).toHaveValue('CUSTOM');
        await expect.soft(page.locator('#isFeatured')).toBeChecked();

        // Submit
        await page.locator('#submit-button').click();
        await page.waitForLoadState("networkidle");
        await expect(page.locator('#comment-text')).toBeEmpty();

        // Reenter edit form
        await page.getByTestId("admin-panel-edit").click();
        await page.waitForLoadState("networkidle");

        // Editing form
        await page.locator('#goalName').fill("Edited Test")
        await page.locator('#description').fill("Edited test description") //does not work, needs a different action to fill

        await page.getByRole('tab').nth(1).click();
        await page.locator('#recipeVariable0-dialog').click();
        await page.locator('#recipeVariable0-dialog-tree-Rikets-färdplan (v1)').click();
        await page.getByRole('treeitem').first().click();
        await page.locator('#scalar-skalär').fill('48')


        await page.locator('#baselineSelector').selectOption("INITIAL")
        await page.locator('#isFeatured').uncheck();

        // Submit
        await page.locator('#submit-button').click();
        await page.waitForLoadState("networkidle");
        await expect(page.locator('#comment-text')).toBeEmpty();

        // Reenter edit form
        await page.getByTestId("admin-panel-edit").click();
        await page.waitForLoadState("networkidle");

        // Check that edits have saved
        await expect.soft(page.locator('#goalName')).toHaveValue("Edited Test");
        await expect.soft(page.locator('#description')).toHaveText("Edited test description");

        await page.getByRole('tab').nth(1).click();
        await expect.soft(page.locator('#recipeVariable0')).not.toBeEmpty();
        await expect.soft(page.locator('#scalar-skalär')).toHaveValue('48');

        await expect(page.locator('#isFeatured')).not.toBeChecked();
    });

});