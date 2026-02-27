import { expect, test } from "playwright/test";
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename); // get the name of the directory

const adminFile = path.join(__dirname, '../.auth/admin.json');

test.describe("Logged in tests", () => {
  test.use({ storageState: adminFile });

  test('Add roadmap series', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('create-button').click();
    await page.getByTestId('create-roadmap-series').click();
    await expect(page.locator('#name')).toBeVisible();
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

    await expect(page.locator('#comment-text')).toBeEmpty(); //Might be possible for a nicer expect but this was the only ID we found on the page
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

    await expect(page.locator('#comment-text')).toBeEmpty();
  });

});
