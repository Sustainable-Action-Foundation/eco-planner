import { expect, test } from "playwright/test";
import type { Page } from "playwright/test";
import path from "node:path";
import { cwd } from "node:process";

const adminFile = path.join(cwd(), "tests/.auth/admin.json");

async function fillManualDataSeries(page: Page, rows: Array<[number | string, number | string]>) {
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

/** The goal form keeps the baseline section hidden until the goal has one; reveal it before picking a type. */
async function openBaselineSection(page: Page) {
  const toggle = page.getByTestId("baseline-section-toggle");
  if ((await toggle.getAttribute("aria-expanded")) !== "true") {
    await toggle.click();
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
    await page.locator('input[name="DATA_SERIES_TYPE"][value="MANUAL"]').check();
    await page.locator('#indicatorParameter').fill(indicatorRequiredOnly);
    // The unit lives in the recipe context; a manual series has none, so type an override.
    // Blur afterwards so the autocomplete dropdown doesn't cover elements below.
    await page.locator('#goal-manual-unit').fill(unitRequiredOnly);
    await page.locator('#goal-manual-unit').blur();

    await fillManualDataSeries(page, Array.from({ length: 10 }, (_, i) => [2020 + i, 1]));

    // Form Submit
    await page.locator('#submit-button').click();
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole('main')).toContainText("goal.title_label");
  });

  // Regression for #110: cells typed with a decimal comma or grouping spaces used
  // to become NaN -> null, failing the recipe type guards so the form never
  // submitted successfully.
  test('Create goal with decimal comma and grouped values', async ({ page }, { project }) => {
    await page.goto('/');
    await page.waitForLoadState("networkidle");

    await page.getByTestId('create-button').click();
    await page.getByTestId('create-goal').click();
    await page.waitForLoadState("networkidle");

    await page.locator('#parent-roadmap').click();
    await page.locator('#parent-roadmap-dialog-listbox li').filter({ hasText: 'Rikets färdplan' }).filter({ hasText: '2' }).click();

    await page.locator('input[name="DATA_SERIES_TYPE"][value="MANUAL"]').check();
    await page.locator('#indicatorParameter').fill(`Decimal\\comma\\${project.name}`);
    await page.locator('#goal-manual-unit').fill(unitRequiredOnly);
    await page.locator('#goal-manual-unit').blur();

    await fillManualDataSeries(page, [[2020, "1,5"], [2021, "18 800"], [2022, "2,25"]]);

    await page.locator('#submit-button').click();
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole('main')).toContainText("goal.title_label");

    // Reopen in the edit form: values are stored as numbers, and the typed unit
    // must have survived the grid edits (it used to be reset to "missing").
    // The full form sits under the panel's edit menu
    await page.getByTestId("admin-panel-edit-menu").click();
    await page.getByTestId("admin-panel-edit").click();
    await page.waitForLoadState("networkidle");
    await page.locator('input[name="DATA_SERIES_TYPE"][value="MANUAL"]').check();
    await expect.soft(page.locator('#goal-manual-unit')).toHaveValue(unitRequiredOnly);
    for (const [row, expected] of [["0", "1.5"], ["1", "18800"], ["2", "2.25"]]) {
      await expect.soft(page.locator(`#goal-dataseries [data-row="${row}"][data-column="2"] input`)).toHaveValue(expected);
    }
  });

  test('Edit goal required only', async ({ page }) => {

    // will only work correctly if 'Create goal required only' is run before

    // Navigate to roadmap
    // The public view: logged-in org members land on their org's page by default,
    // which only lists that org's own content
    await page.goto('/?org=public');
    await page.waitForLoadState("networkidle");

    await page.getByRole('link', { name: "Rikets färdplan" }).click();
    await page.getByRole('heading', { name: "Rikets färdplan" }).hover(); // "networkidle" doesn't work for this for some reason so we are hovering to wait for load state where needed

    // Navigate to goal
    await page.getByRole('radio', { name: "table_selector.table" }).click();
    await page.getByRole('link', { name: indicatorRequiredOnly }).first().click();
    // Wait for page to load
    await page.locator('h1').filter({ hasText: indicatorRequiredOnly }).hover();

    // Enter edit form (the full form sits under the panel's edit menu)
    await page.getByTestId("admin-panel-edit-menu").click();
    await page.getByTestId("admin-panel-edit").click();
    await page.waitForLoadState("networkidle");

    // Check that everything is auto filled
    await expect.soft(page.locator('#goalName')).toBeEmpty();
    await expect.soft(page.locator('#description')).toBeEmpty();

    // Expect the form to remember that we chose manual input, even though this is not the default choice
    await expect.soft(page.locator('input[name="DATA_SERIES_TYPE"][value="MANUAL"]')).toBeChecked();

    // Set to manual input in case it isn't, to see if the values are saved correctly at least
    await page.locator('input[name="DATA_SERIES_TYPE"][value="MANUAL"]').check();
    await expect.soft(page.locator('#indicatorParameter')).toHaveValue(indicatorRequiredOnly);
    // A saved unit reopens as the override input's value
    await expect.soft(page.locator('#goal-manual-unit')).toHaveValue(unitRequiredOnly);

    for (let i = 0; i < 10; i++) {
      await expect.soft(page.locator(`#goal-dataseries [data-row="${i}"][data-column="1"] input`)).toHaveValue(String(2020 + i));
      await expect.soft(page.locator(`#goal-dataseries [data-row="${i}"][data-column="2"] input`)).toHaveValue(String(1));
    }

    // The baseline was created as type initial (the default value); derived baselines
    // are stored as recipes, so the form reopens on the same baseline type instead of
    // presenting the derived values as a custom series.
    await expect.soft(page.locator('input[name="BASELINE_TYPE"][value="INITIAL"]')).toBeChecked();

    await expect.soft(page.locator('#isFeatured')).not.toBeChecked();

    // Submit 
    await page.locator('#submit-button').click();
    await page.locator('#comment-text').hover();

    // Reenter edit form
    await page.getByTestId("admin-panel-edit-menu").click();
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

    await page.locator('#goal-manual-unit').fill(unitRequiredUpdated);
    await page.locator('#goal-manual-unit').blur();

    await openBaselineSection(page);

    await page.locator('input[name="BASELINE_TYPE"][value="INITIAL_NON_ZERO"]').check();
    await page.locator('#isFeatured').check();

    // Submit
    await page.locator('#submit-button').click();
    await page.locator('#comment-text').hover();
    // await page.waitForLoadState("networkidle");
    //await expect(page.locator('#comment-text')).toBeEmpty(); TODO: There is placeholder content here so this will never be empty. Should probably check that the placeholder exists, but that should be done in another test...  

    // Reenter edit form to see that everything is updated
    await page.getByTestId("admin-panel-edit-menu").click();
    await page.getByTestId("admin-panel-edit").click();
    await page.waitForLoadState("networkidle");

    await expect.soft(page.locator('#indicatorParameter')).toHaveValue(indicatorRequiredUpdated);
    await expect.soft(page.locator('#goal-manual-unit')).toHaveValue(unitRequiredUpdated);

    for (let i = 0; i < 10; i++) {
      await expect.soft(page.locator(`#goal-dataseries [data-row="${i}"][data-column="1"] input`)).toHaveValue(String(2025 + i));
      await expect.soft(page.locator(`#goal-dataseries [data-row="${i}"][data-column="2"] input`)).toHaveValue(i ? String(4) : String(0));
    }

    // Derived baselines round-trip as their own type now, not as a custom series
    await expect.soft(page.locator('input[name="BASELINE_TYPE"][value="INITIAL_NON_ZERO"]')).toBeChecked();
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
    await page.locator('input[name="DATA_SERIES_TYPE"][value="MANUAL"]').check();
    await page.locator('#indicatorParameter').fill(indicatorAll);
    // The unit lives in the recipe context; a manual series has none, so type an override.
    // Blur afterwards so the autocomplete dropdown doesn't cover elements below.
    await page.locator('#goal-manual-unit').fill(unitAll);
    await page.locator('#goal-manual-unit').blur();

    await fillManualDataSeries(page, Array.from({ length: 30 }, (_, i) => [2020 + i, i]));

    // Form part 4
    await openBaselineSection(page);
    await page.locator('input[name="BASELINE_TYPE"][value="INITIAL_NON_ZERO"]').check();
    /*
      await page.locator('input[name="BASELINE_TYPE"][value="INHERIT"]').check();
      await page.locator('#inheritFrom').click(); // Tree select: roadmap -> goal
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
    // The public view: logged-in org members land on their org's page by default,
    // which only lists that org's own content
    await page.goto('/?org=public');
    await page.waitForLoadState("networkidle");

    await page.getByRole('link', { name: "Rikets färdplan" }).click();
    await page.getByRole('heading', { name: "Rikets färdplan" }).hover(); // "networkidle" doesn't work for this for some reason so we are hovering to wait for load state where needed

    // Navigate to goal
    await page.getByRole('radio', { name: "table_selector.table" }).click();
    await page.getByRole('link', { name: nameAll }).first().click();
    // Wait for page to load
    await page.locator('h1').filter({ hasText: nameAll }).hover();

    // Enter edit form (the full form sits under the panel's edit menu)
    await page.getByTestId("admin-panel-edit-menu").click();
    await page.getByTestId("admin-panel-edit").click();
    await page.waitForLoadState("networkidle");

    // Check that everything is auto filled
    await expect.soft(page.locator('#goalName')).toHaveValue(nameAll);
    await expect.soft(page.locator('#description')).toHaveText(descriptionAll);

    // Expect the form to remember that we chose manual input, even though this is not the default choice
    await expect.soft(page.locator('input[name="DATA_SERIES_TYPE"][value="MANUAL"]')).toBeChecked();

    // Set to manual input in case it isn't, to see if the values are saved correctly at least
    await page.locator('input[name="DATA_SERIES_TYPE"][value="MANUAL"]').check();

    await expect.soft(page.locator('#indicatorParameter')).toHaveValue(indicatorAll);
    // A saved unit reopens as the override input's value
    await expect.soft(page.locator('#goal-manual-unit')).toHaveValue(unitAll);
    for (let i = 0; i < 30; i++) {
      await expect.soft(page.locator(`#goal-dataseries [data-row="${i}"][data-column="1"] input`)).toHaveValue(String(2020 + i));
      await expect.soft(page.locator(`#goal-dataseries [data-row="${i}"][data-column="2"] input`)).toHaveValue(String(i));
    }

    // Derived baselines round-trip as their own type now, not as a custom series
    await expect.soft(page.locator('input[name="BASELINE_TYPE"][value="INITIAL_NON_ZERO"]')).toBeChecked();

    await expect.soft(page.locator('#isFeatured')).toBeChecked();

    // Submit
    await page.locator('#submit-button').click();
    await page.locator('h1').filter({ hasText: nameAll }).hover();

    // Reenter edit form
    await page.getByTestId("admin-panel-edit-menu").click();
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
    // The tree settles level by level; wait for each node and give the click room
    // to retry (firefox intermittently reports the nodes as "not stable" for >5s)
    const treeLevels = [
      page.locator('#recipeVariable-parent-value-dummy-uuid-dialog-tree > li').first(),
      page.locator('#recipeVariable-parent-value-dummy-uuid-dialog-tree > li > ul > li').first(),
      page.locator('#recipeVariable-parent-value-dummy-uuid-dialog-tree > li > ul > li > ul > li').first(),
    ];
    for (const node of treeLevels) {
      await expect(node).toBeVisible();
      await node.click({ timeout: 15_000 });
    }

    // press escape to close the dropdown, to avoid it blocking other elements
    await page.keyboard.press('Escape');

    await page.getByPlaceholder('recipe_editor.scalar').fill('48');
    // No unit input in suggested mode: the unit comes from the recipe evaluation

    await openBaselineSection(page);

    await page.locator('input[name="BASELINE_TYPE"][value="INITIAL"]').check();
    await page.locator('#isPublic').check(); // Visibility is a radio group; "public" is the non-featured, listed state

    // right before submitting, wait for the recipe to finish calculating by expecting there to be no issues with it
    await expect(page.getByText('recipe_editor.no_errors')).toBeVisible();

    // Submit
    await page.locator('#submit-button').click();
    await page.locator('#comment-text').hover();

    // Reenter edit form
    await page.getByTestId("admin-panel-edit-menu").click();
    await page.getByTestId("admin-panel-edit").click();
    await page.waitForLoadState("networkidle");

    // Check that edits have saved
    await expect.soft(page.locator('#goalName')).toHaveValue(nameAllUpdated);
    await expect.soft(page.locator('#description')).toHaveText(descriptionAllUpdated);

    await expect.soft(page.locator('#indicatorParameter')).toHaveValue(indicatorAllUpdated);

    await expect.soft(page.getByRole('radio', { name: 'goal.suggested_inheritance' })).toBeChecked();
    // TODO: some checks on the recipe to ensure it matches expectations?

    // Derived baselines round-trip as their own type now, not as a custom series
    await expect.soft(page.locator('input[name="BASELINE_TYPE"][value="INITIAL"]')).toBeChecked();

    await expect(page.locator('#isFeatured')).not.toBeChecked();
  });
});