import { expect, test } from "playwright/test";
import type { Page } from "playwright/test";
import path from "node:path";
import { cwd } from "node:process";

const adminFile = path.join(cwd(), "tests/.auth/admin.json");

async function fillManualDataSeries(page: Page, rows: Array<[number, number]>) {
  const insertRowButton = page.getByTestId("add-row-button");

  for (let i = 1; i < rows.length; i++) {
    await insertRowButton.click();
  }

  // Set focus inside table to ensure the first cell gets filled properly;
  // without this the test will fail on Firefox and Webkit (but not Chromium) because the first attempt to input data into a cell only sets focus into the table, without successfully filling the cell.
  await page.locator(`#goal-dataseries [data-row="0"][data-column="1"] input`).focus();

  for (let row = 0; row < rows.length; row++) {
    const [year, value] = rows[row];
    await page.locator(`#goal-dataseries [data-row="${row}"][data-column="1"] input`).fill(String(year));
    await page.locator(`#goal-dataseries [data-row="${row}"][data-column="2"] input`).fill(String(value));
  }
}

test.describe("Goals tests", () => {
  test.use({ storageState: adminFile });

  let indicatorRequiredOnly = "Required\\only";
  let indicatorRequiredUpdated = "Required\\updated\\only";
  const unitRequiredOnly = "meter";
  const unitRequiredUpdated = "yard";
  let nameAll = "Test goal";
  let nameAllUpdated = "Test updated goal";
  const descriptionAll = "This is a test goal";
  const descriptionAllUpdated = "This is an updated test goal";
  let indicatorAll = "All\\fields";
  let indicatorAllUpdated = "All\\updated\\fields";
  const unitAll = "tonnes";
  const unitAllUpdated = "grams";

  test.beforeAll("Differentiate between browsers", ({ }, { project }) => {
    indicatorRequiredOnly += `\\${project.name}`;
    indicatorRequiredUpdated += `\\${project.name}`;
    nameAll += ` ${project.name}`;
    nameAllUpdated += ` ${project.name}`;
    indicatorAll += `\\${project.name}`;
    indicatorAllUpdated += `\\${project.name}`;
  });

  test('Create goal required only', async ({ page }) => {
    // Opening the form
    await page.goto('/');
    await page.waitForLoadState("networkidle");

    await page.getByTestId('create-button').click();
    await page.getByTestId('create-goal').click();
    await page.waitForLoadState("networkidle");

    // Form Part 1
    await page.locator('#parent-roadmap').click();
    await page.locator('#parent-roadmap-dialog-listbox li').filter({ hasText: 'Rikets färdplan' }).filter({ hasText: '2' }).click(); // Checks for Rikets färdplan to be contained in an option, with version 2 to avoid selecting the wrong roadmap

    // Form Part 2 is optional, so we skip it

    // Form Part 3
    // Might be switched out for a pre-written recipe when they are fixed
    await page.locator('input[name="dataSeriesType"][value="MANUAL"]').check();
    await page.locator('#indicatorParameter').fill(indicatorRequiredOnly);
    await page.locator('#dataUnit').fill(unitRequiredOnly);
    await page.locator('#dataUnit').blur();

    await fillManualDataSeries(page, Array.from({ length: 10 }, (_, i) => [2020 + i, 1]));

    // Form Submit
    await page.locator('#submit-button').click();
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole('main')).toContainText("goal.title_label");
  });

  test('Edit goal required only', async ({ page }) => {

    // will only work correctly if 'Create goal required only' is run before

    // Navigate to roadmap
    await page.goto('/');
    await page.waitForLoadState("networkidle");

    await page.getByRole('link', { name: "Rikets färdplan" }).click();
    await page.getByRole('heading', { name: "Rikets färdplan" }).hover(); // "networkidle" doesn't work for this for some reason so we are hovering to wait for load state where needed

    // Navigate to goal
    await page.getByRole('radio', { name: "table_selector.table" }).click();
    await page.getByRole('link', { name: indicatorRequiredOnly }).first().click();
    // Wait for page to load
    await page.locator('h1').filter({ hasText: indicatorRequiredOnly }).hover();

    // Enter edit form
    await page.getByRole('link', { name: "table_menu.edit" }).click();
    await page.waitForLoadState("networkidle");

    // Check that everything is auto filled
    await expect.soft(page.locator('#goalName')).toBeEmpty();
    await expect.soft(page.locator('#description')).toBeEmpty();

    // Expect the form to remember that we chose manual input, even though this is not the default choice
    await expect.soft(page.locator('input[name="dataSeriesType"][value="MANUAL"]')).toBeChecked();

    // Set to manual input in case it isn't, to see if the values are saved correctly at least
    await page.locator('input[name="dataSeriesType"][value="MANUAL"]').check();
    await expect.soft(page.locator('#indicatorParameter')).toHaveValue(indicatorRequiredOnly);
    await expect.soft(page.locator('#dataUnit')).toHaveValue(unitRequiredOnly);

    for (let i = 0; i < 10; i++) {
      await expect.soft(page.locator(`#goal-dataseries [data-row="${i}"][data-column="1"] input`)).toHaveValue(String(2020 + i));
      await expect.soft(page.locator(`#goal-dataseries [data-row="${i}"][data-column="2"] input`)).toHaveValue(String(1));
    }

    await expect.soft(page.locator('#baselineSelector')).toHaveValue('CUSTOM');
    for (let i = 0; i < 10; i++) {
      await expect.soft(page.locator(`#baseline-dataseries [data-row="${i}"][data-column="1"] input`)).toHaveValue(String(2020 + i));
      // Since the baseline was created as type initial (the default value), the baseline value should be the first value of the data series, which is 1, for all years
      await expect.soft(page.locator(`#baseline-dataseries [data-row="${i}"][data-column="2"] input`)).toHaveValue(String(1));
    }

    await expect.soft(page.locator('#isFeatured')).not.toBeChecked();

    // Submit 
    await page.locator('#submit-button').click();
    await page.locator('#comment-text').hover();

    // Reenter edit form
    await page.getByTestId("admin-panel-edit").click();
    await page.waitForLoadState("networkidle");
    //await expect(page.locator('#comment-text')).toBeEmpty(); TODO: There is placeholder content here so this will never be empty. Should probably check that the placeholder exists, but that should be done in another test...  

    // TODO: Should check same things again to ensure that values are not changed when submitting without changes

    // Editing fields
    await page.locator('#indicatorParameter').fill(indicatorRequiredUpdated);
    await page.locator('#indicatorParameter').blur();

    // Need to focus this cell to ensure the value is filled properly, otherwise the test will fail on Firefox and Webkit because the first attempt to input data into a cell only sets focus into the table, without successfully filling the cell.
    await page.locator(`#goal-dataseries [data-row="0"][data-column="1"] input`).focus();
    for (let i = 0; i < 10; i++) {
      await page.locator(`#goal-dataseries [data-row="${i}"][data-column="1"] input`).fill(String(2025 + i));
      await page.locator(`#goal-dataseries [data-row="${i}"][data-column="2"] input`).fill(i ? String(4) : String(0)); // set all values except first to 4, to test that the initial non zero baseline type works correctly
    }

    await page.locator('#dataUnit').fill(unitRequiredUpdated);
    await page.locator('#dataUnit').blur();

    await page.locator('#baselineSelector').selectOption("INITIAL_NON_ZERO");
    await page.locator('#isFeatured').check();

    // Submit
    await page.locator('#submit-button').click();
    await page.locator('#comment-text').hover();
    // await page.waitForLoadState("networkidle");
    //await expect(page.locator('#comment-text')).toBeEmpty(); TODO: There is placeholder content here so this will never be empty. Should probably check that the placeholder exists, but that should be done in another test...  

    // Reenter edit form to see that everything is updated
    await page.getByTestId("admin-panel-edit").click();
    await page.waitForLoadState("networkidle");

    await expect.soft(page.locator('#indicatorParameter')).toHaveValue(indicatorRequiredUpdated);
    await expect.soft(page.locator('#dataUnit')).toHaveValue(unitRequiredUpdated); // Might need to be changed when the thing that checks for changes is fixed, currently it doesn't recognize the change of data unit as a change so it doesn't update the value in the form

    for (let i = 0; i < 10; i++) {
      await expect.soft(page.locator(`#goal-dataseries [data-row="${i}"][data-column="1"] input`)).toHaveValue(String(2025 + i));
      await expect.soft(page.locator(`#goal-dataseries [data-row="${i}"][data-column="2"] input`)).toHaveValue(i ? String(4) : String(0));
    }

    await expect.soft(page.locator('#baselineSelector')).toHaveValue('CUSTOM');
    for (let i = 0; i < 10; i++) {
      await expect.soft(page.locator(`#baseline-dataseries [data-row="${i}"][data-column="1"] input`)).toHaveValue(String(2025 + i));
      // Since the baseline was created as type initial non zero, the baseline value should be the first non zero value of the data series, which is 4, for all years
      await expect.soft(page.locator(`#baseline-dataseries [data-row="${i}"][data-column="2"] input`)).toHaveValue(String(4));
    }
    await expect(page.locator('#isFeatured')).toBeChecked();

    // Submit without changes to see that the form is not broken
    await page.locator('#submit-button').click();
    await page.locator('#comment-text').hover();
  });

  test('Create goal all', async ({ page }) => {
    // Opening the form
    await page.goto('/');
    await page.waitForLoadState("networkidle");

    await page.getByTestId('create-button').click();
    await page.getByTestId('create-goal').click();
    await page.waitForLoadState("networkidle");

    // Form Part 1
    await page.locator('#parent-roadmap').click();
    await page.locator('#parent-roadmap-dialog-listbox li').filter({ hasText: 'Rikets färdplan' }).filter({ hasText: '2' }).click(); // Checks for Rikets färdplan to be contained in an option, with version 2 to avoid selecting the wrong roadmap

    // Form Part 2
    await page.locator('#goalName').fill(nameAll);
    await page.getByRole('textbox').nth(1).fill(descriptionAll); // Might be a better way of getting this element

    // Form Part 3
    // Might be switch out for a pre-written recipe when they are fixed
    await page.locator('input[name="dataSeriesType"][value="MANUAL"]').check();
    await page.locator('#indicatorParameter').fill(indicatorAll);
    await page.locator('#dataUnit').fill(unitAll);
    await page.locator('#dataUnit').blur(); // Need to blur this so dropdown menu doesnt block items below

    await fillManualDataSeries(page, Array.from({ length: 30 }, (_, i) => [2020 + i, i]));

    // Form part 4
    await page.locator('#baselineSelector').selectOption({ value: "INITIAL_NON_ZERO" });
    /*
      await page.locator('#baselineSelector').selectOption({ value: "INHERIT" });
      await page.locator('#selectedRoadmap').selectOption({ index: 1 });
      await page.locator('#inheritFrom').selectOption({ index: 1 });
    */
    // Form part 5
    await page.locator('#isFeatured').check();

    // Form Submit
    await page.locator('#submit-button').click();
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole('heading').nth(1)).toHaveText(nameAll);
    await expect(page.locator('#rich-description')).toHaveText(descriptionAll);
  });

  test('Edit goal all', async ({ page }) => {

    // Will only work correctly if 'Create goal all' is run before

    // Navigate to roadmap
    await page.goto('/');
    await page.waitForLoadState("networkidle");

    await page.getByRole('link', { name: "Rikets färdplan" }).click();
    await page.getByRole('heading', { name: "Rikets färdplan" }).hover(); // "networkidle" doesn't work for this for some reason so we are hovering to wait for load state where needed

    // Navigate to goal
    await page.getByRole('radio', { name: "table_selector.table" }).click();
    await page.getByRole('link', { name: nameAll }).first().click();
    // Wait for page to load
    await page.locator('h1').filter({ hasText: nameAll }).hover();

    // Enter edit form
    await page.getByRole('link', { name: "table_menu.edit" }).click();
    await page.waitForLoadState("networkidle");

    // Check that everything is auto filled
    await expect.soft(page.locator('#goalName')).toHaveValue(nameAll);
    await expect.soft(page.locator('#description')).toHaveText(descriptionAll);

    // Expect the form to remember that we chose manual input, even though this is not the default choice
    await expect.soft(page.locator('input[name="dataSeriesType"][value="MANUAL"]')).toBeChecked();

    // Set to manual input in case it isn't, to see if the values are saved correctly at least
    await page.locator('input[name="dataSeriesType"][value="MANUAL"]').check();

    await expect.soft(page.locator('#indicatorParameter')).toHaveValue(indicatorAll);
    await expect.soft(page.locator('#dataUnit')).toHaveValue(unitAll);
    for (let i = 0; i < 30; i++) {
      await expect.soft(page.locator(`#goal-dataseries [data-row="${i}"][data-column="1"] input`)).toHaveValue(String(2020 + i));
      await expect.soft(page.locator(`#goal-dataseries [data-row="${i}"][data-column="2"] input`)).toHaveValue(String(i));
    }

    await expect.soft(page.locator('#baselineSelector')).toHaveValue('CUSTOM');
    for (let i = 0; i < 30; i++) {
      await expect.soft(page.locator(`#baseline-dataseries [data-row="${i}"][data-column="1"] input`)).toHaveValue(String(2020 + i));
      // Since the baseline was created as type initial non zero, the baseline value should be the first non zero value of the data series, which is 1, for all years
      await expect.soft(page.locator(`#baseline-dataseries [data-row="${i}"][data-column="2"] input`)).toHaveValue(String(1));
    }

    await expect.soft(page.locator('#isFeatured')).toBeChecked();

    // Submit
    await page.locator('#submit-button').click();
    await page.locator('h1').filter({ hasText: nameAll }).hover();

    // Reenter edit form
    await page.getByTestId("admin-panel-edit").click();
    await page.waitForLoadState("networkidle");

    // Editing form
    await page.locator('#goalName').fill(nameAllUpdated);
    await page.getByRole('textbox').nth(1).fill(descriptionAllUpdated);

    await page.locator('#indicatorParameter').fill(indicatorAllUpdated);

    await page.getByRole('radio', { name: 'goal.suggested_inheritance' }).click();
    await page.locator('#select-preset').selectOption('scalar-recipe-dummy-uuid');

    await page.locator('#recipeVariable-parent-value-dummy-uuid').click();
    // Select first valid option from a tree dropdown combobox thingy
    await page.locator('#recipeVariable-parent-value-dummy-uuid-dialog-tree > li').first().click();
    await page.locator('#recipeVariable-parent-value-dummy-uuid-dialog-tree > li > ul > li').first().click();
    await page.locator('#recipeVariable-parent-value-dummy-uuid-dialog-tree > li > ul > li > ul > li').first().click();

    // press escape to close the dropdown, to avoid it blocking other elements
    await page.keyboard.press('Escape');

    await page.getByPlaceholder('recipe_editor.scalar').fill('48');
    await page.locator('#dataUnit').fill(unitAllUpdated);
    await page.locator('#dataUnit').blur();

    await page.locator('#baselineSelector').selectOption("INITIAL");
    await page.locator('#isFeatured').uncheck();

    // right before submitting, wait for the recipe to finish calculating by expecting there to be no issues with it
    await expect(page.getByText('recipe_editor.no_errors')).toBeVisible();

    // Submit
    await page.locator('#submit-button').click();
    await page.locator('#comment-text').hover();

    // Reenter edit form
    await page.getByTestId("admin-panel-edit").click();
    await page.waitForLoadState("networkidle");

    // Check that edits have saved
    await expect.soft(page.locator('#goalName')).toHaveValue(nameAllUpdated);
    await expect.soft(page.locator('#description')).toHaveText(descriptionAllUpdated);

    await expect.soft(page.locator('#indicatorParameter')).toHaveValue(indicatorAllUpdated);
    await expect.soft(page.locator('#dataUnit')).toHaveValue(unitAllUpdated); // Might need to be changed when the thing that checks for changes is fixed, currently it doesn't recognize the change of data unit as a change so it doesn't update the value in the form 

    await expect.soft(page.getByRole('radio', { name: 'goal.suggested_inheritance' })).toBeChecked();
    // TODO: some checks on the recipe to ensure it matches expectations?

    await expect.soft(page.locator('#baselineSelector')).toHaveValue('CUSTOM');

    // Since the baseline was changed to type initial, we expect all values of the baseline to be the same, and all of them to have years, but since we don't know the values in the data series we selected we just check that they seem valid
    const years = page.locator('#baseline-dataseries [data-column="1"] input');
    const values = page.locator('#baseline-dataseries [data-column="2"] input');
    const firstValue = await values.first().inputValue();
    const yearList = await years.all();
    const valueList = await values.all();

    for (const year of yearList) {
      await expect.soft(year).not.toBeEmpty();
    }

    for (const value of valueList) {
      await expect.soft(value).toHaveValue(firstValue);
    }

    await expect(page.locator('#isFeatured')).not.toBeChecked();
  });
});